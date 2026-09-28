"use client";

// The draft Iratha / heirship-statement generator — ported from
// openDocumentOverlay() in the HTML prototype: doc type toggle (Iratha vs
// Iratha+Fardiya), the 11-state status pill (STATUS_KEYS), decedent
// identity fields, the editable-with-audit-trail shares table, blank
// register-information fields (left for the Adoul office to complete),
// repeatable witness cards, the Adoul review/signature-status section,
// the amendment ("generate correction") flow, and Print/Email/WhatsApp.
//
// Print/Email/WhatsApp are real, working actions in this standalone
// Next.js app (window.print(), a mailto: link, a wa.me link) — the source
// comment's caveat about "nothing sent anywhere" was about the sandboxed
// Artifact iframe the prototype ran in; here they behave exactly the way
// the buttons look like they should.
//
// "Generate correction" in the source literally created a brand-new
// overlay (a bareword `openDocumentOverlay(result, rows, {ref,
// decedentName})` call) referencing the instrument it replaces — so all
// fields reset to blank except the reference to the prior document. Here
// that's reproduced by remounting <DocumentOverlayContent> under a fresh
// React key with an `amendmentOf` prop, rather than trying to selectively
// clear ~20 pieces of state by hand.

import { useMemo, useState } from "react";
import type { ComputeResult, Lang } from "@/lib/types";
import { RELATION_LABELS, STATUS_KEYS, SIGNATURE_STATUS_KEYS, TABLE_HEAD_LABELS, t, type UiKey } from "@/lib/i18n";
import { buildDocPlainText, buildDocRef, formatDocDate, type DocRow } from "@/lib/docText";

interface AmendmentRef {
  ref: string;
  decedentName: string;
}

interface WitnessRecord {
  id: number;
  name: string;
  cin: string;
  address: string;
  occupation: string;
  relation: string;
  date: string;
  statement: string;
}

const REGISTER_FIELD_KEYS: Array<[UiKey, string]> = [
  ["registerActNumberLabel", "actNumber"],
  ["registerPageLabel", "page"],
  ["registerKunnashLabel", "kunnash"],
  ["registerKunnashNumberLabel", "kunnashNumber"],
  ["registerEstateRegisterLabel", "estateRegister"],
  ["registerInclusionDateLabel", "inclusionDate"],
  ["registerDivisionLabel", "division"],
  ["registerCourtLabel", "court"],
  ["registerCityLabel", "city"],
];

function emptyRegisterFields(): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [, id] of REGISTER_FIELD_KEYS) obj[id] = "";
  return obj;
}

