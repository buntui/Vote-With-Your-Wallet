import type { ReactNode } from "react";
import { EVIDENCE_LABEL, STAGES, timelinePosition } from "../lib/engine";
import { direction, directionWord, money, percent } from "../lib/format";
import type { Confidence, EvidenceStatus, PolicyImpact } from "../types";

export function Card({ children }: { children: ReactNode }) {
  return <section className="card">{children}</section>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

export function ConfidenceChip({ confidence }: { confidence: Confidence }) {
  return (
    <span className={`chip ${confidence.level}`}>
      {confidence.level} confidence
    </span>
  );
}

/**
 * The evidence rail.
 *
 * Four typed stages a policy can travel through. Filled segments are stages
 * actually reached. A stated intention has reached none of them, and the rail
 * says so in words rather than leaving the reader to read a bar chart.
 */
export function EvidenceRail({ status }: { status: EvidenceStatus }) {
  const reached = timelinePosition(status);
  const note =
    status === "PROMISE"
      ? "Nobody has written this down as a bill. The dollar figure is what the mechanism would be worth if it were enacted as described."
      : status === "HISTORICAL"
        ? "This exact policy has run before, so the parameters are known. It is not in force today."
        : status === "IMPLEMENTED"
          ? "In force and being administered now."
          : `Reached: ${EVIDENCE_LABEL[status].toLowerCase()}.`;

  return (
    <div className={`rail${status === "PROMISE" ? " promise" : ""}`}>
      <div className="rail-track" role="img" aria-label={`Progress: ${EVIDENCE_LABEL[status]}`}>
        {STAGES.map((s, i) => (
          <div key={s} className={`rail-seg${i <= reached ? " filled" : ""}`} />
        ))}
      </div>
      <div className="rail-labels" aria-hidden="true">
        {STAGES.map((s, i) => (
          <span key={s} className={i <= reached ? "reached" : ""}>
            {s.toLowerCase()}
          </span>
        ))}
      </div>
      <p className="rail-note">{note}</p>
    </div>
  );
}

export function Figure({ value, unit }: { value: number; unit: string }) {
  const d = direction(value);
  return (
    <div>
      <span className={`figure ${d === "up" ? "gain" : d === "down" ? "loss" : ""}`}>
        {money(value, { sign: true })}
      </span>
      <span className="figure-unit">
        {directionWord(value)} · {unit}
      </span>
    </div>
  );
}

export function ImpactCard({
  impact,
  onOpen,
}: {
  impact: PolicyImpact;
  onOpen: () => void;
}) {
  if (!impact.applies) {
    return (
      <Card>
        <div className="card-head">
          <h2>{impact.policy.name}</h2>
        </div>
        <p className="footnote">{impact.notApplicableReason}</p>
        <button className="ghost" onClick={onOpen}>
          See who it does reach
        </button>
      </Card>
    );
  }

  return (
    <Card>
      <div className="card-head">
        <h2>{impact.policy.name}</h2>
        <ConfidenceChip confidence={impact.confidence} />
      </div>
      <Figure value={impact.estimated} unit="per year, if in force" />
      <p className="footnote" style={{ marginTop: "0.6rem" }}>
        Plausible range {money(impact.low, { sign: true })} to {money(impact.high, { sign: true })}.
        Weighted for the chance it actually happens ({percent(impact.implementationProbability)}),
        it is worth {money(impact.expectedValue, { sign: true })} a year.
      </p>
      <EvidenceRail status={impact.policy.evidence_status} />
      <div className="rows">
        {impact.breakdown.map((c) => (
          <div className="row" key={c.mechanism}>
            <span className="row-label">{c.label}</span>
            <span className="row-amount">{money(c.amount, { sign: true })}</span>
          </div>
        ))}
      </div>
      <button className="ghost" style={{ marginTop: "0.8rem" }} onClick={onOpen}>
        Show the working
      </button>
    </Card>
  );
}
