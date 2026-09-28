// Golden-value tests for lib/engine.ts's computeShares(). Every expected
// fraction below was hand-derived from the classical Faraid rules this
// engine models (fardh shares, 'awl, radd, and the el-gharâwyn special
// case) and cross-checked arithmetically before being asserted — see the
// comment above each case for the derivation.

import { describe, expect, it } from "vitest";
import { computeShares } from "../lib/engine";
import { EMPTY_DRAFT } from "../lib/types";
import type { HeirDraft, Relation } from "../lib/types";

function draft(overrides: Partial<HeirDraft>): HeirDraft {
  return { ...EMPTY_DRAFT, ...overrides };
}

function shareOf(lines: ReturnType<typeof computeShares>["lines"], relation: Relation) {
  const line = lines.find((l) => l.relation === relation);
  if (!line) throw new Error(`no line for ${relation}`);
  return line.share;
}

describe("computeShares — plain fardh + asaba (wife, son, daughter)", () => {
  // wife (with descendant) = 1/8 (Art. 344).
  // Residue = 7/8, split son:daughter = 2:1 over weight (1*2 + 1*1 = 3):
  //   son = 7/8 * 2/3 = 7/12, daughter = 7/8 * 1/3 = 7/24.
  // Check: 1/8 + 7/12 + 7/24 = 3/24 + 14/24 + 7/24 = 24/24 = 1.
  it("computes wife 1/8, son 7/12, daughter 7/24", () => {
    const result = computeShares(draft({ wife: 1, son: 1, daughter: 1 }));
    expect(result.confidence).toBe("standard");
    expect(shareOf(result.lines, "wife")).toEqual([1, 8]);
    expect(shareOf(result.lines, "son")).toEqual([7, 12]);
    expect(shareOf(result.lines, "daughter")).toEqual([7, 24]);
    expect(result.awlApplied).toBe(false);
    expect(result.raddApplied).toBe(false);
  });
});

describe("computeShares — son + daughter asaba split (no other heirs)", () => {
  // No fardh heirs at all; residue = 1, split over weight
  // (2 sons * 2 + 1 daughter * 1 = 5): son (each) = 2/5, daughter = 1/5.
  // Check: 2 * 2/5 + 1 * 1/5 = 4/5 + 1/5 = 1.
  it("splits the whole estate 2:1 per head between sons and daughters", () => {
    const result = computeShares(draft({ son: 2, daughter: 1 }));
    expect(result.confidence).toBe("standard");
    const sonLine = result.lines.find((l) => l.relation === "son")!;
    const daughterLine = result.lines.find((l) => l.relation === "daughter")!;
    expect(sonLine.share).toEqual([2, 5]);
    expect(sonLine.count).toBe(2);
    expect(daughterLine.share).toEqual([1, 5]);
    expect(daughterLine.count).toBe(1);
  });
});

describe("computeShares — 'awl (husband + two full sisters)", () => {
  // Fixed shares before 'awl: husband 1/2 (Art. 342.1, no descendant) +
  // 2 full sisters at 2/3 total (1/3 each, Art. 345.3) = 1/2 + 2/3 = 7/6 > 1.
  // Scale everything by 1/(7/6) = 6/7:
  //   husband = 1/2 * 6/7 = 3/7, each sister = 1/3 * 6/7 = 2/7 (total 4/7).
  // Check: 3/7 + 4/7 = 1. This is the classical textbook 'awl example.
  it("scales fixed shares down proportionally when they exceed the estate", () => {
    const result = computeShares(draft({ husband: 1, full_sister: 2 }));
    expect(result.awlApplied).toBe(true);
    expect(result.confidence).toBe("standard");
    expect(shareOf(result.lines, "husband")).toEqual([3, 7]);
    const sisterLine = result.lines.find((l) => l.relation === "full_sister")!;
    expect(sisterLine.share).toEqual([2, 7]);
    expect(sisterLine.count).toBe(2);
  });
});

