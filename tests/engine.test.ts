import { describe, expect, it } from "vitest";
import gridData from "../src/data/grid.json";
import {
  IMPLEMENTATION_PRIOR,
  evaluateAll,
  evaluatePolicy,
  overlapWarnings,
  priorities,
} from "../src/lib/engine";
import { cellKey, coverage, lookup } from "../src/lib/grid";
import { money, range } from "../src/lib/format";
import { EMPTY_PROFILE } from "../src/lib/profile";
import type { Grid, Profile } from "../src/types";

const grid = gridData as unknown as Grid;

const profile = (over: Partial<Profile>): Profile => ({ ...EMPTY_PROFILE, ...over });

// Synthetic reference households. These are test fixtures, not real people.
const LOW_INCOME_RENTER_PARENT = profile({
  state: "OH",
  annualIncome: 22_000,
  numChildren: 2,
  tenure: "rent",
  monthlyHousingCost: 950,
});
const HIGH_INCOME_HOMEOWNER = profile({
  state: "CA",
  annualIncome: 550_000,
  maritalStatus: "joint",
  numChildren: 0,
  tenure: "own",
  monthlyHousingCost: 6800,
});
const CHILDLESS_LOW_EARNER = profile({
  state: "TX",
  annualIncome: 14_000,
  numChildren: 0,
  employmentStatus: "seeking",
});

describe("data build integrity", () => {
  it("is real data, not demo data", () => {
    expect(grid.data_status).toBe("REAL");
    expect(grid.engine).toBe("policyengine-us");
  });

  it("has a baseline series for every cell and every policy", () => {
    for (const [key, cell] of Object.entries(grid.cells)) {
      expect(cell.baseline, `${key} baseline`).toBeTruthy();
      for (const policy of grid.policies) {
        const series = cell[policy.id]?.household_net_income;
        expect(series, `${key}/${policy.id}`).toHaveLength(grid.income_points.length);
      }
    }
  });

  it("covers every advertised state, filing status and child count", () => {
    for (const s of grid.coverage.states) {
      for (const m of grid.coverage.marital) {
        for (const c of grid.coverage.children) {
          expect(grid.cells[`${s}|${m}|${c}`], `${s}|${m}|${c}`).toBeTruthy();
        }
      }
    }
  });

  it("baseline net income rises monotonically with earnings", () => {
    const series = grid.cells["OH|single|0"].baseline.household_net_income;
    for (let i = 1; i < series.length; i++) {
      expect(series[i]).toBeGreaterThan(series[i - 1]);
    }
  });
});

describe("grid lookup", () => {
  it("builds the expected cell key and clamps children at three", () => {
    expect(cellKey(profile({ state: "CA", numChildren: 5 }))).toBe("CA|single|3");
  });

  it("returns the exact grid value at a grid point", () => {
    const p = profile({ state: "OH", annualIncome: 50_000 });
    const idx = grid.income_points.indexOf(50_000);
    expect(idx).toBeGreaterThan(-1);
    const expected = grid.cells["OH|single|0"].baseline.household_net_income[idx];
    expect(lookup(grid, p, "baseline", "household_net_income")).toBeCloseTo(expected, 2);
  });

  it("interpolates strictly between the bracketing grid points", () => {
    const p = profile({ state: "OH", annualIncome: 52_000 });
    const v = lookup(grid, p, "baseline", "household_net_income");
    const i = grid.income_points.indexOf(50_000);
    const lo = grid.cells["OH|single|0"].baseline.household_net_income[i];
    const hi = grid.cells["OH|single|0"].baseline.household_net_income[i + 1];
    expect(v).toBeGreaterThan(lo);
    expect(v).toBeLessThan(hi);
  });

  it("reports unsupported jurisdictions instead of approximating them", () => {
    const p = profile({ state: "MT", annualIncome: 50_000 });
    const c = coverage(grid, p);
    expect(c.supported).toBe(false);
    const impacts = evaluateAll(grid, p);
    expect(impacts.every((i) => !i.applies)).toBe(true);
    expect(impacts.every((i) => i.estimated === 0)).toBe(true);
  });
});

