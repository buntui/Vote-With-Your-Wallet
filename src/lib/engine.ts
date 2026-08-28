import { coverage, interpolationSlack, lookup } from "./grid";
import type {
  Confidence,
  EvidenceStatus,
  Grid,
  ImpactComponent,
  Policy,
  PolicyImpact,
  PriorityFactor,
  Profile,
} from "../types";

/**
 * Probability that a policy at each evidence stage is actually operating and
 * affecting this household's finances.
 *
 * These are stated priors, not measurements. They exist so that a campaign
 * promise cannot outrank an enacted law by claiming a bigger number, and they
 * are exposed in the interface and in METHODOLOGY.md so a reader can disagree
 * with a specific figure without having to reverse-engineer it.
 */
export const IMPLEMENTATION_PRIOR: Record<EvidenceStatus, number> = {
  PROMISE: 0.15,
  PROPOSED: 0.25,
  PASSED: 0.6,
  ENACTED: 0.9,
  IMPLEMENTED: 1.0,
  HISTORICAL: 0.35,
};

export const EVIDENCE_LABEL: Record<EvidenceStatus, string> = {
  PROMISE: "Stated intention",
  PROPOSED: "Bill text exists",
  PASSED: "Approved by a chamber",
  ENACTED: "Signed into law",
  IMPLEMENTED: "Operating now",
  HISTORICAL: "Has operated before",
};

const STAGES: EvidenceStatus[] = ["PROPOSED", "PASSED", "ENACTED", "IMPLEMENTED"];

export function timelinePosition(status: EvidenceStatus): number {
  if (status === "PROMISE") return -1;
  if (status === "HISTORICAL") return STAGES.length - 1;
  return STAGES.indexOf(status);
}

export { STAGES };

function assessConfidence(
  policy: Policy,
  slack: number,
  magnitude: number,
  profileComplete: boolean,
): Confidence {
  const reasons: string[] = [];
  let score = 0.5;

  switch (policy.evidence_status) {
    case "IMPLEMENTED":
      score += 0.35;
      reasons.push("The rule is currently in force, so the calculation follows statute rather than a forecast.");
      break;
    case "ENACTED":
      score += 0.25;
      reasons.push("Signed into law, though administration details can still shift the amount.");
      break;
    case "HISTORICAL":
      score += 0.2;
      reasons.push("A materially identical policy has operated before, so the mechanism and the parameters are known.");
      break;
    case "PASSED":
      score += 0.05;
      reasons.push("Approved by one chamber. Final text can change.");
      break;
    case "PROPOSED":
      score -= 0.1;
      reasons.push("Bill text exists but the provisions are not settled.");
      break;
    case "PROMISE":
      score -= 0.25;
      reasons.push("A stated intention with no legislative text. Size and design are unknown.");
      break;
  }

  score += 0.1;
  reasons.push("Computed by a tax and benefit rules engine, not estimated by hand.");

  const relSlack = magnitude > 0 ? slack / Math.max(magnitude, 1) : 0;
  if (relSlack > 0.25) {
    score -= 0.15;
    reasons.push("Your income sits near a credit phase-in or phase-out edge, where a small income change moves the result a lot.");
  }

  if (policy.assumptions.length >= 2) {
    score -= 0.05;
    reasons.push(`Rests on ${policy.assumptions.length} stated modelling assumptions.`);
  }

  if (!profileComplete) {
    score -= 0.1;
    reasons.push("Some profile fields are missing, so the household shape is partly assumed.");
  }

  score = Math.max(0.05, Math.min(0.98, score));
  const level: Confidence["level"] = score >= 0.72 ? "high" : score >= 0.45 ? "medium" : "low";
  return { level, score, reasons };
}

function roundToEvidence(value: number, confidence: Confidence): { low: number; high: number } {
  // Wider band where confidence is lower. Never present a single figure as if
  // the evidence supports the last dollar of it.
  const width = confidence.level === "high" ? 0.08 : confidence.level === "medium" ? 0.2 : 0.45;
  const span = Math.abs(value) * width;
  const step = Math.abs(value) > 2000 ? 50 : Math.abs(value) > 400 ? 25 : 5;
  const r = (x: number) => Math.round(x / step) * step;
  return { low: r(value - span), high: r(value + span) };
}

export function evaluatePolicy(grid: Grid, profile: Profile, policy: Policy): PolicyImpact {
  const cov = coverage(grid, profile);
  if (!cov.supported) {
    return {
      policy,
      estimated: 0,
      low: 0,
      high: 0,
      expectedValue: 0,
      implementationProbability: IMPLEMENTATION_PRIOR[policy.evidence_status],
      confidence: { level: "low", score: 0, reasons: [cov.reason] },
      breakdown: [],
      applies: false,
      notApplicableReason: cov.reason,
    };
  }

  const baseNet = lookup(grid, profile, "baseline", "household_net_income");
  const reformNet = lookup(grid, profile, policy.id, "household_net_income");
  const estimated = reformNet - baseNet;

  const baseTax = lookup(grid, profile, "baseline", "household_tax");
  const reformTax = lookup(grid, profile, policy.id, "household_tax");
  const baseBen = lookup(grid, profile, "baseline", "household_benefits");
  const reformBen = lookup(grid, profile, policy.id, "household_benefits");

  const breakdown: ImpactComponent[] = [];
  const taxDelta = baseTax - reformTax;
  const benDelta = reformBen - baseBen;
  if (Math.abs(taxDelta) >= 1) {
    breakdown.push({
      label: "Tax and refundable credits",
      amount: taxDelta,
      mechanism: "tax_liability",
      order: "direct",
    });
  }
  if (Math.abs(benDelta) >= 1) {
    breakdown.push({
      label: "Means-tested benefits",
      amount: benDelta,
      mechanism: "benefit_amount",
      order: "direct",
    });
  }

  const slack = interpolationSlack(grid, profile, policy.id, "household_net_income");
  const confidence = assessConfidence(policy, slack, Math.abs(estimated), true);
  const { low, high } = roundToEvidence(estimated, confidence);
  const prob = IMPLEMENTATION_PRIOR[policy.evidence_status];

  return {
    policy,
    estimated,
    low,
    high,
    expectedValue: estimated * prob,
    implementationProbability: prob,
    confidence,
    breakdown,
    applies: Math.abs(estimated) >= 1,
    notApplicableReason:
      Math.abs(estimated) < 1
        ? "The mechanism does not reach a household with your income, filing status and dependents."
        : undefined,
  };
}