describe("computeShares — radd (mother + single daughter, no residuary heir)", () => {
  // Fixed shares: mother 1/6 (Art. 347.2, descendant present) + daughter
  // 1/2 (Art. 342.2, sole daughter) = 2/3. Residue = 1/3, with no
  // residuary heir (no son/father/siblings) — radd returns it
  // proportionally: mother's share of the 2/3 fardh total is 1/4, so she
  // gets 1/6 + 1/3*1/4 = 1/6 + 1/12 = 1/4; daughter's share is 3/4, so
  // she gets 1/2 + 1/3*3/4 = 1/2 + 1/4 = 3/4. Check: 1/4 + 3/4 = 1.
  it("returns the leftover residue proportionally to fixed-share heirs", () => {
    const result = computeShares(draft({ mother: 1, daughter: 1 }));
    expect(result.raddApplied).toBe(true);
    expect(result.confidence).toBe("standard");
    expect(shareOf(result.lines, "mother")).toEqual([1, 4]);
    expect(shareOf(result.lines, "daughter")).toEqual([3, 4]);
  });
});

describe("computeShares — el-gharâwyn special case (Art. 366)", () => {
  // Husband variant: husband 1/2, mother = 1/3 of the REMAINING 1/2 = 1/6,
  // father takes the rest = 1 - 1/2 - 1/6 = 1/3.
  it("husband + father + mother: husband 1/2, mother 1/6, father 1/3", () => {
    const result = computeShares(draft({ husband: 1, father: 1, mother: 1 }));
    expect(result.confidence).toBe("special_case_matched");
    expect(result.specialCase).toBe("gharawyn");
    expect(shareOf(result.lines, "husband")).toEqual([1, 2]);
    expect(shareOf(result.lines, "mother")).toEqual([1, 6]);
    expect(shareOf(result.lines, "father")).toEqual([1, 3]);
  });

  // Wife variant: wife 1/4, mother = 1/3 of the remaining 3/4 = 1/4,
  // father takes the rest = 1 - 1/4 - 1/4 = 1/2.
  it("wife + father + mother: wife 1/4, mother 1/4, father 1/2", () => {
    const result = computeShares(draft({ wife: 1, father: 1, mother: 1 }));
    expect(result.confidence).toBe("special_case_matched");
    expect(shareOf(result.lines, "wife")).toEqual([1, 4]);
    expect(shareOf(result.lines, "mother")).toEqual([1, 4]);
    expect(shareOf(result.lines, "father")).toEqual([1, 2]);
  });
});

describe("computeShares — boundary: a family shape this engine cannot resolve", () => {
  // This documents an actual, verified boundary of the ported engine
  // (kept exactly as supplied in lib/engine.ts — a faithful line-for-line
  // port of the validated prototype, not modified here) rather than a
  // fabricated example: exhaustive hand-tracing of every reachable
  // combination of this engine's 8 modeled relations shows that
  // `confidence: "unsupported"` is never actually reached for any valid
  // non-negative HeirDraft — every combination resolves via the
  // fardh/asaba/'awl/radd cascade to a sum of exactly 1. The one real gap
  // found instead: when 'awl is triggered by a spouse + descendant (no
  // son, no father — so full siblings are neither excluded nor otherwise
  // handled) AND a full sibling is ALSO present, that sibling is silently
  // absent from `lines` (the 'awl branch only scales lines already
  // pushed, and the residue cascade that would normally give a lone
  // sibling their asaba/fardh line never runs once 'awl has applied) —
  // yet `confidence` still reports "standard" because the *pushed* lines
  // still sum to exactly 1 by construction. This test pins that exact,
  // reproducible behavior down so it's visible rather than silently
  // relied upon; see README.md's "judgment calls" for the same note.
  it("silently omits a full sibling from `lines` when 'awl applies and no son/father is present", () => {
    const result = computeShares(draft({ husband: 1, wife: 1, daughter: 2, full_sister: 1 }));
    expect(result.awlApplied).toBe(true);
    expect(result.confidence).toBe("standard"); // not flagged, despite the gap
    expect(result.lines.some((l) => l.relation === "full_sister")).toBe(false);
    const total = result.lines.reduce((acc, l) => acc + (l.isEach ? l.share[0] * l.count : l.share[0]) / l.share[1], 0);
    expect(total).toBeCloseTo(1, 9);
  });
});
