// The Mizan compute engine — ported line-for-line from the validated
// mizan_chat_artifact.html (the JS `computeShares` / `Frac` that a Playwright
// suite and hand-verification against the Python engine's golden set
// confirmed correct before this React build began). Two fixes have been
// made since the port: a husband-and-wife draft is rejected as
// unsupported, and residuary siblings left with nothing after 'awl now get
// an explicit zero line instead of disappearing (see tests/engine.test.ts).
//
// SCOPE, stated as plainly here as it was in the HTML prototype: this is a
// bounded subset of Faraid — husband/wife, son/daughter, father, mother,
// and full siblings only, plus the generic 'awl (proportional scaling) and
// radd (residue return) mechanisms, plus the one named special case
// reachable within that relation set (el-gharâwyn, Art. 366). It does NOT
// model half-siblings, grandparents, uncles/nephews, predeceased children /
// the mandatory bequest, or the other 7 named special cases described in
// Phase 01's full rules corpus. Extending this to the full 70-rule engine
// described in the project's earlier phases is Phase 07 backend scope
// (see README.md) — the Python source for that fuller engine was not
// available to port from in this session.
//
// Article citations are the same ones carried into the validated demo,
// sourced from the project's own previously-verified Phase 01 rules
// corpus rather than invented; where that corpus doesn't resolve an exact
// sub-article (hijab/exclusion), the citation stays at the section's
// verified range rather than fabricating precision.

import { EMPTY_DRAFT, HeirDraft, RELATION_ORDER, ShareClass, ShareLine, ComputeResult } from "./types";

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

