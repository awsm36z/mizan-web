// POST /api/waitlist — persists a WaitlistEntry (lib/types.ts) to a local
// JSON file store at data/waitlist.json. This replaces the HTML
// prototype's use of the Artifact page's own shared `db` capability
// (window.claude.use("db")), which only exists inside a published Artifact
// iframe; a standalone Next.js app has no such capability, so this route
// is the equivalent server-side persistence for the two waitlist forms
// (Mizan Pro for Adoul offices, Mizan Family for the diaspora).
//
// data/waitlist.json is gitignored (see .gitignore) and created on first
// write. See README.md for how to swap this for a real database
// (Supabase suggested) once this stops being a demo.

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { Lang, WaitlistEntry } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "waitlist.json");
const VALID_LANGS: Lang[] = ["en", "fr", "ar", "dar"];
const VALID_KINDS = ["adoul", "family"];

async function readEntries(): Promise<WaitlistEntry[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeEntries(entries: WaitlistEntry[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(entries, null, 2), "utf8");
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let body: Partial<WaitlistEntry>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  const { kind, name, contact, language } = body;
  if (!kind || !VALID_KINDS.includes(kind)) return badRequest('`kind` must be "adoul" or "family".');
  if (!name || typeof name !== "string" || !name.trim()) return badRequest("`name` is required.");
  if (!contact || typeof contact !== "string" || !contact.trim()) return badRequest("`contact` is required.");
  if (!language || !VALID_LANGS.includes(language)) return badRequest("`language` must be one of en, fr, ar, dar.");

  const entry: WaitlistEntry = {
    kind,
    name: name.trim(),
    contact: contact.trim(),
    extra: typeof body.extra === "string" ? body.extra.trim() : "",
    language,
    at: new Date().toISOString(),
  };

  try {
    const entries = await readEntries();
    entries.push(entry);
    await writeEntries(entries);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not save waitlist entry." }, { status: 500 });
  }
}

export async function GET() {
  const entries = await readEntries();
  return NextResponse.json({ entries });
}
