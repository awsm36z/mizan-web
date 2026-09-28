// Tests for lib/extract.ts's deterministic EXTRACT fallback, across all
// four languages, including the specific double-counting guarantee the
// master spec calls out (a longer trigger phrase like French "sœur
// germaine" must never also match via its shorter substring "sœur").

import { describe, expect, it } from "vitest";
import { extractDraft } from "../lib/extract";
import { EMPTY_DRAFT } from "../lib/types";

describe("extractDraft — English", () => {
  it("counts a simple sentence with a number word before each noun", () => {
    const draft = extractDraft("my wife, one son, and two daughters", "en", EMPTY_DRAFT);
    expect(draft.wife).toBe(1);
    expect(draft.son).toBe(1);
    expect(draft.daughter).toBe(2);
    expect(draft.husband).toBe(0);
    expect(draft.father).toBe(0);
    expect(draft.mother).toBe(0);
    expect(draft.full_brother).toBe(0);
    expect(draft.full_sister).toBe(0);
  });
});

describe("extractDraft — French", () => {
  it("counts a simple sentence with a number word before each noun", () => {
    const draft = extractDraft("mon épouse, un fils et deux filles", "fr", EMPTY_DRAFT);
    expect(draft.wife).toBe(1);
    expect(draft.son).toBe(1);
    expect(draft.daughter).toBe(2);
  });

  it("does not double-count a longer trigger phrase via its shorter substring (sœur germaine vs sœur)", () => {
    const draft = extractDraft("ma sœur germaine et mon frère", "fr", EMPTY_DRAFT);
    // Without the longest-phrase-first + "consumed" word-position guard,
    // "sœur germaine" would count once as itself (full_sister += 1) and
    // AGAIN via the bare "sœur" trigger also matching those same two
    // words (full_sister += 1 again), silently doubling to 2.
    expect(draft.full_sister).toBe(1);
    expect(draft.full_brother).toBe(1);
  });
});

describe("extractDraft — Modern Standard Arabic (dual-word counting)", () => {
  it("reads the grammatical dual as 'two' directly from the word itself", () => {
    // "زوجتي وابن واحد وبنتان" = "my wife, one son, and two daughters"
    // (a STARTER_PHRASES example) — بنتان is the dual form of بنت and
    // encodes "two daughters" as a single word, not a numeral + noun pair.
    const draft = extractDraft("زوجتي وابن واحد وبنتان", "ar", EMPTY_DRAFT);
    expect(draft.wife).toBe(1);
    expect(draft.son).toBe(1);
    expect(draft.daughter).toBe(2);
  });

  it("strips the attached و/ف conjunction prefix before matching", () => {
    // "وأخت" ("and a sister") — the leading و is glued directly onto the
    // noun with no space, and must be stripped before أخت (full_sister)
    // is recognized as a trigger.
    const draft = extractDraft("أب وأخت", "ar", EMPTY_DRAFT);
    expect(draft.father).toBe(1);
    expect(draft.full_sister).toBe(1);
  });
});

describe("extractDraft — Moroccan Darija", () => {
  it("counts a number word placed before the noun (unlike MSA, Darija drops the dual)", () => {
    // "جوج بنات" = "two daughters": جوج is a standalone number word
    // preceding the noun, not a dual form encoded in the noun itself.
    const draft = extractDraft("مرتي وولد واحد وجوج بنات", "dar", EMPTY_DRAFT);
    expect(draft.wife).toBe(1);
    expect(draft.son).toBe(1);
    expect(draft.daughter).toBe(2);
  });

  it("defaults a bare plural with no preceding number word to 2", () => {
    // "بنات" (daughters, plural) with nothing preceding it that names a
    // count is a genuine ambiguity in spoken Darija ("some daughters") —
    // the documented, honest behavior is to default to 2 rather than
    // guess higher.
    //
    // Note: "ولاد" (sons, plural) would be the more obvious word to use
    // here, but it exposes a real, pre-existing quirk in the frozen
    // lib/extract.ts this test deliberately avoids rather than papers
    // over: stripArabicConjunction() strips ANY leading و longer than 3
    // characters except an explicit two-word exception list, with no way
    // to tell a genuine word-initial و (as in ولاد) apart from the
    // attached "and" conjunction — so "ولاد" always becomes "لاد" and
    // never matches DARIJA_TRIGGERS.son at all. "بنات"/"خوت"/"خواتي" don't
    // start with و, so they aren't affected. See README's "judgment
    // calls" for the same note.
    const draft = extractDraft("عندي بنات", "dar", EMPTY_DRAFT);
    expect(draft.daughter).toBe(2);
  });

  it("caps single-occupancy relations (husband/wife/father/mother) at 1 regardless of repetition", () => {
    const draft = extractDraft("بويا بويا", "dar", EMPTY_DRAFT);
    expect(draft.father).toBe(1);
  });
});

describe("extractDraft — merges onto an existing draft across turns", () => {
  it("adds to counts already accumulated rather than replacing them", () => {
    const first = extractDraft("my wife and one son", "en", EMPTY_DRAFT);
    const second = extractDraft("and two daughters", "en", first);
    expect(second.wife).toBe(1);
    expect(second.son).toBe(1);
    expect(second.daughter).toBe(2);
  });
});
