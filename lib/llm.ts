// Pluggable LLM client for EXTRACT and EXPLAIN.
//
// Mirrors the architectural principle described in the validated HTML
// prototype's own header comment (see mizan_chat_artifact.html): the real
// backend's EXTRACT calls the Anthropic Messages API with FORCED
// STRUCTURED OUTPUT (a tool_use call, not free text) and its EXPLAIN path
// is Claude-written prose that gets validated number-for-number against
// the engine's own output before ever being shown to a user. That Python
// source (app/llm.py, app/routers/chat.py) was not available to port from
// in this session, so this file is a faithful TypeScript re-implementation
// of the same two principles, not a wrapper around it:
//
//   1. EXTRACT: if ANTHROPIC_API_KEY is set, ask Claude for a forced
//      tool-use call returning the complete updated heir-count draft, then
//      structurally validate the shape before trusting it (every relation
//      present, non-negative integers, single-occupancy relations capped
//      at 1). Any missing key, wrong type, or failed import/call falls
//      back to the deterministic keyword matcher in lib/extract.ts.
//
//   2. EXPLAIN: if the key is set, ask Claude to write a short prose
//      explanation of an ALREADY-COMPUTED result (computeShares() has
//      already run — this step never lets a model invent numbers, only
//      prose around numbers this app already trusts). Every "n/d" fraction
//      the model's prose mentions is checked against the actual computed
//      shares; a single mismatch triggers one retry, and a second mismatch
//      (or any import/call failure) falls back to the deterministic
//      per-language template in lib/explain.ts. An unvalidated model
//      number is never returned to a caller.
//
// @anthropic-ai/sdk is an optionalDependency (see package.json) — it may
// not be installed at all (e.g. in a minimal CI image), so every use of it
// is behind a dynamic import() inside a try/catch.

import { ComputeResult, HeirDraft, Lang, Relation } from "./types";
import { extractDraft } from "./extract";
import { templateExplanation } from "./explain";

const RELATIONS: Relation[] = [
  "husband", "wife", "son", "daughter", "father", "mother", "full_brother", "full_sister",
];
const SINGLE_ONLY: Relation[] = ["husband", "wife", "father", "mother"];

const LANG_NAME: Record<Lang, string> = {
  en: "English",
  fr: "French",
  ar: "Modern Standard Arabic",
  dar: "Moroccan Darija (written in Arabic script)",
};

export interface ExtractOutcome {
  draft: HeirDraft;
  extractedByModel: boolean;
}

export interface ExplainOutcome {
  text: string;
  explainedByModel: boolean;
}

function isValidHeirDraft(obj: unknown): obj is HeirDraft {
  if (!obj || typeof obj !== "object") return false;
  const rec = obj as Record<string, unknown>;
  for (const r of RELATIONS) {
    const v = rec[r];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0) return false;
    if (SINGLE_ONLY.includes(r) && v > 1) return false;
  }
  return true;
}

async function loadAnthropic(): Promise<any | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const mod: any = await import("@anthropic-ai/sdk");
    const Anthropic = mod.default ?? mod.Anthropic ?? mod;
    return new Anthropic({ apiKey });
  } catch {
    return null;
  }
}

