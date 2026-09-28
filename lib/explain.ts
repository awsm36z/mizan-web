// EXPLAIN's deterministic template path — ported verbatim from the
// validated HTML prototype's `explainResult()` (per-row sentence templates,
// SENTENCE_TMPL/ZERO_TMPL, and classLabel()). This is the ONLY explanation
// path in the demo; in this Next.js build it becomes the guaranteed
// fallback lib/llm.ts always has available, and the one it always falls
// back to whenever a model-written explanation fails validation against
// computeShares()'s own numbers (see lib/llm.ts's header comment).

import { ComputeResult, Lang, Relation, ShareClass } from "./types";
import { RELATION_LABELS, SENTENCE_TMPL, ZERO_TMPL, classLabel } from "./i18n";

export interface ExplainedRow {
  relation: Relation;
  count: number;
  cls: ShareClass;
  share: [number, number];
  sentence: string;
  article: string;
}

export function explainResult(result: ComputeResult, lang: Lang): ExplainedRow[] {
  const rows: ExplainedRow[] = [];
  for (const l of result.lines) {
    const count = l.count || 1;
    const relLabel = RELATION_LABELS[l.relation][lang] + (count > 1 ? ` ×${count}` : "");
    const label = classLabel(l.cls, lang, result.raddApplied && l.cls === "fardh");
    const [n, d] = l.share;
    const sentence = n === 0 ? ZERO_TMPL[lang](relLabel, label) : SENTENCE_TMPL[lang](relLabel, n, d, label);
    rows.push({ relation: l.relation, count, cls: l.cls, share: l.share, sentence, article: l.article || "" });
  }
  return rows;
}

/** Deterministic EXPLAIN template: the per-row sentences joined into one
 * paragraph, exactly what the HTML prototype's computed card showed under
 * the shares table. */
export function templateExplanation(result: ComputeResult, lang: Lang): string {
  return explainResult(result, lang)
    .map((r) => r.sentence)
    .join(" ");
}
