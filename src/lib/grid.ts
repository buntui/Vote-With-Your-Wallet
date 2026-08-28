import type { CoverageStatus, Grid, Profile } from "../types";

export function cellKey(p: Pick<Profile, "state" | "maritalStatus" | "numChildren">): string {
  return `${p.state}|${p.maritalStatus}|${Math.min(p.numChildren, 3)}`;
}

/**
 * Is this profile inside the precomputed grid?
 *
 * A profile outside the grid is reported as unsupported. It is never
 * approximated with the nearest state, because state tax law is not
 * continuous and a neighbouring state's answer is not a weaker version of the
 * right answer -- it is a different answer.
 */
export function coverage(grid: Grid, p: Profile): CoverageStatus {
  if (!grid.coverage.states.includes(p.state)) {
    return {
      supported: false,
      reason: `${p.state} is not in the current data build. Supported: ${grid.coverage.states.join(", ")}.`,
    };
  }
  if (!grid.cells[cellKey(p)]) {
    return { supported: false, reason: "No precomputed cell for that household shape." };
  }
  if (p.annualIncome > grid.coverage.income_max) {
    return {
      supported: false,
      reason: `Incomes above $${grid.coverage.income_max.toLocaleString()} are outside the current data build.`,
    };
  }
  return { supported: true };
}

/**
 * Linear interpolation between the two nearest income points.
 *
 * Tax and benefit schedules are piecewise linear between kinks, so this is
 * exact wherever a $10,000 step contains no kink and slightly smoothed where
 * it does. `interpolationSlack` below quantifies that.
 */
export function lookup(grid: Grid, p: Profile, policyId: string, variable: string): number {
  const cell = grid.cells[cellKey(p)];
  if (!cell) throw new Error(`No grid cell for ${cellKey(p)}`);
  const series = cell[policyId]?.[variable];
  if (!series) throw new Error(`No series ${policyId}/${variable}`);

  const xs = grid.income_points;
  const x = Math.max(xs[0], Math.min(p.annualIncome, xs[xs.length - 1]));

  let i = 0;
  while (i < xs.length - 2 && xs[i + 1] < x) i++;
  const x0 = xs[i];
  const x1 = xs[i + 1];
  const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
  return series[i] + t * (series[i + 1] - series[i]);
}

/**
 * How much the answer could move purely because we interpolated.
 *
 * Measured as the curvature of the delta across the bracketing points: if the
 * schedule bends sharply inside this income step, the interpolated figure is
 * less trustworthy and confidence is reduced accordingly.
 */
export function interpolationSlack(grid: Grid, p: Profile, policyId: string, variable: string): number {
  const cell = grid.cells[cellKey(p)];
  const series = cell?.[policyId]?.[variable];
  const base = cell?.["baseline"]?.[variable];
  if (!series || !base) return 0;

  const xs = grid.income_points;
  const x = Math.max(xs[0], Math.min(p.annualIncome, xs[xs.length - 1]));
  let i = 0;
  while (i < xs.length - 2 && xs[i + 1] < x) i++;

  const d = (k: number) => series[k] - base[k];
  const prev = i > 0 ? d(i - 1) : d(i);
  const next = i + 2 < series.length ? d(i + 2) : d(i + 1);
  const spread = Math.max(Math.abs(d(i) - prev), Math.abs(next - d(i + 1)));
  return spread / 2;
}
