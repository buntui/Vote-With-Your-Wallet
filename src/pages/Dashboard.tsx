import { Card, Eyebrow, ImpactCard } from "../components/ui";
import { evaluateAll, overlapWarnings, priorities } from "../lib/engine";
import { coverage } from "../lib/grid";
import { money } from "../lib/format";
import type { Grid, Profile } from "../types";

export default function Dashboard({
  grid,
  profile,
  onEdit,
  onOpenPolicy,
  onScenario,
  onRecord,
}: {
  grid: Grid;
  profile: Profile;
  onEdit: () => void;
  onOpenPolicy: (id: string) => void;
  onScenario: () => void;
  onRecord: () => void;
}) {
  const cov = coverage(grid, profile);

  if (!cov.supported) {
    return (
      <>
        <h1>Not supported yet</h1>
        <Card>
          <p>{cov.reason}</p>
          <p className="footnote">
            The alternative would be to show you a number from a different jurisdiction and
            call it an estimate. That is worse than showing nothing, so this build does not
            do it.
          </p>
          <button className="ghost" onClick={onEdit}>
            Change your profile
          </button>
        </Card>
      </>
    );
  }

  const impacts = evaluateAll(grid, profile);
  const ranked = priorities(grid, profile);
  const warnings = overlapWarnings(impacts);
  const applying = impacts.filter((i) => i.applies);
  const best = applying[0];

  return (
    <>
      <h1>What policy is worth to you</h1>

      <Eyebrow>Your profile</Eyebrow>
      <Card>
        <div className="rows" style={{ borderTop: "none", marginTop: 0 }}>
          <div className="row">
            <span className="row-label">Income</span>
            <span className="row-amount">{money(profile.annualIncome)}/yr</span>
          </div>
          <div className="row">
            <span className="row-label">State</span>
            <span className="row-amount">{profile.state}</span>
          </div>
          <div className="row">
            <span className="row-label">Filing</span>
            <span className="row-amount">
              {profile.maritalStatus === "joint" ? "Joint" : "Single"}
              {profile.numChildren > 0 ? ` · ${profile.numChildren} child${profile.numChildren > 1 ? "ren" : ""}` : ""}
            </span>
          </div>
          <div className="row">
            <span className="row-label">Housing</span>
            <span className="row-amount">
              {profile.tenure === "rent" ? "Rent" : profile.tenure === "own" ? "Own" : "—"}
              {profile.monthlyHousingCost > 0 ? ` ${money(profile.monthlyHousingCost)}/mo` : ""}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.8rem", flexWrap: "wrap" }}>
          <button className="ghost" onClick={onEdit}>
            Change something
          </button>
          <button className="ghost" onClick={onScenario}>
            Try a different life
          </button>
          <button className="ghost" onClick={onRecord}>
            See recorded votes
          </button>
        </div>
      </Card>

      <Eyebrow>What moves your money, largest first</Eyebrow>
      <Card>
        <ol className="ranked">
          {ranked.slice(0, 5).map((f) => (
            <li key={f.category}>
              <span>{f.label}</span>
              <span className="exposure">{money(f.exposure)}/yr</span>
              <span className="why">{f.explanation}</span>
            </li>
          ))}
        </ol>
        <p className="footnote" style={{ marginTop: "0.7rem" }}>
          This ranking is calculated from your profile, not chosen by you. It is dollars of
          annual exposure, so it tells you which policy areas can move your finances most,
          not which ones you care about.
        </p>
      </Card>

      {best && (
        <>
          <Eyebrow>Ranked by expected value to you</Eyebrow>
          <div className="notice">
            Of the policies in this build, <strong>{best.policy.name}</strong> is worth the
            most to your household: {money(best.estimated, { sign: true })} a year if it were
            in force, {money(best.expectedValue, { sign: true })} after weighting for whether
            it happens. That is an economic ranking of policies, not advice about a vote.
          </div>
        </>
      )}

      {impacts.map((impact) => (
        <ImpactCard
          key={impact.policy.id}
          impact={impact}
          onOpen={() => onOpenPolicy(impact.policy.id)}
        />
      ))}

      {warnings.length > 0 && (
        <>
          <Eyebrow>Why these do not add up</Eyebrow>
          <Card>
            {warnings.map((w) => (
              <p key={w} className="footnote">
                {w}
              </p>
            ))}
            <p className="footnote">
              Getting a combined figure means simulating the policies together in the data
              pipeline, not adding the separate answers in your browser. Until that exists,
              this build declines to give you a total.
            </p>
          </Card>
        </>
      )}

      <Eyebrow>What people actually did</Eyebrow>
      <Card>
        <p>
          This build can price the provisions of one real bill and show you how every
          senator voted on it, from the official roll call.
        </p>
        <button className="ghost" onClick={onRecord}>
          See recorded votes for {profile.state}
        </button>
      </Card>

      <Eyebrow>What this build still cannot tell you</Eyebrow>
      <Card>
        <p>
          It cannot tell you who is on your ballot. Recorded votes are history; a ballot is
          a current fact, and no free authoritative source covers candidate filings down to
          the district level.
        </p>
        <p className="footnote">
          Google retired the Civic Information Representatives API in April 2025 and the
          usual replacement is a paid product. Rather than fill the gap with invented
          candidates, this build ships the record, which is real, and leaves the ballot
          visibly empty. See DATA_SOURCES.md.
        </p>
      </Card>
    </>
  );
}
