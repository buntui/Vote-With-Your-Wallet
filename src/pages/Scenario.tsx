import { useState } from "react";
import { Card, Eyebrow } from "../components/ui";
import { evaluateAll } from "../lib/engine";
import { coverage } from "../lib/grid";
import { money } from "../lib/format";
import type { Grid, Profile } from "../types";

const PRESETS: { label: string; note: string; patch: Partial<Profile> }[] = [
  {
    label: "A $30,000 raise",
    note: "Same household, more income.",
    patch: {},
  },
  {
    label: "Two children",
    note: "Same income, dependents added.",
    patch: { numChildren: 2 },
  },
  {
    label: "Out of work",
    note: "Income falls to zero.",
    patch: { annualIncome: 0, employmentStatus: "seeking" },
  },
  {
    label: "Married, one earner",
    note: "Filing status changes.",
    patch: { maritalStatus: "joint" },
  },
];

export default function Scenario({
  grid,
  profile,
  onBack,
}: {
  grid: Grid;
  profile: Profile;
  onBack: () => void;
}) {
  const [index, setIndex] = useState(0);

  const preset = PRESETS[index];
  const alt: Profile = {
    ...profile,
    ...preset.patch,
    ...(index === 0 ? { annualIncome: profile.annualIncome + 30000 } : {}),
  };

  const nowOk = coverage(grid, profile).supported;
  const altOk = coverage(grid, alt).supported;

  const now = nowOk ? evaluateAll(grid, profile) : [];
  const then = altOk ? evaluateAll(grid, alt) : [];

  return (
    <>
      <button className="ghost" onClick={onBack} style={{ marginBottom: "1rem" }}>
        Back to your results
      </button>

      <h1>Try a different life</h1>
      <p>
        The same policies, priced against a different household. This is the whole argument
        for the tool: the answer is a property of your circumstances, not of your opinions.
      </p>

      <div className="seg" style={{ marginBottom: "1rem" }}>
        {PRESETS.map((p, i) => (
          <button key={p.label} type="button" aria-pressed={i === index} onClick={() => setIndex(i)}>
            {p.label}
          </button>
        ))}
      </div>

      <Eyebrow>{preset.note}</Eyebrow>

      <Card>
        <div className="rows" style={{ borderTop: "none", marginTop: 0 }}>
          <div className="row">
            <span className="row-label" style={{ fontWeight: 600 }}>
              Policy
            </span>
            <span className="row-amount">now → scenario</span>
          </div>
          {now.map((impact) => {
            const other = then.find((t) => t.policy.id === impact.policy.id);
            const before = impact.applies ? impact.estimated : 0;
            const after = other && other.applies ? other.estimated : 0;
            return (
              <div className="row" key={impact.policy.id}>
                <span className="row-label">{impact.policy.name}</span>
                <span className="row-amount">
                  {money(before, { sign: true })} → {money(after, { sign: true })}
                </span>
              </div>
            );
          })}
        </div>
        {!altOk && (
          <p className="footnote" style={{ marginTop: "0.7rem" }}>
            That scenario falls outside the current data build, so the right column is blank
            rather than guessed.
          </p>
        )}
      </Card>

      <p className="footnote">
        Scenario figures use the same rules engine output as your real results. Nothing you
        change here is saved.
      </p>
    </>
  );
}
