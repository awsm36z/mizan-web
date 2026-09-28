# Mizan — Faraid calculator + draft Iratha generator (Next.js port)

Mizan Calculate is a Morocco-exclusive, trilingual+Darija (English /
French / Modern Standard Arabic / Moroccan Darija) Islamic inheritance
(Faraid) share calculator, with a draft "Iratha" heirship-statement
document generator for a family to bring to their Adoul. This repository
is a production Next.js 14 (App Router, TypeScript) frontend built from a
previously validated HTML/JS chat-interface prototype
(`mizan_chat_artifact.html`).

## What this port is — and is not

The project's earlier phases describe a Python backend (`mizan_api`,
`mizan_engine`) as the eventual production pipeline: Claude via the
Anthropic Messages API with forced structured output for EXTRACT, an
audited/golden-tested Faraid engine for COMPUTE, and a Claude-written,
validated-against-the-engine explanation for EXPLAIN. **That Python source
was not available to port from in this session.** Everything in this
repository is a **faithful TypeScript re-implementation of the same
architectural principles** the HTML prototype and the master spec
describe — not a wrapper, transpilation, or port of the Python source
itself:

- **The confirm-before-compute gate is structural, not textual.** `POST
  /api/chat/turn` (`app/api/chat/turn/route.ts`) rejects with 400 any
  request whose `stage` is `"awaiting_confirmation"` that doesn't carry
  `userAction: "confirm" | "correct"` — enforced by the request shape
  itself, mirroring the described Pydantic validator in `chat_schemas.py`,
  before any extraction or computation runs.
- **EXTRACT is pluggable** (`lib/llm.ts`): with `ANTHROPIC_API_KEY` set, it
  asks Claude for a forced tool-use call and structurally validates the
  result before trusting it; without a key, or if the call/import fails
  for any reason, it falls back to a deterministic keyword/pattern matcher
  (`lib/extract.ts`) ported line-for-line from the HTML prototype — the
  same fallback logic the demo used as its *only* extraction path.
- **EXPLAIN is pluggable and always validated** (`lib/llm.ts`): a
  Claude-written explanation of an *already-computed* result is only ever
  returned if every "n/d" fraction it mentions matches the engine's own
  computed shares exactly; one retry is allowed, and a second mismatch (or
  any failure) falls back to the deterministic per-language template
  (`lib/explain.ts`). An unvalidated model number is never shown to a
  user.
- **COMPUTE is one bounded engine** (`lib/engine.ts`), used everywhere —
  the chat pipeline, the document generator, the tests. Nothing
  recomputes shares independently.

## Scope of the compute engine

