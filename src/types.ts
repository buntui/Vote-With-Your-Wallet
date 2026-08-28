/** Domain model. Nothing here is UI. */

export type MaritalStatus = "single" | "joint";
export type Tenure = "rent" | "own" | "other";
export type EmploymentStatus = "employed" | "self_employed" | "seeking" | "not_working" | "retired";

/** Lives in the browser only. Never serialised into a URL, never sent anywhere. */
export interface Profile {
  state: string;
  maritalStatus: MaritalStatus;
  numChildren: number;
  annualIncome: number;
  employmentStatus: EmploymentStatus;
  tenure: Tenure;
  monthlyHousingCost: number;
  studentLoanBalance: number;
  studentLoanRate: number;
  hasVehicle: boolean;
  monthlyTransportCost: number;
}

export type EvidenceStatus =
  | "PROMISE"
  | "PROPOSED"
  | "PASSED"
  | "ENACTED"
  | "IMPLEMENTED"
  | "HISTORICAL";

export interface Source {
  label: string;
  url: string;
  /** 1 = government primary source, 2 = statute or official record, 3 = research, 4 = other. */
  tier: number;
}

export interface Policy {
  id: string;
  name: string;
  short: string;
  is_reform: boolean;
  evidence_status: EvidenceStatus;
  mechanism: string;
  beneficiaries: string[];
  counter_beneficiaries?: string[];
  categories: string[];
  sources: Source[];
  assumptions: string[];
  parameter_changes?: string[];
}

export interface GridCell {
  [policyId: string]: { [variable: string]: number[] };
}

export interface Grid {
  schema_version: number;
  generated_at: string;
  simulation_year: number;
  engine: string;
  data_status: "REAL" | "DEMO";
  coverage: {
    states: string[];
    marital: MaritalStatus[];
    children: number[];
    income_min: number;
    income_max: number;
  };
  grid_assumptions: string[];
  income_points: number[];
  variables: string[];
  policies: Policy[];
  cells: { [key: string]: GridCell };
  content_hash?: string;
}

export type ConfidenceLevel = "high" | "medium" | "low";

export interface Confidence {
  level: ConfidenceLevel;
  /** 0-1. Exposed so the ranking is inspectable, not because it is precise. */
  score: number;
  reasons: string[];
}

/** One policy evaluated against one profile. */
export interface PolicyImpact {
  policy: Policy;
  /** Change in annual household net income vs current law, in dollars. */
  estimated: number;
  /** Reported range. Reflects modelling slack, not a statistical interval. */
  low: number;
  high: number;
  /** estimated x implementation probability. */
  expectedValue: number;
  implementationProbability: number;
  confidence: Confidence;
  breakdown: ImpactComponent[];
  applies: boolean;
  notApplicableReason?: string;
}

export interface ImpactComponent {
  label: string;
  amount: number;
  /** Which mechanism produced this, used to block double counting. */
  mechanism: string;
  order: "direct" | "second_order" | "macro";
}

export interface PriorityFactor {
  category: string;
  label: string;
  /** Annual dollars of the household budget this category moves. */
  exposure: number;
  explanation: string;
}

export type CoverageStatus =
  | { supported: true }
  | { supported: false; reason: string };