function openExternalLink(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function docRows(result: ComputeResult): DocRow[] {
  return result.lines.map((l) => ({ relation: l.relation, count: l.count, share: l.share, article: l.article }));
}

function shareString(share: [number, number]): string {
  const [n, d] = share;
  return d === 1 ? `${n}` : `${n}/${d}`;
}

let witnessIdCounter = 0;

function DocumentOverlayContent({
  lang,
  result,
  onClose,
  amendmentOf,
  onGenerateAmendment,
}: {
  lang: Lang;
  result: ComputeResult;
  onClose: () => void;
  amendmentOf: AmendmentRef | null;
  onGenerateAmendment: (ref: string, decedentName: string) => void;
}) {
  const rows = useMemo(() => docRows(result), [result]);
  const [h0, h1, h2, h3] = TABLE_HEAD_LABELS[lang];

  const [ref] = useState(() => buildDocRef());
  const [preparedOn] = useState(() => formatDocDate(new Date()));
  const [docType, setDocType] = useState<"docTypeIrathaFardiya" | "docTypeIratha">("docTypeIrathaFardiya");
  const [status, setStatus] = useState<UiKey>(STATUS_KEYS[0]);
  const [signatureStatus, setSignatureStatus] = useState<UiKey>(SIGNATURE_STATUS_KEYS[0]);

  const [decedentNameAr, setDecedentNameAr] = useState("");
  const [decedentNameLat, setDecedentNameLat] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [motherName, setMotherName] = useState("");
  const [cin, setCin] = useState("");
  const [dateOfDeath, setDateOfDeath] = useState("");
  const [deathCertNumber, setDeathCertNumber] = useState("");

  const [register, setRegister] = useState<Record<string, string>>(emptyRegisterFields);
  const [witnesses, setWitnesses] = useState<WitnessRecord[]>([]);

  const [adoulName, setAdoulName] = useState("");
  const [adoulLicense, setAdoulLicense] = useState("");
  const [adoulDate, setAdoulDate] = useState("");
  const [notes, setNotes] = useState("");

  const originalShares = useMemo(() => rows.map((r) => shareString(r.share)), [rows]);
  const [shareValues, setShareValues] = useState<string[]>(originalShares);
  const [shareOverridden, setShareOverridden] = useState<boolean[]>(rows.map(() => false));
  const [versionLog, setVersionLog] = useState<string[]>([]);

  function logChange(msg: string) {
    setVersionLog((log) => [...log, `${formatDocDate(new Date())} — ${msg}`]);
  }

  const includeFardiya = docType === "docTypeIrathaFardiya";

  function collectFields() {
    const overriddenShares: Record<number, string> = {};
    shareValues.forEach((v, idx) => {
      if (v.trim() !== originalShares[idx]) overriddenShares[idx] = v.trim();
    });
    return {
      docTypeText: t(lang, docType),
      includeFardiya,
      statusText: t(lang, status),
      isAmendment: !!amendmentOf,
      referencedRef: amendmentOf ? amendmentOf.ref : "",
      decedentNameAr: decedentNameAr.trim(),
      decedentNameLat: decedentNameLat.trim(),
      fatherName: fatherName.trim(),
      motherName: motherName.trim(),
      cin: cin.trim(),
      dateOfDeath: dateOfDeath.trim(),
      deathCertNumber: deathCertNumber.trim(),
      preparedOn,
      ref,
      register: {
        actNumber: register.actNumber.trim(),
        page: register.page.trim(),
        kunnash: register.kunnash.trim(),
        kunnashNumber: register.kunnashNumber.trim(),
        estateRegister: register.estateRegister.trim(),
        inclusionDate: register.inclusionDate.trim(),
        division: register.division.trim(),
        court: register.court.trim(),
        city: register.city.trim(),
      },
      witnesses: witnesses.map((w) => ({
        name: w.name.trim(),
        cin: w.cin.trim(),
        relation: w.relation.trim(),
        statement: w.statement.trim(),
      })),
      adoulName: adoulName.trim(),
      adoulLicense: adoulLicense.trim(),
      adoulDate: adoulDate.trim(),
      notes: notes.trim(),
      signatureStatusText: t(lang, signatureStatus),
      overriddenShares,
      versionLog,
    };
  }

  function handleEmail() {
    const text = buildDocPlainText(lang, rows, collectFields());
    const subject = `${t(lang, "docTitle")} — ${ref}`;
    openExternalLink(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`);
  }
  function handleWhatsApp() {
    const text = buildDocPlainText(lang, rows, collectFields());
    openExternalLink(`https://wa.me/?text=${encodeURIComponent(text)}`);
  }

  function addWitness() {
    witnessIdCounter += 1;
    setWitnesses((w) => [
      ...w,
      { id: witnessIdCounter, name: "", cin: "", address: "", occupation: "", relation: "", date: "", statement: "" },
    ]);
  }
  function removeWitness(id: number) {
    setWitnesses((w) => w.filter((r) => r.id !== id));
  }
  function updateWitness(id: number, patch: Partial<WitnessRecord>) {
    setWitnesses((w) => w.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function fieldBlock(labelKey: UiKey, input: React.ReactNode) {
    return (
      <div className="doc-field-block" key={labelKey}>
        <label>{t(lang, labelKey)}</label>
        {input}
      </div>
    );
  }

  return (
    <div className="doc-overlay">
      <div className="doc-toolbar">
        <button type="button" className="btn secondary" onClick={onClose}>
          {t(lang, "closeDocBtn")}
        </button>
        <div className="doc-toolbar-actions">
          <button type="button" className="btn secondary" onClick={() => window.print()}>
            {t(lang, "printBtn")}
          </button>
          <button type="button" className="btn secondary" onClick={handleEmail}>
            {t(lang, "emailBtn")}
          </button>
          <button type="button" className="btn primary" onClick={handleWhatsApp}>
            {t(lang, "whatsappBtn")}
          </button>
        </div>
      </div>

      <div className="doc-page">
        <div className="doc-banner">
          <p>{t(lang, "docBannerLine1")}</p>
          <p>{t(lang, "docBannerLine2")}</p>
        </div>

        <div className="doc-head">
          <h2 className="doc-title">
            {t(lang, "docTitle")}
            <span className="doc-status-pill">{t(lang, status)}</span>
          </h2>
          <div className="doc-kicker">{amendmentOf ? t(lang, "amendmentKicker") : t(lang, "docKicker")}</div>
          {amendmentOf && (
            <div className="doc-kicker">
              {t(lang, "referencedDocLabel")}: {amendmentOf.ref}
            </div>
          )}
        </div>

        <div className="doc-meta">
          {t(lang, "preparedOnLabel")}: {preparedOn} &nbsp;·&nbsp; {t(lang, "refLabel")}: {ref}
        </div>

        <div className="doc-section doc-type-row">
          {fieldBlock(
            "docTypeLabel",
            <select className="doc-select" value={docType} onChange={(e) => setDocType(e.target.value as any)}>
              <option value="docTypeIrathaFardiya">{t(lang, "docTypeIrathaFardiya")}</option>
              <option value="docTypeIratha">{t(lang, "docTypeIratha")}</option>
            </select>,
          )}
          {fieldBlock(
            "statusLabel",
            <select
              className="doc-select"
              value={status}
              onChange={(e) => {
                const next = e.target.value as UiKey;
                setStatus(next);
                logChange(`${t(lang, "statusLabel")}: ${t(lang, next)}`);
              }}
            >
              {STATUS_KEYS.map((k) => (
                <option key={k} value={k}>
                  {t(lang, k)}
                </option>
              ))}
            </select>,
          )}
          <p className="doc-status-help">{t(lang, "statusHelpNote")}</p>
        </div>

        <div className="doc-section">
          <div className="doc-grid">
            {fieldBlock(
              "decedentNameArLabel",
              <input
                type="text"
                className="doc-field"
                placeholder={t(lang, "decedentNamePlaceholder")}
                value={decedentNameAr}
                onChange={(e) => setDecedentNameAr(e.target.value)}
              />,
            )}
            {fieldBlock(
              "decedentNameLatLabel",
              <input type="text" className="doc-field" value={decedentNameLat} onChange={(e) => setDecedentNameLat(e.target.value)} />,
            )}
            {fieldBlock("fatherNameLabel", <input type="text" className="doc-field" value={fatherName} onChange={(e) => setFatherName(e.target.value)} />)}
            {fieldBlock("motherNameLabel", <input type="text" className="doc-field" value={motherName} onChange={(e) => setMotherName(e.target.value)} />)}
            {fieldBlock("decedentCinLabel", <input type="text" className="doc-field" value={cin} onChange={(e) => setCin(e.target.value)} />)}
            {fieldBlock(
              "dateOfDeathLabel",
              <input type="text" className="doc-field" placeholder="YYYY-MM-DD" value={dateOfDeath} onChange={(e) => setDateOfDeath(e.target.value)} />,
            )}
            {fieldBlock(
              "deathCertNumberLabel",
              <input type="text" className="doc-field" value={deathCertNumber} onChange={(e) => setDeathCertNumber(e.target.value)} />,
            )}
          </div>
        </div>

        <div className="doc-section">
          <h3>{t(lang, "heirsSectionTitle")}</h3>
          <table className="shares doc-table">
            <thead>
              <tr>
                <th>{h0}</th>
                {includeFardiya && (
                  <>
                    <th>{h1}</th>
                    <th>{h2}</th>
                    <th>{h3}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const relLabel = RELATION_LABELS[row.relation][lang] + (row.count > 1 ? ` ×${row.count}` : "");
                const [n, d] = row.share;
                return (
                  <tr key={idx}>
                    <td>{relLabel}</td>
                    {includeFardiya && (
                      <>
                        <td>
                          <input
                            type="text"
                            className="doc-share-input"
                            value={shareValues[idx]}
                            onChange={(e) => {
                              const nextVal = e.target.value;
                              setShareValues((vals) => vals.map((v, i) => (i === idx ? nextVal : v)));
                            }}
                            onBlur={(e) => {
                              const changed = e.target.value.trim() !== originalShares[idx];
                              setShareOverridden((flags) => flags.map((f, i) => (i === idx ? changed : f)));
                              if (changed) {
                                logChange(`${relLabel}: ${originalShares[idx]} → ${e.target.value.trim()} (${t(lang, "shareOverrideWarning")})`);
                              }
                            }}
                          />
                          {shareOverridden[idx] && <div className="doc-share-warning">{t(lang, "shareOverrideWarning")}</div>}
                        </td>
                        <td>{((n / d) * 100).toFixed(1)}%</td>
                        <td>{row.article || "—"}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {includeFardiya && <p className="doc-locked-note">{t(lang, "lockedNumbersNote")}</p>}
        </div>

        <div className="doc-section">
          <h3>{t(lang, "lawSectionTitle")}</h3>
          <p>{t(lang, "lawVersionText")}</p>
        </div>

        <div className="doc-section">
          <h3>{t(lang, "registerSectionTitle")}</h3>
          <div className="doc-grid">
            {REGISTER_FIELD_KEYS.map(([labelKey, id]) =>
              fieldBlock(
                labelKey,
                <input
                  type="text"
                  className="doc-field"
                  value={register[id]}
                  onChange={(e) => setRegister((r) => ({ ...r, [id]: e.target.value }))}
                />,
              ),
            )}
          </div>
          <p className="doc-register-note">{t(lang, "registerSectionNote")}</p>
        </div>

        <div className="doc-section">
          <h3>{t(lang, "witnessSectionTitle")}</h3>
          {witnesses.map((w, i) => (
            <div className="doc-witness-card" key={w.id}>
              <div className="doc-witness-head">
                <span>#{i + 1}</span>
                <button type="button" className="btn secondary tiny" onClick={() => removeWitness(w.id)}>
                  {t(lang, "removeWitnessBtn")}
                </button>
              </div>
              <div className="doc-grid">
                {fieldBlock(
                  "witnessNameLabel",
                  <input type="text" className="doc-field" value={w.name} onChange={(e) => updateWitness(w.id, { name: e.target.value })} />,
                )}
                {fieldBlock(
                  "witnessCinLabel",
                  <input type="text" className="doc-field" value={w.cin} onChange={(e) => updateWitness(w.id, { cin: e.target.value })} />,
                )}
                {fieldBlock(
                  "witnessAddressLabel",
                  <input type="text" className="doc-field" value={w.address} onChange={(e) => updateWitness(w.id, { address: e.target.value })} />,
                )}
                {fieldBlock(
                  "witnessOccupationLabel",
                  <input type="text" className="doc-field" value={w.occupation} onChange={(e) => updateWitness(w.id, { occupation: e.target.value })} />,
                )}
                {fieldBlock(
                  "witnessRelationLabel",
                  <input type="text" className="doc-field" value={w.relation} onChange={(e) => updateWitness(w.id, { relation: e.target.value })} />,
                )}
                {fieldBlock(
                  "witnessDateLabel",
                  <input
                    type="text"
                    className="doc-field"
                    placeholder="YYYY-MM-DD"
                    value={w.date}
                    onChange={(e) => updateWitness(w.id, { date: e.target.value })}
                  />,
                )}
              </div>
              <label>{t(lang, "witnessStatementLabel")}</label>
              <textarea
                className="doc-field doc-notes"
                rows={2}
                value={w.statement}
                onChange={(e) => updateWitness(w.id, { statement: e.target.value })}
              />
            </div>
          ))}
          <button type="button" className="btn secondary" onClick={addWitness}>
            {t(lang, "addWitnessBtn")}
          </button>
          <p className="doc-witness-note">{t(lang, "witnessNote")}</p>
        </div>

        <div className="doc-section doc-adoul">
          <h3>{t(lang, "adoulSectionTitle")}</h3>
          <div className="doc-grid">
            {fieldBlock("adoulNameLabel", <input type="text" className="doc-field" value={adoulName} onChange={(e) => setAdoulName(e.target.value)} />)}
            {fieldBlock(
              "adoulLicenseLabel",
              <input type="text" className="doc-field" value={adoulLicense} onChange={(e) => setAdoulLicense(e.target.value)} />,
            )}
            {fieldBlock(
              "adoulDateLabel",
              <input type="text" className="doc-field" placeholder="YYYY-MM-DD" value={adoulDate} onChange={(e) => setAdoulDate(e.target.value)} />,
            )}
          </div>

          <label>{t(lang, "notesLabel")}</label>
          <textarea
            className="doc-field doc-notes"
            rows={3}
            placeholder={t(lang, "notesPlaceholder")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {fieldBlock(
            "signatureStatusLabel",
            <select
              className="doc-select"
              value={signatureStatus}
              onChange={(e) => {
                const next = e.target.value as UiKey;
                setSignatureStatus(next);
                logChange(`${t(lang, "signatureStatusLabel")}: ${t(lang, next)}`);
              }}
            >
              {SIGNATURE_STATUS_KEYS.map((k) => (
                <option key={k} value={k}>
                  {t(lang, k)}
                </option>
              ))}
            </select>,
          )}

          <div className="doc-sign-row">
            <div className="doc-sign-block">
              <div className="doc-sign-line" />
              <span>{t(lang, "signatureLabel")}</span>
            </div>
            <div className="doc-stamp-box">{t(lang, "stampLabel")}</div>
          </div>

          <h3 style={{ marginTop: 6 }}>{t(lang, "versionLogTitle")}</h3>
          <ul className="doc-version-log">
            {versionLog.length === 0 ? (
              <li>{t(lang, "versionLogEmpty")}</li>
            ) : (
              versionLog.map((entry, i) => <li key={i}>{entry}</li>)
            )}
          </ul>
        </div>

        {!amendmentOf && (
          <button
            type="button"
            className="btn secondary"
            onClick={() => onGenerateAmendment(ref, decedentNameAr.trim())}
          >
            {t(lang, "generateAmendmentBtn")}
          </button>
        )}
      </div>
    </div>
  );
}

export function DocumentOverlay({
  lang,
  result,
  onClose,
}: {
  lang: Lang;
  result: ComputeResult;
  onClose: () => void;
}) {
  const [amendmentOf, setAmendmentOf] = useState<AmendmentRef | null>(null);
  const [instanceKey, setInstanceKey] = useState(0);

  return (
    <DocumentOverlayContent
      key={instanceKey}
      lang={lang}
      result={result}
      onClose={onClose}
      amendmentOf={amendmentOf}
      onGenerateAmendment={(ref, decedentName) => {
        setAmendmentOf({ ref, decedentName });
        setInstanceKey((k) => k + 1);
      }}
    />
  );
}
