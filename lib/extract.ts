// The deterministic EXTRACT fallback — ported line-for-line from the
// validated mizan_chat_artifact.html. This is the same keyword/pattern
// matcher the HTML prototype used as its ONLY extraction path; in this
// Next.js build it becomes the fallback path, used automatically whenever
// ANTHROPIC_API_KEY is not configured (see lib/llm.ts) so the app is
// runnable and testable with zero external dependencies, same as the
// validated demo was.
//
// Two double-counting bugs were found and fixed against this exact logic
// during the HTML prototype's own hand-testing (see the master spec, "A
// bug this phase found in its own new code"): a longer trigger phrase and
// a shorter one both matching the same words (French "sœur germaine" vs
// bare "sœur"). The fix — sort all (relation, phrase) pairs by word-length
// descending and mark matched word positions "consumed" so a shorter
// phrase can never re-match words a longer one already claimed — is
// preserved here exactly, for all four languages.

import { EMPTY_DRAFT, HeirDraft, Lang, Relation } from "./types";

const NUMBER_WORDS: Record<"en" | "fr", Record<string, number>> = {
  en: { one: 1, two: 2, three: 3, four: 4, five: 5, a: 1, an: 1 },
  fr: { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5 },
};

const TRIGGERS: Record<"en" | "fr", Record<Relation, string[]>> = {
  en: {
    husband: ["husband"],
    wife: ["wife"],
    father: ["father", "dad"],
    mother: ["mother", "mom", "mum"],
    son: ["sons", "son"],
    daughter: ["daughters", "daughter"],
    full_brother: ["full brother", "brother"],
    full_sister: ["full sister", "sister"],
  },
  fr: {
    husband: ["époux", "epoux", "mari"],
    wife: ["épouse", "epouse", "femme"],
    father: ["père", "pere"],
    mother: ["mère", "mere"],
    son: ["fils"],
    daughter: ["filles", "fille"],
    full_brother: ["frère germain", "frere germain", "frère", "frere"],
    full_sister: ["sœur germaine", "soeur germaine", "sœur", "soeur"],
  },
};

// Arabic: MSA's grammatical dual encodes "two" directly in the word
// itself (بنتان = "two daughters" as ONE word), and the extremely common
// attached conjunction prefix و ("and") glues onto the next word with no
// space (وابن = "and a son") — a plain whitespace tokenizer would miss
// both. AR_TRIGGERS lists each surface form explicitly with the count it
// already encodes.
const AR_TRIGGERS: Record<Relation, Array<{ p: string; c: number }>> = {
  husband: [{ p: "زوج", c: 1 }],
  wife: [{ p: "زوجة", c: 1 }, { p: "زوجتي", c: 1 }],
  father: [{ p: "أب", c: 1 }, { p: "والد", c: 1 }, { p: "أبي", c: 1 }],
  mother: [{ p: "أم", c: 1 }, { p: "والدة", c: 1 }, { p: "أمي", c: 1 }],
  son: [{ p: "ابن", c: 1 }, { p: "ابني", c: 1 }, { p: "ابنان", c: 2 }, { p: "ابنين", c: 2 }, { p: "أبناء", c: 3 }],
  daughter: [
    { p: "بنت", c: 1 }, { p: "ابنة", c: 1 }, { p: "ابنتي", c: 1 }, { p: "بنتي", c: 1 },
    { p: "بنتان", c: 2 }, { p: "بنتين", c: 2 }, { p: "بنات", c: 3 },
  ],
  full_brother: [{ p: "أخ", c: 1 }, { p: "أخي", c: 1 }, { p: "أخوان", c: 2 }, { p: "أخوين", c: 2 }],
  full_sister: [{ p: "أخت", c: 1 }, { p: "أختي", c: 1 }, { p: "أختان", c: 2 }, { p: "أختين", c: 2 }],
};
const AR_SINGLE_ONLY = new Set<Relation>(["husband", "wife", "father", "mother"]);

// Strips an attached و/ف ("and"/"then") prefix, but only when the word
// isn't already a known word on its own. Several real words begin with و
// (والد "father", ولاد "sons", واحد "one"), so blindly stripping it turns
// them into non-words that never match.
function stripArabicConjunction(word: string, known: Set<string>): string {
  if (known.has(word)) return word;
  if (word.length > 2 && (word[0] === "و" || word[0] === "ف") && known.has(word.slice(1))) {
    return word.slice(1);
  }
  return word;
}

const AR_KNOWN_WORDS = new Set(Object.values(AR_TRIGGERS).flat().map((t) => t.p));

function extractDraftArabic(text: string, currentDraft: HeirDraft): HeirDraft {
  const draft = { ...currentDraft };
  const words = text
    .split(/\s+/)
    .map((w) => w.replace(/[.,!?،؛]/g, ""))
    .map((w) => stripArabicConjunction(w, AR_KNOWN_WORDS));
  for (const word of words) {
    for (const relation of Object.keys(AR_TRIGGERS) as Relation[]) {
      for (const { p, c } of AR_TRIGGERS[relation]) {
        if (word === p) {
          draft[relation] = AR_SINGLE_ONLY.has(relation) ? 1 : draft[relation] + c;
        }
      }
    }
  }
  return draft;
}

