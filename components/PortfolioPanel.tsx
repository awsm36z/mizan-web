"use client";

// "The Mizan platform — what's next" cross-sell panel — ported from
// renderPortfolioPanel() in the HTML prototype: the 4-product roadmap
// (Calculate/Pro/Family/Verify) with Live/Coming soon tags, the two
// waitlist-trigger buttons, and links out to the business plan and pitch
// deck. Those two links point at the same published Artifact URLs the
// source file used (BUSINESS_PLAN_URL / PITCH_DECK_URL in lib/i18n.ts) —
// in a real production deployment they'd point at wherever that plan/deck
// is actually published from Mizan's own domain.

import { useState } from "react";
import { useLang } from "./LangProvider";
import { t, BUSINESS_PLAN_URL, PITCH_DECK_URL } from "@/lib/i18n";
import { WaitlistModal } from "./WaitlistModal";

interface Product {
  nameKey: Parameters<typeof t>[1];
  descKey: Parameters<typeof t>[1];
  live: boolean;
}

const PRODUCTS: Product[] = [
  { nameKey: "productCalculateLabel", descKey: "productCalculateDesc", live: true },
  { nameKey: "productProLabel", descKey: "productProDesc", live: false },
  { nameKey: "productFamilyLabel", descKey: "productFamilyDesc", live: false },
  { nameKey: "productVerifyLabel", descKey: "productVerifyDesc", live: false },
];

export function PortfolioPanel() {
  const { lang } = useLang();
  const [waitlistKind, setWaitlistKind] = useState<"adoul" | "family" | null>(null);

  return (
    <details className="demo-note" id="portfolioNote">
      <summary>{t(lang, "portfolioSummary")}</summary>
      <p style={{ margin: "8px 0 0" }}>{t(lang, "portfolioIntro")}</p>

      <div className="portfolio-roadmap">
        {PRODUCTS.map((p) => (
          <div className="portfolio-chip" key={p.nameKey}>
            <div className="pc-name">
              <span>{t(lang, p.nameKey)}</span>
              <span className={p.live ? "pc-live" : "pc-soon"}>{t(lang, p.live ? "tagLive" : "tagComingSoon")}</span>
            </div>
            <div className="pc-desc">{t(lang, p.descKey)}</div>
          </div>
        ))}
      </div>

      <div className="portfolio-actions">
        <button type="button" className="btn secondary" onClick={() => setWaitlistKind("adoul")}>
          {t(lang, "joinAdoulWaitlistBtn")}
        </button>
        <button type="button" className="btn secondary" onClick={() => setWaitlistKind("family")}>
          {t(lang, "joinFamilyWaitlistBtn")}
        </button>
      </div>

      <div className="portfolio-links">
        <a href={BUSINESS_PLAN_URL} target="_blank" rel="noopener noreferrer">
          {t(lang, "readBusinessPlanLink")}
        </a>
        <a href={PITCH_DECK_URL} target="_blank" rel="noopener noreferrer">
          {t(lang, "readPitchDeckLink")}
        </a>
      </div>

      {waitlistKind && <WaitlistModal lang={lang} kind={waitlistKind} onClose={() => setWaitlistKind(null)} />}
    </details>
  );
}
