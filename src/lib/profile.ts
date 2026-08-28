import type { Profile } from "../types";

const KEY = "eve.profile.v1";

export const EMPTY_PROFILE: Profile = {
  state: "",
  maritalStatus: "single",
  numChildren: 0,
  annualIncome: 0,
  employmentStatus: "employed",
  tenure: "rent",
  monthlyHousingCost: 0,
  studentLoanBalance: 0,
  studentLoanRate: 6.5,
  hasVehicle: true,
  monthlyTransportCost: 0,
};

/**
 * The profile lives in localStorage and nowhere else.
 *
 * It is never placed in the URL, never sent to a server, and never included in
 * any outbound request. The only network traffic this application makes is
 * fetching its own static bundle and the webfont stylesheet.
 */
export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Profile>;
    return { ...EMPTY_PROFILE, ...parsed };
  } catch {
    return null;
  }
}

export function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage disabled; the session still works, it just will not persist */
  }
}

export function clearProfile(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