// Darija: unlike MSA, everyday spoken Darija drops the grammatical dual,
// so counting works like EN/FR — a separate number word before the noun
// (e.g. "جوج بنات" = "two daughters"), not a single dual word. A bare
// plural with no preceding number defaults to 2 rather than guessing
// higher (documented honestly, same as the HTML demo's "About this demo").
const DARIJA_NUMBER_WORDS: Record<string, number> = {
  "واحد": 1, "وحد": 1, "وحدة": 1,
  "جوج": 2, "زوج": 2,
  "تلاتة": 3, "تلات": 3,
  "ربعة": 4, "ربع": 4,
  "خمسة": 5, "خمس": 5,
};
const DARIJA_TRIGGERS: Record<Relation, string[]> = {
  husband: ["راجلي", "راجل"],
  wife: ["مرتي", "مرا"],
  son: ["ولدي", "ولد", "ولاد"],
  daughter: ["بنتي", "بنت", "بنات"],
  father: ["بويا", "بابا", "والدي"],
  mother: ["يمّا", "يما", "والدتي"],
  full_brother: ["خويا الشقيق", "خويا", "خوت"],
  full_sister: ["ختي الشقيقة", "ختي", "خواتي"],
};
const DARIJA_PLURAL_FORMS = new Set(["ولاد", "بنات", "خوت", "خواتي"]);
const DARIJA_SINGLE_ONLY = new Set<Relation>(["husband", "wife", "father", "mother"]);
const DARIJA_KNOWN_WORDS = new Set([
  ...Object.values(DARIJA_TRIGGERS).flat().flatMap((phrase) => phrase.split(/\s+/)),
  ...Object.keys(DARIJA_NUMBER_WORDS),
]);

function extractDraftDarija(text: string, currentDraft: HeirDraft): HeirDraft {
  const draft = { ...currentDraft };
  const words = text
    .split(/\s+/)
    .map((w) => w.replace(/[.,!?،؛]/g, ""))
    .map((w) => stripArabicConjunction(w, DARIJA_KNOWN_WORDS));

  const allPhrases: Array<{ relation: Relation; phraseWords: string[] }> = [];
  for (const relation of Object.keys(DARIJA_TRIGGERS) as Relation[]) {
    for (const phrase of DARIJA_TRIGGERS[relation]) {
      allPhrases.push({ relation, phraseWords: phrase.split(/\s+/) });
    }
  }
  allPhrases.sort((a, b) => b.phraseWords.length - a.phraseWords.length);

  const consumed = new Array(words.length).fill(false);

  for (const { relation, phraseWords } of allPhrases) {
    for (let i = 0; i <= words.length - phraseWords.length; i++) {
      if (consumed.slice(i, i + phraseWords.length).some(Boolean)) continue;
      if (words.slice(i, i + phraseWords.length).join(" ") !== phraseWords.join(" ")) continue;
      for (let k = i; k < i + phraseWords.length; k++) consumed[k] = true;

      if (DARIJA_SINGLE_ONLY.has(relation)) {
        draft[relation] = 1;
        continue;
      }

      const isBarePlural = phraseWords.length === 1 && DARIJA_PLURAL_FORMS.has(phraseWords[0]);
      let count: number | null = null;
      for (let back = 1; back <= 3; back++) {
        const w = words[i - back];
        if (w === undefined) break;
        const digit = parseInt(w, 10);
        if (!isNaN(digit) && digit > 0 && digit < 20) {
          count = digit;
          break;
        }
        if (DARIJA_NUMBER_WORDS[w] !== undefined) {
          count = DARIJA_NUMBER_WORDS[w];
          break;
        }
      }
      if (count === null) count = isBarePlural ? 2 : 1;
      draft[relation] = draft[relation] + count;
    }
  }
  return draft;
}

function findPrecedingNumber(words: string[], idx: number, lang: "en" | "fr"): number | null {
  const dict = NUMBER_WORDS[lang];
  for (let back = 1; back <= 3; back++) {
    const w = words[idx - back];
    if (w === undefined) break;
    const digit = parseInt(w, 10);
    if (!isNaN(digit) && digit > 0 && digit < 20) return digit;
    if (dict[w] !== undefined) return dict[w];
  }
  return null;
}

function extractDraftLatin(text: string, lang: "en" | "fr", currentDraft: HeirDraft): HeirDraft {
  const draft = { ...currentDraft };
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);

  const triggerSet = TRIGGERS[lang];
  const singleOnly = new Set<Relation>(["husband", "wife", "father", "mother"]);

  const allPhrases: Array<{ relation: Relation; phraseWords: string[] }> = [];
  for (const relation of Object.keys(triggerSet) as Relation[]) {
    for (const phrase of triggerSet[relation]) {
      allPhrases.push({ relation, phraseWords: phrase.split(/\s+/) });
    }
  }
  allPhrases.sort((a, b) => b.phraseWords.length - a.phraseWords.length);

  const consumed = new Array(words.length).fill(false);
  const cleanWords = words.map((w) => w.replace(/[.,!?،؛]/g, ""));

  for (const { relation, phraseWords } of allPhrases) {
    for (let i = 0; i <= cleanWords.length - phraseWords.length; i++) {
      if (consumed.slice(i, i + phraseWords.length).some(Boolean)) continue;
      const slice = cleanWords.slice(i, i + phraseWords.length).join(" ");
      if (slice !== phraseWords.join(" ")) continue;
      for (let k = i; k < i + phraseWords.length; k++) consumed[k] = true;
      const n = findPrecedingNumber(words, i, lang);
      draft[relation] = singleOnly.has(relation) ? 1 : draft[relation] + (n || 1);
    }
  }
  return draft;
}

export function extractDraft(text: string, lang: Lang, currentDraft: HeirDraft = EMPTY_DRAFT): HeirDraft {
  if (lang === "ar") return extractDraftArabic(text, currentDraft);
  if (lang === "dar") return extractDraftDarija(text, currentDraft);
  return extractDraftLatin(text, lang, currentDraft);
}
