"use client";

// The free-calculation-vs-paid-document pricing gate — ported from
// openPricingGate() in the HTML prototype. No real payment is collected
// (see pricingGateDemoNote's own copy); clicking Continue unlocks the
// draft document overlay for this session.

import type { Lang } from "@/lib/types";
import { t } from "@/lib/i18n";

export function PricingGateModal({
  lang,
  onCancel,
  onContinue,
}: {
  lang: Lang;
  onCancel: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>{t(lang, "pricingGateTitle")}</h3>
        <div className="modal-sub">{t(lang, "pricingGateSub")}</div>
        <div className="price-rows">
          <div className="price-row">
            <span className="pr-name">{t(lang, "pricingGateFreeLabel")}</span>
            <span className="pr-price">{t(lang, "pricingGateFreePrice")}</span>
          </div>
          <div className="price-row highlight">
            <span className="pr-name">{t(lang, "pricingGatePaidLabel")}</span>
            <span className="pr-price">{t(lang, "pricingGatePaidPrice")}</span>
          </div>
        </div>
        <div className="modal-demo-note">{t(lang, "pricingGateDemoNote")}</div>
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onCancel}>
            {t(lang, "pricingGateCancelBtn")}
          </button>
          <button type="button" className="btn primary" onClick={onContinue}>
            {t(lang, "pricingGateContinueBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
