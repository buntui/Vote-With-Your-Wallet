import { Card } from "../components/ui";
import { IMPLEMENTATION_PRIOR } from "../lib/engine";
import { percent } from "../lib/format";
import type { Grid } from "../types";

export function HowItWorks() {
  return (
    <>
      <h1>How this works</h1>

      <Card>
        <h2>What you give it</h2>
        <p>
          Where you file state taxes, what you earn, whether you file single or jointly, and
          how many children live with you. Those four things determine most of what tax and
          benefit policy is worth to a household. Housing, debt and transport are optional
          and are used to rank what matters to you, not to compute the tax figures.
        </p>
      </Card>

      <Card>
        <h2>Where the dollar figures come from</h2>
        <p>
          They are not estimated. A rules engine called PolicyEngine encodes federal and
          state tax and benefit law as executable code. Before this site is built, that
          engine is run over a grid of household shapes twice for every policy: once under
          current law, once with the policy's parameters changed and nothing else touched.
          The difference is what you see.
        </p>
        <p>
          Your browser looks up the two nearest income points on that grid and interpolates
          between them. That is the entire calculation performed on your device.
        </p>
      </Card>

      <Card>
        <h2>Why there is no ideology in it</h2>
        <p>
          Nothing in the model records or infers what you believe, which party you support,
          or how you have voted. The inputs are dollars, dependents and jurisdiction. Two
          people in the same town with different finances get different answers, and two
          people with identical finances get the same answer regardless of anything else
          about them.
        </p>
      </Card>

      <Card>
        <h2>Promises and results are not the same thing</h2>
        <p>
          Every policy carries a status: whether it is a stated intention, a written bill, a
          law, or something already operating. A promise and an enacted law can produce the
          same headline figure and they are not comparable, so the interface shows the stage
          on a rail and discounts the promise when ranking.
        </p>
      </Card>

      <Card>
        <h2>What it will not do</h2>
        <p>
          It will not tell you how to vote. It will not show a jurisdiction it does not have
          data for. It will not add two policy figures together when they touch the same part
          of the tax code. And it does not have candidates in it, because no free
          authoritative source currently supplies reliable ballot-level candidate records.
        </p>
      </Card>
    </>
  );
}

export function Methodology({ grid }: { grid: Grid }) {
  return (
    <>
      <h1>Methodology</h1>
      <p className="footnote">
        Data build {grid.content_hash ?? "unversioned"} · generated{" "}
        {new Date(grid.generated_at).toISOString().slice(0, 10)} · simulation year{" "}
        {grid.simulation_year} · engine {grid.engine}
      </p>

      <Card>
        <h2>Calculation</h2>
        <p>
          For policy <em>p</em> and household <em>h</em>, the reported effect is
          net(<em>h</em>, <em>p</em>) minus net(<em>h</em>, baseline), where net is annual
          household net income after federal tax, state tax, payroll tax and means-tested
          benefits, as computed by the rules engine.
        </p>
        <p>
          Only the parameters listed on each policy page are altered. Behavioural response,
          general equilibrium effects and macroeconomic feedback are not modelled at all,
          which means every figure here is a static, first-order statutory effect. That is a
          real limitation and it is why no figure on this site claims to be a forecast of
          your finances.
        </p>
      </Card>

      <Card>
        <h2>Grid and interpolation</h2>
        <ul>
          <li>States: {grid.coverage.states.join(", ")}</li>
          <li>Filing status: single, married filing jointly</li>
          <li>Children: 0 to 3</li>
          <li>
            Income: ${grid.coverage.income_min.toLocaleString()} to $
            {grid.coverage.income_max.toLocaleString()} in{" "}
            {grid.income_points.length} steps
          </li>
        </ul>
        <p className="footnote">
          Tax schedules are piecewise linear between kinks, so linear interpolation is exact
          within a step containing no kink. Where a step does contain one, the engine
          measures the curvature across neighbouring points and lowers confidence.
        </p>
      </Card>

      <Card>
        <h2>Implementation priors</h2>
        <p>
          Expected value is the estimated effect multiplied by the probability the policy is
          actually in force affecting you. These priors are stated, not measured. Disagree
          with one and you can recompute the expected value yourself from the estimate.
        </p>
        <div className="rows" style={{ borderTop: "none", marginTop: 0 }}>
          {Object.entries(IMPLEMENTATION_PRIOR).map(([k, v]) => (
            <div className="row" key={k}>
              <span className="row-label">{k}</span>
              <span className="row-amount">{percent(v)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2>Confidence</h2>
        <p>
          Confidence starts at 0.5 and moves on four things: the evidence stage, whether the
          figure came from a rules engine or a hand estimate, how close your income sits to a
          phase-in or phase-out edge, and how many stated assumptions the policy rests on.
          Above 0.72 is high, above 0.45 is medium, below that is low. The reasons are listed
          on each policy page rather than compressed into the score.
        </p>
      </Card>

      <Card>
        <h2>Double counting</h2>
        <p>
          Each policy is measured against the same baseline, so two policies touching the
          same statutory quantity overlap. The engine tags each component with the mechanism
          that produced it and refuses to produce a combined total across policies that share
          one. A genuine combined figure requires simulating them jointly at build time.
        </p>
      </Card>

      <Card>
        <h2>Known limitations</h2>
        <ul>
          {grid.grid_assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
          <li>No candidate, ballot measure or election data. See DATA_SOURCES.md.</li>
          <li>
            No second-order or macroeconomic channels: no employment effects, no rent
            effects, no price effects.
          </li>
        </ul>
      </Card>

      <Card>
        <h2>Disclaimer</h2>
        <p>
          These are analytical estimates, not guarantees. Economic outcomes differ from
          projections. A campaign promise is not an enacted policy. Where the evidence is
          weak the tool widens the range or lowers confidence rather than hiding it. An
          economic ranking of policies is not a recommendation about how to vote, and the
          vote remains yours.
        </p>
      </Card>
    </>
  );
}
