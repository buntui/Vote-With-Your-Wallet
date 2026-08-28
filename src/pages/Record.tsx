import { Card, Eyebrow } from "../components/ui";
import { actionLabel, forState, trackRecord } from "../lib/record";
import type { OfficeholderData } from "../lib/record";
import { coverage } from "../lib/grid";
import { money } from "../lib/format";
import type { Grid, Profile } from "../types";

export default function Record({
  grid,
  data,
  profile,
  onBack,
}: {
  grid: Grid;
  data: OfficeholderData;
  profile: Profile;
  onBack: () => void;
}) {
  const people = forState(data, profile.state);
  const supported = coverage(grid, profile).supported;

  return (
    <>
      <button className="ghost" onClick={onBack} style={{ marginBottom: "1rem" }}>
        Back to your results
      </button>

      <h1>Recorded votes</h1>
      <p>
        What people who held office actually did, valued against your household. Not what
        anyone said they would do.
      </p>

      <div className="notice">
        <strong>Read this before the numbers.</strong> {data.currency_warning} This page is a
        record of past votes, not a ballot, not a list of your current representatives, and
        not a prediction of how anyone would vote again.
      </div>

      {people.length === 0 && (
        <Card>
          <p>No recorded votes in this build for {profile.state}.</p>
        </Card>
      )}

      {people.map((person) => {
        const record = trackRecord(grid, data, profile, person);
        return (
          <Card key={person.id}>
            <div className="card-head">
              <h2>
                {person.name} <span className="footnote">({person.party}-{person.state})</span>
              </h2>
              <span className="chip medium">{person.office}</span>
            </div>

            {record.entries.map((entry) => (
              <div key={entry.vehicle.id}>
                <div className="rows" style={{ marginTop: "0.6rem" }}>
                  <div className="row">
                    <span className="row-label">
                      {entry.vehicle.bill} &mdash; {entry.vehicle.title}
                    </span>
                    <span className="row-amount">{entry.rawPosition}</span>
                  </div>
                  <div className="row">
                    <span className="row-label">{actionLabel(entry.action)}</span>
                    <span className="row-amount">
                      roll call {entry.vehicle.roll_call}, {entry.vehicle.date}
                    </span>
                  </div>
                </div>

                {supported && entry.provisions.length > 0 && (
                  <details open>
                    <summary>
                      Provisions in this bill that this tool can price
                    </summary>
                    <div className="body">
                      <div className="rows" style={{ borderTop: "none", marginTop: 0 }}>
                        {entry.provisions.map((impact) => (
                          <div className="row" key={impact.policy.id}>
                            <span className="row-label">{impact.policy.name}</span>
                            <span className="row-amount">
                              {impact.applies
                                ? `${money(impact.estimated, { sign: true })}/yr to you`
                                : "does not reach you"}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="footnote" style={{ marginTop: "0.5rem" }}>
                        {entry.action === "voted_for"
                          ? `They voted for a bill containing provisions worth ${money(entry.provisionValue, { sign: true })} a year to your household.`
                          : entry.action === "voted_against"
                            ? `They voted against a bill containing provisions worth ${money(entry.provisionValue, { sign: true })} a year to your household.`
                            : "No position recorded, so nothing is attributed either way."}
                      </p>
                    </div>
                  </details>
                )}

                <details>
                  <summary>What this vote does not establish</summary>
                  <div className="body">
                    <p>{entry.vehicle.attribution_note}</p>
                    <p>
                      <a href={entry.vehicle.page_url} target="_blank" rel="noreferrer noopener">
                        Official roll call
                      </a>
                      {" \u00b7 "}
                      <a href={entry.vehicle.bill_url} target="_blank" rel="noreferrer noopener">
                        Bill text
                      </a>
                    </p>
                  </div>
                </details>
              </div>
            ))}

            {supported && record.votesConsidered > 0 && (
              <p className="footnote" style={{ marginTop: "0.9rem" }}>
                Across {record.votesConsidered} recorded vote
                {record.votesConsidered === 1 ? "" : "s"} in this build, their positions line
                up with {money(record.netAligned, { sign: true })} a year for your household.
                {record.attributionCaveat &&
                  " That figure rests on bill-level attribution and should be read as a direction, not a settled amount."}
              </p>
            )}
          </Card>
        );
      })}

      <Eyebrow>Why this is not a ranking</Eyebrow>
      <Card>
        <p>
          One bill is not a record. Turning this into a score or a grade would imply the
          sample is broad enough to characterise someone, and it is not \u2014 this build prices
          the provisions of a single piece of legislation.
        </p>
        <p className="footnote">
          A defensible ranking needs the full sponsorship and roll call history from the
          Congress.gov API, mapped bill by bill to priced provisions. That is the next data
          addition, and until it exists this page shows the raw record and declines to
          summarise it.
        </p>
      </Card>
    </>
  );
}
