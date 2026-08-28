import { useState } from "react";
import { Card } from "../components/ui";
import { EMPTY_PROFILE } from "../lib/profile";
import type { Grid, Profile } from "../types";

const STATE_NAMES: Record<string, string> = {
  CA: "California",
  VA: "Virginia",
  TX: "Texas",
  NY: "New York",
  FL: "Florida",
  OH: "Ohio",
  PA: "Pennsylvania",
  WA: "Washington",
};

function Seg<T extends string | number | boolean>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  hint?: string;
}) {
  return (
    <div className="field">
      <span id={`lbl-${label}`} style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.3rem" }}>
        {label}
      </span>
      <div className="seg" role="group" aria-labelledby={`lbl-${label}`}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

function Num({
  label,
  value,
  onChange,
  hint,
  prefix = "$",
  step = 1000,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  prefix?: string;
  step?: number;
}) {
  const id = label.replace(/\W+/g, "-").toLowerCase();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint && (
        <p className="hint" id={`${id}-hint`}>
          {prefix === "$" ? "" : ""}
          {hint}
        </p>
      )}
    </div>
  );
}

export default function Onboarding({
  grid,
  initial,
  onDone,
}: {
  grid: Grid;
  initial: Profile | null;
  onDone: (p: Profile) => void;
}) {
  const [p, setP] = useState<Profile>(initial ?? EMPTY_PROFILE);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((prev) => ({ ...prev, [k]: v }));

  const ready = p.state !== "" && p.annualIncome >= 0;

  return (
    <>
      <h1>Your economic situation</h1>
      <p>
        Six answers get you a result. Everything else appears only when it would change the
        number. Nothing you type here leaves your device.
      </p>

      <Card>
        <div className="field">
          <label htmlFor="state">Where you file state taxes</label>
          <select id="state" value={p.state} onChange={(e) => set("state", e.target.value)}>
            <option value="">Choose a state</option>
            {grid.coverage.states.map((s) => (
              <option key={s} value={s}>
                {STATE_NAMES[s] ?? s}
              </option>
            ))}
          </select>
          <p className="hint">
            Only these states are in the current data build. Others are not approximated,
            because a neighbouring state's tax code is a different answer, not a rougher one.
          </p>
        </div>

        <Num
          label="Household income before tax"
          value={p.annualIncome}
          onChange={(v) => set("annualIncome", v)}
          hint="Wages and salary for the year. Used to place you on the actual tax and credit schedules."
        />

        <Seg
          label="Filing status"
          value={p.maritalStatus}
          options={[
            { value: "single" as const, label: "Single" },
            { value: "joint" as const, label: "Married filing jointly" },
          ]}
          onChange={(v) => set("maritalStatus", v)}
        />

        <Seg
          label="Children under 18 at home"
          value={p.numChildren}
          options={[
            { value: 0, label: "None" },
            { value: 1, label: "1" },
            { value: 2, label: "2" },
            { value: 3, label: "3 or more" },
          ]}
          onChange={(v) => set("numChildren", v)}
          hint="Child credits are one of the largest levers in the tax code, so this changes the result more than almost anything else."
        />

        <Seg
          label="Work situation"
          value={p.employmentStatus}
          options={[
            { value: "employed" as const, label: "Employed" },
            { value: "self_employed" as const, label: "Self-employed" },
            { value: "seeking" as const, label: "Looking for work" },
            { value: "not_working" as const, label: "Not working" },
          ]}
          onChange={(v) => set("employmentStatus", v)}
        />

        <Seg
          label="Housing"
          value={p.tenure}
          options={[
            { value: "rent" as const, label: "Renting" },
            { value: "own" as const, label: "Owning" },
            { value: "other" as const, label: "Neither" },
          ]}
          onChange={(v) => set("tenure", v)}
        />

        {p.tenure !== "other" && (
          <Num
            label={p.tenure === "rent" ? "Monthly rent" : "Monthly mortgage, tax and insurance"}
            value={p.monthlyHousingCost}
            step={50}
            onChange={(v) => set("monthlyHousingCost", v)}
            hint="Used to rank what matters to your budget. It does not yet feed the benefit calculation — see the limitations note on the dashboard."
          />
        )}
      </Card>

      <details>
        <summary>Add debt and transport (changes what gets ranked first, not the tax figures)</summary>
        <div className="body">
          <Num
            label="Student loan balance"
            value={p.studentLoanBalance}
            onChange={(v) => set("studentLoanBalance", v)}
          />
          {p.studentLoanBalance > 0 && (
            <Num
              label="Interest rate"
              value={p.studentLoanRate}
              step={0.1}
              prefix="%"
              onChange={(v) => set("studentLoanRate", v)}
              hint="Percent per year."
            />
          )}
          <Num
            label="Monthly transport spending"
            value={p.monthlyTransportCost}
            step={25}
            onChange={(v) => set("monthlyTransportCost", v)}
            hint="Fuel, insurance, payments, fares."
          />
        </div>
      </details>

      <div style={{ marginTop: "1.2rem" }}>
        <button className="primary" disabled={!ready} onClick={() => onDone(p)}>
          {ready ? "See what this is worth to you" : "Choose a state to continue"}
        </button>
      </div>
    </>
  );
}