`lib/engine.ts` models a specific, bounded subset of Faraid: **husband,
wife, son, daughter, father, mother, and full siblings only**, plus the
generic 'awl (proportional scaling when fixed shares exceed the estate)
and radd (residue return when there's no residuary heir) mechanisms, plus
the one named special case reachable within that relation set —
el-gharâwyn (Art. 366). It does **not** model half-siblings, grandparents,
uncles/nephews, predeceased children (the mandatory bequest), or the other
named special cases described in the project's earlier, fuller rules
corpus. Extending this to a complete engine is explicitly out of scope for
this frontend port.

Article citations are carried over as-is from the validated prototype;
where the underlying rules corpus doesn't resolve an exact sub-article
(e.g. hijab/exclusion's precise triggering clause), the citation stays at
the verified section-title range rather than inventing a sub-number.

## Architecture

```
lib/
  types.ts       Shared types: Lang, Relation, HeirDraft, ChatStage,
                 ChatTurnRequest/Response, ComputeResult, WaitlistEntry…
  engine.ts      computeShares() — the one compute engine (Frac, 'awl,
                 radd, el-gharâwyn). Not modified for this port; ported
                 verbatim from the validated HTML prototype.
  extract.ts     extractDraft() — deterministic keyword/pattern EXTRACT
                 fallback, all 4 languages. Also ported verbatim.
  explain.ts     Deterministic per-language EXPLAIN template — the
                 guaranteed fallback lib/llm.ts always has available.
  llm.ts         Pluggable Anthropic client: forced tool-use EXTRACT,
                 validated-then-fallback EXPLAIN. See header comment.
  i18n.ts        UI_TEXT / STARTER_PHRASES / RELATION_LABELS /
                 SHARE_CLASS_LABELS / STATUS_KEYS / SIGNATURE_STATUS_KEYS,
                 ported verbatim from the HTML source for en/fr/ar/dar.
  docText.ts     buildDocPlainText() — the Email/WhatsApp document body.

app/
  api/chat/turn/route.ts     The collecting -> awaiting_confirmation ->
                             computed state machine.
  api/waitlist/route.ts      Persists WaitlistEntry to data/waitlist.json.
  layout.tsx, page.tsx, globals.css

components/
  LangProvider.tsx    Shared language context; sets html dir/lang.
  LangSwitch.tsx      EN/FR/AR/DAR switch.
  ComposeBar.tsx      Text input + Send + Web Speech API mic button.
  ConfirmationCard.tsx, ComputedCard.tsx
  PricingGateModal.tsx, WaitlistModal.tsx
  DocumentOverlay.tsx  The draft Iratha / Iratha+Fardiya generator.
  PortfolioPanel.tsx   The Mizan platform cross-sell panel.
  ChatShell.tsx        Top-level orchestrator.

tests/
  engine.test.ts   Golden-value tests (hand-derived, cross-checked).
  extract.test.ts  EXTRACT tests across all 4 languages.
```

## Environment variables

| Variable            | Required | Purpose                                                                 |
| -------------------- | -------- | ------------------------------------------------------------------------ |
| `ANTHROPIC_API_KEY`  | No       | Enables the Claude-backed EXTRACT/EXPLAIN paths in `lib/llm.ts`. Without it, the app runs fully on the deterministic fallbacks — no external dependency needed to build, test, or run it. |

`@anthropic-ai/sdk` is declared as an `optionalDependency` in
`package.json` and is loaded via a guarded dynamic `import()` — it does
not need to be installed at all for the app to build and run correctly on
the fallback paths.

## The waitlist store — swapping in a real database

`app/api/waitlist/route.ts` currently persists `WaitlistEntry` records
(from the two waitlist forms — Mizan Pro for Adoul offices, Mizan Family
for the diaspora) to a local, gitignored JSON file at
`data/waitlist.json`, read-modify-write on every submission. This is fine
for a demo but is not concurrency-safe or durable across deployments.

To swap in **Supabase**: create a `waitlist_entries` table matching
`WaitlistEntry` (`kind`, `name`, `contact`, `extra`, `language`, `at`),
replace the `readEntries`/`writeEntries` file I/O in that route with a
Supabase client insert/select (service-role key on the server side only —
never exposed to the browser), and remove `data/waitlist.json` from
`.gitignore`'s relevance (it simply won't be created anymore). No other
file needs to change, since the route's public contract
(`POST { kind, name, contact, extra, language }` → `{ ok: true }`) stays
the same.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm start         # serve the production build
npm test          # vitest run (engine + extract golden-value tests)
npm run test:watch
```

## Judgment calls made during this port

The HTML prototype was the sole source of truth for exact copy, CSS, and
UX flow; a few things were ambiguous, structurally incompatible with a
typed multi-file app, or worth flagging honestly rather than silently
resolving:

1. **`demoBody` split out of `UI_TEXT`.** The source's `UI_TEXT[lang]` was
   otherwise all-string values, with `demoBody` alone being a string
   array. Keeping `UI_TEXT` as `Record<Lang, Record<UiKey, string>>` (so
   TypeScript can check every language object has every key) meant moving
   `demoBody` into its own `DEMO_BODY: Record<Lang, string[]>` export in
   `lib/i18n.ts`. The strings themselves are unchanged.
2. **`ComputedCard`'s table gained a small per-row share-class chip.** The
   source's shares table only ever had Heir/Share/%/Article columns
   (ported exactly, see `TABLE_HEAD_LABELS`), with the share's *class*
   (fardh/asaba/excluded/…) mentioned only in the prose sentence below the
   table. A one-line "class" note was added under each relation name in
   the heir column so the class is visible at a glance, without altering
   the ported header labels themselves.
3. **A confirmed engine limitation, pinned down rather than fixed.**
   Exhaustive tracing of `lib/engine.ts`'s cascade shows that
   `confidence: "unsupported"` is never actually reachable for any valid
   `HeirDraft` within its own 8 modeled relations — every combination
   resolves to a sum of exactly 1 via the fardh/asaba/'awl/radd cascade.
   The real gap found instead: when 'awl is triggered by a spouse +
   descendant with no son/father present, and a full sibling is *also* in
   the draft, that sibling is silently absent from the result (`lines`
   still sums to exactly 1, so the final safety check never fires). This
   is documented and tested in `tests/engine.test.ts` rather than patched
   — `lib/engine.ts` was supplied as an already-validated, frozen port of
   the prototype's own engine, and this port's job was porting the
   frontend around it, not re-auditing the Faraid math.
4. **A confirmed `lib/extract.ts` Darija quirk, worked around in tests,
   not in the source.** `stripArabicConjunction()` strips any leading `و`
   longer than three characters except a two-word exception list, with no
   way to distinguish a genuine word-initial `و` from the attached "and"
   conjunction. This silently breaks the plural `ولاد` ("sons") and the
   number words `واحد`/`وحدة` ("one") specifically — they get stripped
   into non-matching forms. `tests/extract.test.ts`'s bare-plural test
   uses `بنات` instead (unaffected) and documents the `ولاد` case inline;
   `lib/extract.ts` itself was supplied as an already-written fallback
   path and was left untouched.
5. **The business plan / pitch deck links** (`BUSINESS_PLAN_URL` /
   `PITCH_DECK_URL` in `lib/i18n.ts`) point at the same published Artifact
   URLs the source HTML file used. In a real production deployment these
   would point at wherever that plan/deck is actually published from
   Mizan's own domain.
6. **A stray `"computed"` incoming `stage`** on `/api/chat/turn` (which
   the client should never actually send, since it always resets to
   `"collecting"` right after a compute) is treated the same as a fresh
   `"collecting"` turn rather than rejected, since the spec only
   describes structural validation for the `"awaiting_confirmation"` case.