describe("policy calculations match statute", () => {
  it("full ARPA child credit refundability is worth $6,600 at zero earnings with two children", () => {
    const p = profile({ state: "OH", annualIncome: 0, numChildren: 2 });
    const policy = grid.policies.find((x) => x.id === "ctc_arpa_restore")!;
    const impact = evaluatePolicy(grid, p, policy);
    // $3,600 (under 6) + $3,000 (6-17) with no earnings phase-in, against a
    // baseline that delivers nothing at zero earnings.
    expect(impact.estimated).toBeCloseTo(6600, 0);
  });

  it("in the flat range the same policy is worth the parameter difference", () => {
    const p = profile({ state: "OH", annualIncome: 60_000, numChildren: 2 });
    const policy = grid.policies.find((x) => x.id === "ctc_arpa_restore")!;
    // ($3,600 - $2,200) + ($3,000 - $2,200) = $2,200
    expect(evaluatePolicy(grid, p, policy).estimated).toBeCloseTo(2200, 0);
  });

  it("the childless EITC expansion does nothing for a household with children", () => {
    const withKids = profile({ state: "OH", annualIncome: 20_000, numChildren: 2 });
    const policy = grid.policies.find((x) => x.id === "eitc_childless_arpa")!;
    expect(Math.abs(evaluatePolicy(grid, withKids, policy).estimated)).toBeLessThan(1);
  });

  it("the childless EITC expansion does reach a low-earning childless worker", () => {
    const policy = grid.policies.find((x) => x.id === "eitc_childless_arpa")!;
    const impact = evaluatePolicy(grid, CHILDLESS_LOW_EARNER, policy);
    expect(impact.estimated).toBeGreaterThan(300);
    expect(impact.applies).toBe(true);
  });

  it("SALT cap repeal does nothing for a standard-deduction household", () => {
    const p = profile({ state: "OH", annualIncome: 45_000 });
    const policy = grid.policies.find((x) => x.id === "salt_cap_repeal")!;
    expect(Math.abs(evaluatePolicy(grid, p, policy).estimated)).toBeLessThan(1);
  });

  it("SALT cap repeal only bites once state and local tax exceeds the cap", () => {
    const policy = grid.policies.find((x) => x.id === "salt_cap_repeal")!;
    // The cap sits above $40,000, so a $300k California joint filer is still
    // under it. This is a finding about current law, not a modelling artefact.
    const under = profile({ state: "CA", annualIncome: 300_000, maritalStatus: "joint" });
    const over = profile({ state: "CA", annualIncome: 550_000, maritalStatus: "joint" });
    expect(Math.abs(evaluatePolicy(grid, under, policy).estimated)).toBeLessThan(1);
    expect(evaluatePolicy(grid, over, policy).estimated).toBeGreaterThan(1000);
  });

  it("no policy in the catalog makes a household worse off than current law by construction", () => {
    // All three reforms are expansions, so a negative figure would indicate a
    // sign error in the pipeline rather than a real distributional finding.
    for (const p of [LOW_INCOME_RENTER_PARENT, HIGH_INCOME_HOMEOWNER, CHILDLESS_LOW_EARNER]) {
      for (const impact of evaluateAll(grid, p)) {
        expect(impact.estimated).toBeGreaterThanOrEqual(-1);
      }
    }
  });
});

