// buildDocPlainText — ported verbatim (structure and field order) from the
// HTML prototype's buildDocPlainText(rows, fields), used by the document
// overlay's Email and WhatsApp buttons (mailto: / wa.me links, filled with
// this text — see components/DocumentOverlay.tsx).

import type { Lang, Relation } from "./types";
import { RELATION_LABELS, t } from "./i18n";

export interface DocRegisterFields {
  actNumber: string;
  page: string;
  kunnash: string;
  kunnashNumber: string;
  estateRegister: string;
  inclusionDate: string;
  division: string;
  court: string;
  city: string;
}

export interface DocWitness {
  name: string;
  cin: string;
  relation: string;
  statement: string;
}

export interface DocFields {
  docTypeText: string;
  includeFardiya: boolean;
  statusText: string;
  isAmendment: boolean;
  referencedRef: string;
  decedentNameAr: string;
  decedentNameLat: string;
  fatherName: string;
  motherName: string;
  cin: string;
  dateOfDeath: string;
  deathCertNumber: string;
  preparedOn: string;
  ref: string;
  register: DocRegisterFields;
  witnesses: DocWitness[];
  adoulName: string;
  adoulLicense: string;
  adoulDate: string;
  notes: string;
  signatureStatusText: string;
  overriddenShares: Record<number, string>;
  versionLog: string[];
}

export interface DocRow {
  relation: Relation;
  count: number;
  share: [number, number];
  article: string;
}

export function buildDocPlainText(lang: Lang, rows: DocRow[], fields: DocFields): string {
  const req = () => t(lang, "requiredPlaceholder");
  const val = (v: string) => (v ? v : req());
  const lines: string[] = [];

  lines.push(`${fields.docTypeText}${fields.isAmendment ? " — " + t(lang, "amendmentKicker") : ""}`);
  lines.push(t(lang, "docKicker"));
  lines.push(`${t(lang, "statusLabel")}: ${fields.statusText}`);
  if (fields.isAmendment) lines.push(`${t(lang, "referencedDocLabel")}: ${fields.referencedRef}`);
  lines.push("");
  lines.push(t(lang, "docBannerLine1"));
  lines.push(t(lang, "docBannerLine2"));
  lines.push("");
  lines.push(`${t(lang, "decedentNameArLabel")}: ${val(fields.decedentNameAr)}`);
  lines.push(`${t(lang, "decedentNameLatLabel")}: ${fields.decedentNameLat || "—"}`);
  lines.push(`${t(lang, "fatherNameLabel")}: ${fields.fatherName || "—"}`);
  lines.push(`${t(lang, "motherNameLabel")}: ${fields.motherName || "—"}`);
  lines.push(`${t(lang, "decedentCinLabel")}: ${fields.cin || "—"}`);
  lines.push(`${t(lang, "dateOfDeathLabel")}: ${fields.dateOfDeath || "—"}`);
  lines.push(`${t(lang, "deathCertNumberLabel")}: ${fields.deathCertNumber || "—"}`);
  lines.push(`${t(lang, "preparedOnLabel")}: ${fields.preparedOn}`);
  lines.push(`${t(lang, "refLabel")}: ${fields.ref}`);
  lines.push("");
  lines.push(t(lang, "heirsSectionTitle") + ":");
  rows.forEach((row, idx) => {
    const relLabel = RELATION_LABELS[row.relation][lang] + (row.count > 1 ? ` ×${row.count}` : "");
    if (fields.includeFardiya) {
      const [n, d] = row.share;
      const shareStr = d === 1 ? `${n}` : `${n}/${d}`;
      const overridden = fields.overriddenShares[idx];
      const shareText = overridden
        ? `${overridden} ⚠ ${t(lang, "shareOverrideWarning")} (${t(lang, "shareOriginalLabel")}: ${shareStr})`
        : `${shareStr} (${((n / d) * 100).toFixed(1)}%)`;
      lines.push(`  - ${relLabel}: ${shareText}${row.article ? " — Art. " + row.article : ""}`);
    } else {
      lines.push(`  - ${relLabel}`);
    }
  });
  if (fields.includeFardiya) lines.push(t(lang, "lockedNumbersNote"));
  lines.push("");
  lines.push(t(lang, "lawSectionTitle") + ": " + t(lang, "lawVersionText"));
  lines.push("");
  lines.push(t(lang, "registerSectionTitle") + ":");
  lines.push(`  ${t(lang, "registerActNumberLabel")}: ${fields.register.actNumber || req()}`);
  lines.push(`  ${t(lang, "registerPageLabel")}: ${fields.register.page || req()}`);
  lines.push(`  ${t(lang, "registerKunnashLabel")}: ${fields.register.kunnash || req()}`);
  lines.push(`  ${t(lang, "registerKunnashNumberLabel")}: ${fields.register.kunnashNumber || req()}`);
  lines.push(`  ${t(lang, "registerEstateRegisterLabel")}: ${fields.register.estateRegister || req()}`);
  lines.push(`  ${t(lang, "registerInclusionDateLabel")}: ${fields.register.inclusionDate || req()}`);
  lines.push(`  ${t(lang, "registerDivisionLabel")}: ${fields.register.division || req()}`);
  lines.push(`  ${t(lang, "registerCourtLabel")}: ${fields.register.court || req()}`);
  lines.push(`  ${t(lang, "registerCityLabel")}: ${fields.register.city || req()}`);
  if (fields.witnesses.length) {
    lines.push("");
    lines.push(t(lang, "witnessSectionTitle") + ":");
    fields.witnesses.forEach((w, i) => {
      lines.push(`  ${i + 1}. ${w.name || req()} — ${t(lang, "witnessCinLabel")}: ${w.cin || "—"} — ${t(lang, "witnessRelationLabel")}: ${w.relation || "—"}`);
      if (w.statement) lines.push(`     "${w.statement}"`);
    });
  }
  lines.push("");
  lines.push(t(lang, "adoulSectionTitle") + ":");
  lines.push(`${t(lang, "adoulNameLabel")}: ${fields.adoulName || "—"}`);
  lines.push(`${t(lang, "adoulLicenseLabel")}: ${fields.adoulLicense || "—"}`);
  lines.push(`${t(lang, "adoulDateLabel")}: ${fields.adoulDate || "—"}`);
  lines.push(`${t(lang, "notesLabel")}: ${fields.notes || "—"}`);
  lines.push(`${t(lang, "signatureStatusLabel")}: ${fields.signatureStatusText}`);
  if (fields.versionLog.length) {
    lines.push("");
    lines.push(t(lang, "versionLogTitle") + ":");
    for (const entry of fields.versionLog) lines.push(`  - ${entry}`);
  }
  return lines.join("\n");
}

export function formatDocDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function buildDocRef(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MIZAN-DEMO-${datePart}-${rand}`;
}