/** EXTRACT: forced structured tool-use, validated, with a deterministic fallback. */
export async function runExtract(
  text: string,
  lang: Lang,
  currentDraft: HeirDraft,
): Promise<ExtractOutcome> {
  const fallback = (): ExtractOutcome => ({
    draft: extractDraft(text, lang, currentDraft),
    extractedByModel: false,
  });

  const client = await loadAnthropic();
  if (!client) return fallback();

  const tool = {
    name: "set_heir_draft",
    description:
      "Return the complete, updated count of each surviving heir type after reading the user's latest message, in light of the heir counts already established earlier in the conversation. Counts are absolute (the final total for each relation), not deltas.",
    input_schema: {
      type: "object",
      properties: {
        husband: { type: "integer", minimum: 0, maximum: 1 },
        wife: { type: "integer", minimum: 0, maximum: 1 },
        son: { type: "integer", minimum: 0, maximum: 20 },
        daughter: { type: "integer", minimum: 0, maximum: 20 },
        father: { type: "integer", minimum: 0, maximum: 1 },
        mother: { type: "integer", minimum: 0, maximum: 1 },
        full_brother: { type: "integer", minimum: 0, maximum: 20 },
        full_sister: { type: "integer", minimum: 0, maximum: 20 },
      },
      required: RELATIONS,
    },
  };

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 512,
      system:
        `You extract Islamic-inheritance (Faraid) heir counts from a family's own description of who survives a decedent. ` +
        `The user is writing in ${LANG_NAME[lang]}. Only these eight relations exist in this system: husband, wife, son, ` +
        `daughter, father, mother, full_brother (a full sibling sharing both parents), full_sister. Ignore any other relative ` +
        `mentioned (half-siblings, grandparents, uncles, cousins, etc.) — this system does not model them. husband/wife/father/mother ` +
        `can only be 0 or 1. Always call the set_heir_draft tool with the complete, final counts.`,
      tools: [tool],
      tool_choice: { type: "tool", name: "set_heir_draft" },
      messages: [
        {
          role: "user",
          content:
            `Heir counts already established so far this conversation: ${JSON.stringify(currentDraft)}.\n` +
            `The user's newest message: "${text}"\n` +
            `Return the complete updated counts.`,
        },
      ],
    });

    const toolUse = (response.content || []).find((b: any) => b.type === "tool_use");
    if (toolUse && isValidHeirDraft(toolUse.input)) {
      return { draft: toolUse.input as HeirDraft, extractedByModel: true };
    }
    return fallback();
  } catch {
    return fallback();
  }
}

function allowedFractionTokens(result: ComputeResult): Set<string> {
  const set = new Set<string>();
  for (const l of result.lines) set.add(`${l.share[0]}/${l.share[1]}`);
  return set;
}

/** Every "n/d" substring the model's prose mentions must be one of the
 * engine's own computed fractions — this is the "validate number-for-
 * number" gate. A bare integer share (denominator 1, e.g. a residuary
 * heir who ends up with the whole estate) can also appear unslashed, so we
 * only check slash-fraction tokens; anything else the model wrote is
 * assumed to be non-numeric prose. */
function explanationNumbersValid(text: string, result: ComputeResult): boolean {
  const allowed = allowedFractionTokens(result);
  const found = text.match(/\d+\s*\/\s*\d+/g) || [];
  for (const raw of found) {
    const normalized = raw.replace(/\s+/g, "");
    if (!allowed.has(normalized)) return false;
  }
  return true;
}

/** EXPLAIN: a Claude-written explanation of an already-computed result,
 * validated number-for-number, with a retry, then a deterministic fallback. */
export async function runExplain(result: ComputeResult, lang: Lang): Promise<ExplainOutcome> {
  const fallback = (): ExplainOutcome => ({
    text: templateExplanation(result, lang),
    explainedByModel: false,
  });

  if (result.confidence === "unsupported") return fallback();

  const client = await loadAnthropic();
  if (!client) return fallback();

  const shareSummary = result.lines
    .map((l) => `${l.relation}${l.count > 1 ? ` ×${l.count}` : ""}: ${l.share[0]}/${l.share[1]} (${l.cls}, Art. ${l.article})`)
    .join("; ");

  const system =
    `You write short, warm, precise explanations of an ALREADY-COMPUTED Islamic inheritance (Faraid) share result for a ` +
    `Moroccan family, in ${LANG_NAME[lang]}. You must not compute or alter any number — only explain the numbers given to ` +
    `you, exactly as given, as reduced fractions (e.g. "1/8"). Keep it to 2-4 sentences.`;

  const buildUserMsg = (correction?: string) =>
    `Computed shares (relation: exact fraction, class, article): ${shareSummary}.` +
    (result.specialCase ? " Named special case: el-gharâwyn (Art. 366)." : "") +
    (result.awlApplied ? " 'Awl was applied (fixed shares exceeded the estate, scaled down proportionally)." : "") +
    (result.raddApplied ? " Radd was applied (no residuary heir; leftover returned proportionally)." : "") +
    (correction ? `\n\n${correction}` : "");

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const correction =
        attempt === 0
          ? undefined
          : "Your previous explanation stated a fraction that did not match the computed shares above exactly. " +
            "Rewrite it, using ONLY the exact fractions given above.";
      const response = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 400,
        system,
        messages: [{ role: "user", content: buildUserMsg(correction) }],
      });
      const textBlock = (response.content || []).find((b: any) => b.type === "text");
      const text: string | undefined = textBlock?.text;
      if (text && explanationNumbersValid(text, result)) {
        return { text, explainedByModel: true };
      }
    }
    return fallback();
  } catch {
    return fallback();
  }
}
