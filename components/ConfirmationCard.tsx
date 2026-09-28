"use client";

// The accumulated-draft confirmation bubble + Confirm/Correct buttons —
// ported from renderConfirmationCard() in the HTML prototype. The message
// text itself (buildConfirmationMessage) is produced server-side by
// /api/chat/turn so the confirm-before-compute gate's wording always
// matches what the API actually validated.

import type { Lang } from "@/lib/types";
import { t } from "@/lib/i18n";

export function ConfirmationCard({
  lang,
  text,
  onConfirm,
  onCorrect,
  disabled,
}: {
  lang: Lang;
  text: string;
  onConfirm: () => void;
  onCorrect: () => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="bubble">{text}</div>
      <div className="confirm-actions">
        <button type="button" className="btn primary" disabled={disabled} onClick={onConfirm}>
          {t(lang, "confirm")}
        </button>
        <button type="button" className="btn secondary" disabled={disabled} onClick={onCorrect}>
          {t(lang, "correct")}
        </button>
      </div>
    </div>
  );
}
