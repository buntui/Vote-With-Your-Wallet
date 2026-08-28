import { Card, ConfidenceChip, EvidenceRail, Figure } from "../components/ui";
import { EVIDENCE_LABEL, evaluatePolicy } from "../lib/engine";
import { money, percent } from "../lib/format";
import type { Grid, Profile } from "../types";

const TIER_NAME: Record<number, string> = {
  1: "Government primary source",
  2: "Statute or official record",
  3: "Peer-reviewed or research body",
  4: "Other",
};

export default function PolicyDetail({
  grid,
  profile,
  policyId,
  onBack,
}: {
  grid: Grid;
  profile: Profile;
  policyId: string;
  onBack: () => void;
}) {
  const policy = grid.policies.find((p) => p.id === policyId);
  if (!policy) {
    return (
      <Card>
        <p>No policy with that identifier is in this data build.</p>
        <button className="ghost" onClick={onBack}>
          Back
        </button>
      </Card>
    );
  }

  const impact = evaluatePolicy(grid, profile, policy);

  return (
    <>
      <button className="ghost" onClick={onBack} style={{ marginBottom: "1rem" }}>
        Back to your results
      </button>

      <h1>{policy.name}</h1>
      <p>{policy.short}</p>

      <Card>
        <div className="card-head">
          <h2>Your household</h2>
          <ConfidenceChip confidence={impact.confidence} />
        </div>
        {impact.applies ? (
          <>
            <Figure value={impact.estimated} unit="per year, if in force" />
            <div className="rows">
              {impact.breakdown.map((c) => (
                <div className="row" key={c.mechanism}>
                  <span className="row-label">
                    {c.label}
                    <span className="footnote"> · {c.order.replace("_", " ")} effect</span>
                  </span>
                  <span className="row-amount">{money(c.amount, { sign: true })}</span>
                </div>
              ))}
              <div className="row">
                <span className="row-label">Reported as a range</span>
                <span className="row-amount">
                  {money(impact.low, { sign: true })} to {money(impact.high, { sign: true })}
                </span>
              </div>
              <div className="row">
                <span className="row-label">
                  Chance it is actually in force affecting you
                </span>
                <span className="row-amount">{percent(impact.implementationProbability)}</span>
              </div>
              <div className="row">
                <span className="row-label">Expected value</span>
                <span className="row-amount">{money(impact.expectedValue, { sign: true })}/yr</span>
              </div>
            </div>
          </>
        ) : (
          <p>{impact.notApplicableReason}</p>
        )}
      </Card>

      <Card>
        <h2>Where it stands</h2>
        <p className="footnote">
          Status: <strong>{policy.evidence_status}</strong> — {EVIDENCE_LABEL[policy.evidence_status]}
        </p>
        <EvidenceRail status={policy.evidence_status} />
      </Card>

      <Card>
        <h2>How the money reaches you</h2>
        <p>{policy.mechanism}</p>
        <details open>
          <summary>Who this mostly benefits</summary>
          <div className="body">
            <ul>
              {policy.beneficiaries.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            {policy.counter_beneficiaries && (
              <ul>
                {policy.counter_beneficiaries.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </div>
        </details>
        <details>
          <summary>Why the confidence is {impact.confidence.level}</summary>
          <div className="body">
            <ul>
              {impact.confidence.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </details>
        <details>
          <summary>Assumptions this rests on</summary>
          <div className="body">
            <ul>
              {policy.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
              {grid.grid_assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        </details>
        {policy.parameter_changes && (
          <details>
            <summary>Exact parameters changed in the rules engine</summary>
            <div className="body">
              <ul>
                {policy.parameter_changes.map((c) => (
                  <li key={c} style={{ fontFamily: "var(--mono)", fontSize: "0.78rem" }}>
                    {c}
                  </li>
                ))}
              </ul>
              <p className="footnote">
                These are the only things changed relative to current law. Everything else in
                the tax and benefit system is held fixed, which is what makes the difference
                attributable to this policy and nothing else.
              </p>
            </div>
          </details>
        )}
      </Card>

      <Card>
        <h2>Sources</h2>
        <div className="rows" style={{ borderTop: "none", marginTop: 0 }}>
          {policy.sources.map((s) => (
            <div className="row" key={s.url}>
              <span className="row-label">
                <a href={s.url} target="_blank" rel="noreferrer noopener">
                  {s.label}
                </a>
                <span className="footnote"> · {TIER_NAME[s.tier] ?? "Other"}</span>
              </span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