export class Frac {
  n: number;
  d: number;
  constructor(n: number, d = 1) {
    if (d < 0) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d) || 1;
    this.n = n / g;
    this.d = d / g;
  }
  add(o: Frac): Frac {
    return new Frac(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Frac): Frac {
    return new Frac(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Frac): Frac {
    return new Frac(this.n * o.n, this.d * o.d);
  }
  div(o: Frac): Frac {
    return new Frac(this.n * o.d, this.d * o.n);
  }
  cmp(o: Frac): number {
    return this.n * o.d - o.n * this.d;
  }
  isZero(): boolean {
    return this.n === 0;
  }
  toString(): string {
    return this.d === 1 ? `${this.n}` : `${this.n}/${this.d}`;
  }
  toPercent(): number {
    return (this.n / this.d) * 100;
  }
  toTuple(): [number, number] {
    return [this.n, this.d];
  }
}

interface Line {
  relation: ShareLine["relation"];
  share: Frac;
  cls: ShareClass;
  count?: number;
  isEach?: boolean;
  article: string;
}

export function computeShares(h: HeirDraft): ComputeResult {
  const anyDescendant = h.son > 0 || h.daughter > 0;
  const lines: Line[] = [];
  let unsupported = false;
  let specialCase: "gharawyn" | null = null;

  // A decedent leaves either a husband or a wife, never both. Extraction
  // (keyword or model) can still produce that contradiction, so refuse to
  // compute anything rather than return shares for an impossible family.
  if (h.husband > 0 && h.wife > 0) {
    return { lines: [], confidence: "unsupported", specialCase: null, awlApplied: false, raddApplied: false };
  }

  // ---- el-gharâwyn (Art. 366): husband/wife + father + mother, nothing else ----
  const noSiblings = h.full_brother === 0 && h.full_sister === 0;
  const exactlyOneSpouse = (h.husband > 0) !== (h.wife > 0);
  if (!anyDescendant && noSiblings && h.father > 0 && h.mother > 0 && exactlyOneSpouse) {
    specialCase = "gharawyn";
    if (h.husband > 0) {
      lines.push({ relation: "husband", share: new Frac(1, 2), cls: "special_case", article: "366" });
      const motherShare = new Frac(1, 2).mul(new Frac(1, 3));
      lines.push({ relation: "mother", share: motherShare, cls: "special_case", article: "366" });
      lines.push({ relation: "father", share: new Frac(1, 1).sub(new Frac(1, 2)).sub(motherShare), cls: "special_case", article: "366" });
    } else {
      lines.push({ relation: "wife", share: new Frac(1, 4), cls: "special_case", article: "366" });
      const motherShare = new Frac(3, 4).mul(new Frac(1, 3));
      lines.push({ relation: "mother", share: motherShare, cls: "special_case", article: "366" });
      lines.push({ relation: "father", share: new Frac(1, 1).sub(new Frac(1, 4)).sub(motherShare), cls: "special_case", article: "366" });
    }
    return { lines: serialize(lines), confidence: "special_case_matched", specialCase, awlApplied: false, raddApplied: false };
  }

  // ---- ordinary fardh ----
  if (h.husband > 0) lines.push({ relation: "husband", share: anyDescendant ? new Frac(1, 4) : new Frac(1, 2), cls: "fardh", article: anyDescendant ? "343.1" : "342.1" });
  if (h.wife > 0) lines.push({ relation: "wife", share: anyDescendant ? new Frac(1, 8) : new Frac(1, 4), cls: "fardh", article: anyDescendant ? "344" : "343.2" });

  if (h.daughter > 0 && h.son === 0) {
    if (h.daughter === 1) lines.push({ relation: "daughter", share: new Frac(1, 2), cls: "fardh", count: 1, isEach: true, article: "342.2" });
    else lines.push({ relation: "daughter", share: new Frac(2, 3).mul(new Frac(1, h.daughter)), cls: "fardh", count: h.daughter, isEach: true, article: "345.1" });
  }

  let fatherFixedLine: Line | null = null;
  if (h.father > 0 && anyDescendant) {
    fatherFixedLine = { relation: "father", share: new Frac(1, 6), cls: "fardh", article: "347.1" };
    lines.push(fatherFixedLine);
  }

  const siblingCountForMother = h.full_brother + h.full_sister;
  if (h.mother > 0) {
    const motherGetsSixth = anyDescendant || siblingCountForMother >= 2;
    lines.push({ relation: "mother", share: motherGetsSixth ? new Frac(1, 6) : new Frac(1, 3), cls: "fardh", article: motherGetsSixth ? "347.2" : "346.1" });
  }

  const siblingsExcluded = h.son > 0 || h.father > 0;
  if (siblingsExcluded) {
    // Exact triggering sub-clause within Titre VI (hijab) isn't itemized
    // in Phase 01's rules spec beyond the section's own article range —
    // cited at that range rather than inventing a sub-article.
    if (h.full_brother > 0) lines.push({ relation: "full_brother", share: new Frac(0, 1), cls: "excluded", count: h.full_brother, isEach: true, article: "355-359" });
    if (h.full_sister > 0) lines.push({ relation: "full_sister", share: new Frac(0, 1), cls: "excluded", count: h.full_sister, isEach: true, article: "355-359" });
  } else if (!anyDescendant && h.full_brother === 0 && h.full_sister > 0) {
    if (h.full_sister === 1) lines.push({ relation: "full_sister", share: new Frac(1, 2), cls: "fardh", count: 1, isEach: true, article: "342.4" });
    else lines.push({ relation: "full_sister", share: new Frac(2, 3).mul(new Frac(1, h.full_sister)), cls: "fardh", count: h.full_sister, isEach: true, article: "345.3" });
  }

  // ---- 'awl: fixed shares already exceed the estate ----
  const totalOf = (l: Line): Frac => (l.isEach ? l.share.mul(new Frac(l.count!)) : l.share);
  let sumFardh = lines.reduce((acc, l) => acc.add(totalOf(l)), new Frac(0));
  let awlApplied = false;
  if (sumFardh.cmp(new Frac(1, 1)) > 0) {
    const scale = new Frac(1, 1).div(sumFardh);
    for (const l of lines) l.share = l.share.mul(scale);
    awlApplied = true;
    sumFardh = new Frac(1, 1);
  }

  let residue = new Frac(1, 1).sub(sumFardh);
  let raddApplied = false;

  if (residue.n > 0 && !awlApplied) {
    if (h.son > 0) {
      const totalWeight = h.son * 2 + h.daughter * 1;
      lines.push({ relation: "son", share: residue.mul(new Frac(2, totalWeight)), cls: "asaba", count: h.son, isEach: true, article: "348" });
      if (h.daughter > 0) lines.push({ relation: "daughter", share: residue.mul(new Frac(1, totalWeight)), cls: "asaba_by_other", count: h.daughter, isEach: true, article: "351.1" });
      residue = new Frac(0, 1);
    } else if (h.father > 0) {
      if (fatherFixedLine) {
        fatherFixedLine.share = fatherFixedLine.share.add(residue);
        fatherFixedLine.cls = "fardh";
        fatherFixedLine.article = "347.1 + 348";
      } else {
        lines.push({ relation: "father", share: residue, cls: "asaba", article: "348" });
      }
      residue = new Frac(0, 1);
    } else if (h.daughter > 0 && h.son === 0) {
      if (h.full_brother > 0) {
        const totalWeight = h.full_brother * 2 + h.full_sister * 1;
        lines.push({ relation: "full_brother", share: residue.mul(new Frac(2, totalWeight)), cls: "asaba", count: h.full_brother, isEach: true, article: "348" });
        if (h.full_sister > 0) lines.push({ relation: "full_sister", share: residue.mul(new Frac(1, totalWeight)), cls: "asaba", count: h.full_sister, isEach: true, article: "351.3" });
        residue = new Frac(0, 1);
      } else if (h.full_sister > 0) {
        lines.push({ relation: "full_sister", share: residue.mul(new Frac(1, h.full_sister)), cls: "asaba_with_other", count: h.full_sister, isEach: true, article: "352" });
        residue = new Frac(0, 1);
      }
    } else if (!anyDescendant && h.full_brother > 0) {
      const totalWeight = h.full_brother * 2 + h.full_sister * 1;
      lines.push({ relation: "full_brother", share: residue.mul(new Frac(2, totalWeight)), cls: "asaba", count: h.full_brother, isEach: true, article: "348" });
      if (h.full_sister > 0) lines.push({ relation: "full_sister", share: residue.mul(new Frac(1, totalWeight)), cls: "asaba", count: h.full_sister, isEach: true, article: "351.3" });
      residue = new Frac(0, 1);
    }

    if (residue.n > 0) {
      const fardhLines = lines.filter((l) => l.cls === "fardh");
      const totalFardh = fardhLines.reduce((acc, l) => acc.add(totalOf(l)), new Frac(0));
      if (totalFardh.n > 0) {
        for (const l of fardhLines) {
          const lineTotal = totalOf(l);
          const proportion = lineTotal.div(totalFardh);
          const topUpTotal = residue.mul(proportion);
          l.share = l.isEach ? l.share.add(topUpTotal.mul(new Frac(1, l.count!))) : l.share.add(topUpTotal);
          l.article = l.article + " + 349 (radd)";
        }
        raddApplied = true;
        residue = new Frac(0, 1);
      } else {
        unsupported = true;
      }
    }
  }

  // Residuary siblings who are present but receive nothing because the
  // fixed shares consumed the whole estate (always the case once 'awl has
  // applied) still get an explicit zero line. Without this they would
  // silently vanish from the result while it still summed to exactly 1.
  if (!siblingsExcluded) {
    const hasLine = (r: Line["relation"]) => lines.some((l) => l.relation === r);
    if (h.full_brother > 0 && !hasLine("full_brother")) {
      lines.push({ relation: "full_brother", share: new Frac(0, 1), cls: "asaba", count: h.full_brother, isEach: true, article: "348" });
    }
    if (h.full_sister > 0 && !hasLine("full_sister")) {
      const withBrother = h.full_brother > 0;
      lines.push({
        relation: "full_sister",
        share: new Frac(0, 1),
        cls: withBrother ? "asaba" : "asaba_with_other",
        count: h.full_sister,
        isEach: true,
        article: withBrother ? "351.3" : "352",
      });
    }
  }

  const heirCount = RELATION_ORDER.reduce((n, r) => n + (h[r] || 0), 0);
  const modeledSum = lines.reduce((acc, l) => acc.add(totalOf(l)), new Frac(0));
  if (heirCount > 0 && modeledSum.cmp(new Frac(1, 1)) !== 0 && !unsupported) {
    unsupported = true;
  }

  return {
    lines: serialize(lines),
    confidence: unsupported ? "unsupported" : "standard",
    specialCase,
    awlApplied,
    raddApplied,
  };
}

function serialize(lines: Line[]): ShareLine[] {
  return lines.map((l) => ({
    relation: l.relation,
    share: l.share.toTuple(),
    cls: l.cls,
    count: l.count ?? 1,
    isEach: !!l.isEach,
    article: l.article,
  }));
}

export function draftIsEmpty(draft: HeirDraft): boolean {
  return RELATION_ORDER.every((r) => (draft[r] || 0) === 0);
}

export function mergeDraft(base: HeirDraft, patch: Partial<HeirDraft>): HeirDraft {
  return { ...EMPTY_DRAFT, ...base, ...patch };
}
