"use client";

// The "Mizan Pro" (adoul) / "Mizan Family" waitlist form — ported from
// openWaitlistForm() in the HTML prototype. That version saved to the
// published Artifact's own shared `db` capability; this one POSTs to
// /api/waitlist, which persists to data/waitlist.json (see that route's
// header comment for how to swap in a real database).

import { useState } from "react";
import type { Lang } from "@/lib/types";
import { t } from "@/lib/i18n";

export function WaitlistModal({
  lang,
  kind,
  onClose,
}: {
  lang: Lang;
  kind: "adoul" | "family";
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [extra, setExtra] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"none" | "saved" | "offline">("none");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, name: name.trim(), contact: contact.trim(), extra: extra.trim(), language: lang }),
      });
      setResult(res.ok ? "saved" : "offline");
    } catch {
      setResult("offline");
    } finally {
      setSubmitting(false);
    }
  }

  if (result !== "none") {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-card" onClick={(e) => e.stopPropagation()}>
          <h3>{t(lang, "waitlistSuccessTitle")}</h3>
          <div className="wl-success">{t(lang, result === "saved" ? "waitlistSuccessMsg" : "waitlistOfflineNote")}</div>
          <button type="button" className="btn primary" style={{ width: "100%" }} onClick={onClose}>
            {t(lang, "waitlistCloseBtn")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>{t(lang, kind === "adoul" ? "waitlistAdoulTitle" : "waitlistFamilyTitle")}</h3>
        <div className="modal-sub">{t(lang, kind === "adoul" ? "waitlistAdoulSub" : "waitlistFamilySub")}</div>
        <form onSubmit={handleSubmit}>
          <div className="wl-field">
            <label>{t(lang, "waitlistNameLabel")}</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="wl-field">
            <label>{t(lang, "waitlistContactLabel")}</label>
            <input
              type="text"
              required
              placeholder={t(lang, "waitlistContactPlaceholder")}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
          </div>
          <div className="wl-field">
            <label>{t(lang, kind === "adoul" ? "waitlistOfficeLabel" : "waitlistCountryLabel")}</label>
            <input type="text" value={extra} onChange={(e) => setExtra(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn secondary" disabled={submitting} onClick={onClose}>
              {t(lang, "pricingGateCancelBtn")}
            </button>
            <button type="submit" className="btn primary" disabled={submitting}>
              {t(lang, "waitlistSubmitBtn")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
