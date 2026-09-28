// POST /api/chat/turn — the collecting -> awaiting_confirmation -> computed
// state machine described in lib/types.ts's ChatTurnRequest/ChatTurnResponse.
//
// The confirm-before-compute gate is enforced STRUCTURALLY here, not by
// parsing free text: a request whose `stage` is "awaiting_confirmation"
// that doesn't carry `userAction: "confirm" | "correct"` is rejected with
// 400 before any extraction or computation runs, exactly mirroring the
// described Pydantic validator in the Python design this re-implements
// (see chat_schemas.py in the master spec).

import { NextRequest, NextResponse } from "next/server";
import { EMPTY_DRAFT, RELATION_ORDER } from "@/lib/types";
import type { ChatTurnRequest, ChatTurnResponse, HeirDraft, Lang } from "@/lib/types";
import { computeShares, draftIsEmpty, mergeDraft } from "@/lib/engine";
import { runExtract, runExplain } from "@/lib/llm";
import { buildConfirmationMessage, t } from "@/lib/i18n";

const VALID_LANGS: Lang[] = ["en", "fr", "ar", "dar"];
const VALID_STAGES = ["collecting", "awaiting_confirmation", "computed"];

function isHeirDraftShape(v: unknown): v is HeirDraft {
  if (!v || typeof v !== "object") return false;
  const rec = v as Record<string, unknown>;
  return RELATION_ORDER.every((r) => typeof rec[r] === "number" && Number.isFinite(rec[r]));
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest): Promise<NextResponse<ChatTurnResponse | { error: string }>> {
  let body: Partial<ChatTurnRequest>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  const { lang, message, draft, stage, userAction } = body;

  if (!lang || !VALID_LANGS.includes(lang)) return badRequest("`lang` must be one of en, fr, ar, dar.");
  if (typeof message !== "string") return badRequest("`message` must be a string.");
  if (!stage || !VALID_STAGES.includes(stage)) return badRequest("`stage` must be one of collecting, awaiting_confirmation, computed.");
  const currentDraft: HeirDraft = isHeirDraftShape(draft) ? draft : EMPTY_DRAFT;

  // ---- structural confirm-before-compute gate ----
  if (stage === "awaiting_confirmation") {
    if (userAction !== "confirm" && userAction !== "correct") {
      return badRequest(
        "A turn sent while stage is \"awaiting_confirmation\" must include userAction: \"confirm\" or \"correct\".",
      );
    }

    if (userAction === "confirm") {
      if (draftIsEmpty(currentDraft)) {
        return NextResponse.json({
          stage: "collecting",
          draft: currentDraft,
          assistantText: t(lang, "computeErrorEmpty"),
          extractedByModel: false,
          explainedByModel: false,
        });
      }
      const result = computeShares(currentDraft);
      const explain = await runExplain(result, lang);
      return NextResponse.json({
        stage: "computed",
        draft: EMPTY_DRAFT,
        assistantText: explain.text,
        result,
        extractedByModel: false,
        explainedByModel: explain.explainedByModel,
      });
    }

    // userAction === "correct": merge the follow-up message into the
    // existing draft (the same additive extraction the deterministic
    // matcher and forced-tool-use extractor both do elsewhere) and go
    // back to collecting/awaiting_confirmation depending on the result.
    const extraction = await runExtract(message, lang, currentDraft);
    const newDraft = mergeDraft(EMPTY_DRAFT, extraction.draft);
    if (draftIsEmpty(newDraft)) {
      return NextResponse.json({
        stage: "collecting",
        draft: newDraft,
        assistantText: t(lang, "followUpDefault"),
        extractedByModel: extraction.extractedByModel,
        explainedByModel: false,
      });
    }
    return NextResponse.json({
      stage: "awaiting_confirmation",
      draft: newDraft,
      assistantText: buildConfirmationMessage(newDraft, lang, RELATION_ORDER),
      extractedByModel: extraction.extractedByModel,
      explainedByModel: false,
    });
  }

  // ---- fresh turn: "collecting" (or a stray "computed" from a client
  // that hasn't reset yet — treated the same as a fresh collecting turn,
  // since the demo always resets to an empty draft/collecting stage right
  // after a compute; see README's "judgment calls") ----
  const extraction = await runExtract(message, lang, currentDraft);
  const newDraft = mergeDraft(EMPTY_DRAFT, extraction.draft);

  if (draftIsEmpty(newDraft)) {
    return NextResponse.json({
      stage: "collecting",
      draft: newDraft,
      assistantText: t(lang, "followUpDefault"),
      extractedByModel: extraction.extractedByModel,
      explainedByModel: false,
    });
  }

  return NextResponse.json({
    stage: "awaiting_confirmation",
    draft: newDraft,
    assistantText: buildConfirmationMessage(newDraft, lang, RELATION_ORDER),
    extractedByModel: extraction.extractedByModel,
    explainedByModel: false,
  });
}
