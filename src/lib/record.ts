import { evaluatePolicy } from "./engine";
import { coverage } from "./grid";
import type { Grid, Policy, PolicyImpact, Profile } from "../types";

export type ActionType = "voted_for" | "voted_against" | "did_not_vote" | "present" | "unknown";

export interface Vehicle {
  id: string;
  bill: string;
  congress: number;
  title: string;
  chamber: string;
  roll_call: number;
  date: string;
  question: string;
  result: string;
  page_url: string;
  bill_url: string;
  provisions: string[];
  attribution: "omnibus" | "standalone";
  attribution_note: string;
}

export interface Officeholder {
  id: string;
  name: string;
  last_name: string;
  first_name: string;
  party: string;
  state: string;
  chamber: string;
  office: string;
  record_congress: number;
}

export interface VoteAction {
  officeholder_id: string;
  vehicle_id: string;
  action: ActionType;
  raw_position: string;
}

export interface OfficeholderData {
  schema_version: number;
  generated_at: string;
  data_status: "REAL" | "DEMO";
  record_scope: string;
  currency_warning: string;
  name_source: string;
  verification: string;
  vehicles: Vehicle[];
  officeholders: Officeholder[];
  actions: VoteAction[];
}

export interface RecordEntry {
  vehicle: Vehicle;
  action: ActionType;
  rawPosition: string;
  /** Priced provisions of this bill, evaluated against the user's profile. */
  provisions: PolicyImpact[];
  /** Sum of the provision effects. Positive means the bill contained provisions worth this much to you. */
  provisionValue: number;
  /**
   * Signed toward the user: positive when the member's recorded position moved
   * money toward this household, negative when it moved money away.
   */
  alignedValue: number;
}

export interface TrackRecord {
  officeholder: Officeholder;
  entries: RecordEntry[];
  /** Sum of alignedValue across recorded votes. Never a candidate "score". */
  netAligned: number;
  /** Every figure here rests on omnibus attribution unless proven otherwise. */
  attributionCaveat: boolean;
  votesConsidered: number;
}

/**
 * Value the recorded votes of one officeholder against one household.
 *
 * This is a track record, not a prediction and not an endorsement. It answers
 * exactly one question: of the provisions this tool can price, which ones were
 * in bills this person voted for or against, and what were those provisions
 * worth to this household?
 *
 * It deliberately does NOT:
 *  - convert the result into a rank, grade or percentage
 *  - treat a vote on an omnibus bill as a vote on one provision
 *  - include promises, statements or positions of any kind
 *  - claim the person caused any economic outcome
 */
export function trackRecord(
  grid: Grid,
  data: OfficeholderData,
  profile: Profile,
  officeholder: Officeholder,
): TrackRecord {
  const byId = new Map(grid.policies.map((p) => [p.id, p] as const));
  const vehicles = new Map(data.vehicles.map((v) => [v.id, v] as const));
  const supported = coverage(grid, profile).supported;

  const entries: RecordEntry[] = [];
  let netAligned = 0;
  let attributionCaveat = false;
  let votesConsidered = 0;

  for (const action of data.actions) {
    if (action.officeholder_id !== officeholder.id) continue;
    const vehicle = vehicles.get(action.vehicle_id);
    if (!vehicle) continue;

    const provisions: PolicyImpact[] = [];
    let provisionValue = 0;

    if (supported) {
      for (const policyId of vehicle.provisions) {
        const policy: Policy | undefined = byId.get(policyId);
        if (!policy) continue;
        const impact = evaluatePolicy(grid, profile, policy);
        provisions.push(impact);
        if (impact.applies) provisionValue += impact.estimated;
      }
    }

    // A yea moves the provisions toward you; a nay moves them away. Abstention
    // and non-voting are recorded and valued at zero rather than guessed at.
    const sign = action.action === "voted_for" ? 1 : action.action === "voted_against" ? -1 : 0;
    const alignedValue = sign * provisionValue;

    if (action.action === "voted_for" || action.action === "voted_against") votesConsidered++;
    if (vehicle.attribution === "omnibus") attributionCaveat = true;

    netAligned += alignedValue;
    entries.push({
      vehicle,
      action: action.action,
      rawPosition: action.raw_position,
      provisions,
      provisionValue,
      alignedValue,
    });
  }

  return { officeholder, entries, netAligned, attributionCaveat, votesConsidered };
}

/** Officeholders whose record is in this build for the user's state. */
export function forState(data: OfficeholderData, state: string): Officeholder[] {
  return data.officeholders
    .filter((o) => o.state === state)
    .sort((a, b) => a.last_name.localeCompare(b.last_name));
}

export function actionLabel(action: ActionType): string {
  switch (action) {
    case "voted_for":
      return "Voted for the bill";
    case "voted_against":
      return "Voted against the bill";
    case "did_not_vote":
      return "Did not vote";
    case "present":
      return "Voted present";
    default:
      return "No recorded position";
  }
}