describe("the product test from the brief", () => {
  it("two households in the same state with different finances get different rankings", () => {
    const parent = profile({ state: "CA", annualIncome: 35_000, numChildren: 2 });
    const owner = profile({ state: "CA", annualIncome: 550_000, maritalStatus: "joint" });

    const a = evaluateAll(grid, parent).filter((i) => i.applies);
    const b = evaluateAll(grid, owner).filter((i) => i.applies);

    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    expect(a[0].policy.id).not.toBe(b[0].policy.id);
  });

  it("the top priority differs between an employed earner and a jobseeker", () => {
    const employed = priorities(grid, profile({ state: "CA", annualIncome: 90_000 }));
    const seeking = priorities(grid, CHILDLESS_LOW_EARNER);
    expect(employed[0].category).not.toBe(seeking[0].category);
    expect(seeking.some((f) => f.category === "employment")).toBe(true);
  });

  it("every applying impact carries at least one source and one confidence reason", () => {
    for (const impact of evaluateAll(grid, LOW_INCOME_RENTER_PARENT)) {
      expect(impact.policy.sources.length).toBeGreaterThan(0);
      expect(impact.confidence.reasons.length).toBeGreaterThan(0);
      for (const s of impact.policy.sources) {
        expect(s.url).toMatch(/^https:\/\//);
      }
    }
  });
});

describe("uncertainty handling", () => {
  it("expected value is the estimate discounted by the stated prior", () => {
    const impacts = evaluateAll(grid, LOW_INCOME_RENTER_PARENT).filter((i) => i.applies);
    for (const i of impacts) {
      expect(i.implementationProbability).toBe(IMPLEMENTATION_PRIOR[i.policy.evidence_status]);
      expect(i.expectedValue).toBeCloseTo(i.estimated * i.implementationProbability, 6);
      expect(Math.abs(i.expectedValue)).toBeLessThanOrEqual(Math.abs(i.estimated) + 1e-6);
    }
  });

  it("the reported range brackets the point estimate", () => {
    for (const i of evaluateAll(grid, LOW_INCOME_RENTER_PARENT).filter((x) => x.applies)) {
      expect(i.low).toBeLessThanOrEqual(Math.ceil(i.estimated));
      expect(i.high).toBeGreaterThanOrEqual(Math.floor(i.estimated));
    }
  });

  it("a historical policy never earns high confidence on the promise pathway", () => {
    const impacts = evaluateAll(grid, LOW_INCOME_RENTER_PARENT).filter((i) => i.applies);
    expect(impacts.every((i) => i.confidence.score <= 0.98)).toBe(true);
    expect(impacts.every((i) => i.confidence.score >= 0.05)).toBe(true);
  });

  it("flags overlapping mechanisms rather than summing them", () => {
    const impacts = evaluateAll(grid, LOW_INCOME_RENTER_PARENT);
    const warnings = overlapWarnings(impacts);
    const applying = impacts.filter((i) => i.applies);
    if (applying.length > 1) {
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]).toMatch(/cannot be added/);
    }
  });
});

describe("formatting refuses false precision", () => {
  it("rounds large figures to the nearest fifty dollars", () => {
    expect(money(2371.42)).toBe("$2,350");
    expect(money(-3218.9, { sign: true })).toBe("\u2212$3,200");
  });

  it("renders a range when the bounds differ", () => {
    expect(range(1500, 2000)).toContain("\u2013");
  });

  it("collapses a zero-width range to a single figure", () => {
    expect(range(1500, 1500)).toBe("+$1,500");
  });
});

// ---------------------------------------------------------------------------
// Recorded votes
// ---------------------------------------------------------------------------

import officeholderData from "../src/data/officeholders.json";
import { forState, trackRecord } from "../src/lib/record";
import type { OfficeholderData } from "../src/lib/record";

const record = officeholderData as unknown as OfficeholderData;