export function evaluateAll(grid: Grid, profile: Profile): PolicyImpact[] {
  return grid.policies
    .filter((p) => p.is_reform)
    .map((p) => evaluatePolicy(grid, profile, p))
    .sort((a, b) => b.expectedValue - a.expectedValue);
}

/**
 * Double-counting safeguard.
 *
 * Every policy here is measured against the same current-law baseline, so two
 * policies that move the same statutory quantity overlap and their dollar
 * figures cannot be added. Rather than silently summing, this reports which
 * mechanisms collide and refuses to produce a combined total for them.
 *
 * A true combined figure requires simulating the policies jointly in the
 * pipeline, which is a build-time change, not something the browser can fake.
 */
export function overlapWarnings(impacts: PolicyImpact[]): string[] {
  const seen = new Map<string, string[]>();
  for (const impact of impacts) {
    if (!impact.applies) continue;
    for (const c of impact.breakdown) {
      const list = seen.get(c.mechanism) ?? [];
      list.push(impact.policy.name);
      seen.set(c.mechanism, list);
    }
  }
  const out: string[] = [];
  for (const [mechanism, names] of seen) {
    if (names.length > 1) {
      out.push(
        `${names.join(" and ")} both change ${mechanism.replace(/_/g, " ")}. ` +
          `Each figure is measured separately against current law, so they cannot be added together.`,
      );
    }
  }
  return out;
}

/** What actually moves this household's money, ranked by annual dollars at stake. */
export function priorities(grid: Grid, profile: Profile): PriorityFactor[] {
  const supported = coverage(grid, profile).supported;
  const tax = supported ? lookup(grid, profile, "baseline", "household_tax") : profile.annualIncome * 0.2;
  const benefits = supported ? lookup(grid, profile, "baseline", "household_benefits") : 0;
  const housing = profile.monthlyHousingCost * 12;
  const transport = profile.monthlyTransportCost * 12;
  const loanInterest = profile.studentLoanBalance * (profile.studentLoanRate / 100);

  const factors: PriorityFactor[] = [
    {
      category: "taxes",
      label: "Taxes",
      exposure: Math.max(tax, 0),
      explanation: `Your total federal, state and payroll tax burden under current law is about $${Math.round(Math.max(tax, 0)).toLocaleString()} a year. Anything that moves rates, brackets or credits moves this.`,
    },
    {
      category: "housing",
      label: "Housing",
      exposure: housing,
      explanation: `You spend about $${housing.toLocaleString()} a year on housing${profile.tenure === "rent" ? " as a renter" : profile.tenure === "own" ? " as an owner" : ""}.`,
    },
    {
      category: "benefits",
      label: "Benefits and credits",
      exposure: benefits,
      explanation:
        benefits > 0
          ? `You appear to qualify for roughly $${Math.round(benefits).toLocaleString()} a year in means-tested programmes, which policy changes can raise or cut.`
          : "At your income the major means-tested programmes do not reach your household, so changes to them mostly will not affect you.",
    },
    {
      category: "transportation",
      label: "Transportation",
      exposure: transport,
      explanation: `About $${transport.toLocaleString()} a year on getting around.`,
    },
    {
      category: "student_debt",
      label: "Student debt",
      exposure: loanInterest,
      explanation:
        profile.studentLoanBalance > 0
          ? `Interest alone runs about $${Math.round(loanInterest).toLocaleString()} a year on a $${profile.studentLoanBalance.toLocaleString()} balance.`
          : "No student loan balance recorded.",
    },
    {
      category: "employment",
      label: "Employment and income",
      exposure:
        profile.employmentStatus === "seeking"
          ? profile.annualIncome > 0
            ? profile.annualIncome
            : 45000
          : profile.annualIncome * 0.05,
      explanation:
        profile.employmentStatus === "seeking"
          ? "You are looking for work, so anything affecting hiring in your labour market is worth more to you than any credit on this list."
          : "You are working, so employment policy matters mainly at the margin.",
    },
  ];

  return factors.filter((f) => f.exposure > 0).sort((a, b) => b.exposure - a.exposure);
}

export function profileIsComplete(p: Partial<Profile>): p is Profile {
  return (
    typeof p.state === "string" &&
    p.state.length === 2 &&
    (p.maritalStatus === "single" || p.maritalStatus === "joint") &&
    typeof p.numChildren === "number" &&
    typeof p.annualIncome === "number" &&
    p.annualIncome >= 0
  );
}
