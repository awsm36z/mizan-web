"use client";

// The computed-shares card — ported from renderComputedCard() in the HTML
// prototype: a confidence badge (standard / named special case / outside
// this demo's scope), a Heir/Share/%/Article table (the exact column set
// and header labels the source used — TABLE_HEAD_LABELS), a short prose
// explanation (server-produced by /api/chat/turn's EXPLAIN step — either
// Claude-written-and-validated or the deterministic template, see
// lib/llm.ts), 'awl/radd/special-case footnotes, and the "Generate
// document" button that opens the pricing gate.
//
// One addition beyond the source's literal table: a small share-class
// chip per row (fardh / asaba / excluded / …), using the already-ported
// SHARE_CLASS_LABELS. The source only ever surfaced share class in the
// prose sentence below the table, not as its own column; a per-row chip
// is added here so the class is visible at a glance without changing the
// table's ported header labels — a presentational judgment call, not new
// copy (see README's "judgment calls").

import type { ComputeResult, Lang } from "@/lib/types";
import {
  CONFIDENCE_BADGE_LABELS,
  RELATION_LABELS,
  SHARE_CLASS_LABELS,
  TABLE_HEAD_LABELS,
  COMPUTED_SUMMARY_TEXT,
  SPECIAL_CASE_FLAG_TEXT,
  AWL_FLAG_TEXT,
  RADD_FLAG_TEXT,
  t,
} from "@/lib/i18n";

function toPercent(n: number, d: number): string {
  return ((n / d) * 100).toFixed(1);
}

export function ComputedCard({
  lang,
  result,
  explanationText,
  onGenerateDocument,
}: {
  lang: Lang;
  result: ComputeResult;
  explanationText?: string;
  onGenerateDocument: () => void;
}) {
  const [h0, h1, h2, h3] = TABLE_HEAD_LABELS[lang];
  const flagBits: string[] = [];
  if (result.specialCase) flagBits.push(SPECIAL_CASE_FLAG_TEXT[lang]);
  if (result.awlApplied) flagBits.push(AWL_FLAG_TEXT[lang]);
  if (result.raddApplied) flagBits.push(RADD_FLAG_TEXT[lang]);

  return (
    <div>
      <div className="bubble">{COMPUTED_SUMMARY_TEXT[lang]}</div>
      <div className="card">
        <span className={"badge " + result.confidence}>{CONFIDENCE_BADGE_LABELS[result.confidence][lang]}</span>

        {result.confidence === "unsupported" ? (
          <div style={{ marginTop: 8 }}>{t(lang, "unsupportedNote")}</div>
        ) : (
          <>
            <table className="shares">
              <thead>
                <tr>
                  <th>{h0}</th>
                  <th>{h1}</th>
                  <th>{h2}</th>
                  <th>{h3}</th>
                </tr>
              </thead>
              <tbody>
                {result.lines.map((row, idx) => {
                  const relLabel = RELATION_LABELS[row.relation][lang] + (row.count > 1 ? ` ×${row.count}` : "");
                  const [n, d] = row.share;
                  return (
                    <tr key={idx}>
                      <td>
                        {relLabel}
                        <div style={{ fontSize: 10.5, color: "var(--ink-soft)", marginTop: 2 }}>
                          {SHARE_CLASS_LABELS[row.cls][lang]}
                        </div>
                      </td>
                      <td>{d === 1 ? `${n}` : `${n}/${d}`}</td>
                      <td>{toPercent(n, d)}%</td>
                      <td>{row.article || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {explanationText && (
              <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6 }}>{explanationText}</div>
            )}

            {flagBits.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--ink-soft)" }}>{flagBits.join(" ")}</div>
            )}

            <button type="button" className="btn secondary doc-gen-btn" onClick={onGenerateDocument}>
              {t(lang, "generateDocBtn")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