describe("recorded vote data integrity", () => {
  it("is real data with no promises or ballot claims in it", () => {
    expect(record.data_status).toBe("REAL");
    expect(record.record_scope).toMatch(/no campaign\s+promises/);
  });

  it("reconciles to the official Senate tally of 50-49-1", () => {
    const counts = record.actions.reduce<Record<string, number>>((acc, a) => {
      acc[a.raw_position] = (acc[a.raw_position] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ Yea: 50, Nay: 49, "Not Voting": 1 });
    expect(record.officeholders).toHaveLength(100);
  });

  it("gives every state exactly two senators", () => {
    const byState = new Map<string, number>();
    for (const o of record.officeholders) {
      byState.set(o.state, (byState.get(o.state) ?? 0) + 1);
    }
    expect(byState.size).toBe(50);
    for (const [state, n] of byState) expect(n, state).toBe(2);
  });

  it("maps every vehicle provision to a policy that exists in the catalogue", () => {
    const ids = new Set(grid.policies.map((p) => p.id));
    for (const v of record.vehicles) {
      expect(v.provisions.length).toBeGreaterThan(0);
      for (const p of v.provisions) expect(ids.has(p), p).toBe(true);
      expect(v.page_url).toMatch(/^https:\/\/www\.senate\.gov\//);
      expect(v.bill_url).toMatch(/^https:\/\/www\.congress\.gov\//);
    }
  });

  it("flags omnibus attribution on every bill-level vehicle", () => {
    for (const v of record.vehicles) {
      if (v.attribution === "omnibus") {
        expect(v.attribution_note.length).toBeGreaterThan(80);
      }
    }
  });
});

describe("track record scoring", () => {
  it("values the same vote differently for different households", () => {
    const parent = profile({ state: "OH", annualIncome: 20_000, numChildren: 2 });
    const childless = profile({ state: "OH", annualIncome: 120_000, numChildren: 0 });
    const person = forState(record, "OH")[0];

    const a = trackRecord(grid, record, parent, person);
    const b = trackRecord(grid, record, childless, person);
    expect(Math.abs(a.netAligned)).not.toBeCloseTo(Math.abs(b.netAligned), 0);
  });

  it("signs a yea toward the household and a nay away from it", () => {
    const parent = profile({ state: "OH", annualIncome: 20_000, numChildren: 2 });
    const [first, second] = forState(record, "OH").map((p) => trackRecord(grid, record, parent, p));
    const yea = [first, second].find((r) => r.entries[0].action === "voted_for");
    const nay = [first, second].find((r) => r.entries[0].action === "voted_against");
    expect(yea!.netAligned).toBeGreaterThan(0);
    expect(nay!.netAligned).toBeLessThan(0);
    expect(yea!.netAligned).toBeCloseTo(-nay!.netAligned, 2);
  });

  it("attributes nothing to a member who did not vote", () => {
    const parent = profile({ state: "AK", annualIncome: 20_000, numChildren: 2 });
    const absent = forState(record, "AK").find((o) => o.last_name === "Sullivan")!;
    const r = trackRecord(grid, record, parent, absent);
    expect(r.entries[0].action).toBe("did_not_vote");
    expect(r.netAligned).toBe(0);
    expect(r.votesConsidered).toBe(0);
  });

  it("always carries the omnibus caveat for bill-level votes", () => {
    const parent = profile({ state: "CA", annualIncome: 20_000, numChildren: 2 });
    for (const person of forState(record, "CA")) {
      expect(trackRecord(grid, record, parent, person).attributionCaveat).toBe(true);
    }
  });

  it("attributes nothing at all in an unsupported jurisdiction", () => {
    const p = profile({ state: "MT", annualIncome: 20_000, numChildren: 2 });
    for (const person of forState(record, "MT")) {
      const r = trackRecord(grid, record, p, person);
      expect(r.netAligned).toBe(0);
      expect(r.entries[0].provisions).toHaveLength(0);
    }
  });

  it("produces no score, grade or percentage anywhere in the result", () => {
    const p = profile({ state: "CA", annualIncome: 40_000, numChildren: 1 });
    const r = trackRecord(grid, record, p, forState(record, "CA")[0]);
    expect(Object.keys(r)).toEqual(
      expect.not.arrayContaining(["score", "grade", "rating", "rank", "percentile"]),
    );
  });
});
