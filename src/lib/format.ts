/**
 * Formatting rules exist to stop the interface implying precision the
 * evidence does not support. A figure derived from a rules engine is rounded
 * to the nearest useful unit; a range is shown whenever the band is wide
 * enough that the midpoint would mislead.
 */

export function money(value: number, opts: { sign?: boolean } = {}): string {
  const abs = Math.abs(value);
  const step = abs >= 2000 ? 50 : abs >= 400 ? 10 : 1;
  const rounded = Math.round(value / step) * step;
  const body = `$${Math.abs(rounded).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (!opts.sign) return body;
  if (rounded > 0) return `+${body}`;
  if (rounded < 0) return `−${body}`;
  return "$0";
}

export function range(low: number, high: number): string {
  if (Math.round(low) === Math.round(high)) return money(low, { sign: true });
  const sign = high < 0 ? "−" : "+";
  const a = Math.abs(low) <= Math.abs(high) ? low : high;
  const b = Math.abs(low) <= Math.abs(high) ? high : low;
  return `${sign}${money(a).replace("$", "$")}–${money(b).replace("$", "")}`;
}

export function percent(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function direction(value: number): "up" | "down" | "flat" {
  if (value > 1) return "up";
  if (value < -1) return "down";
  return "flat";
}

/** Never colour alone: every direction also carries a word. */
export function directionWord(value: number): string {
  const d = direction(value);
  return d === "up" ? "Better off" : d === "down" ? "Worse off" : "No change";
}
