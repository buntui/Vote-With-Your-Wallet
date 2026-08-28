import { useEffect, useState } from "react";
import gridData from "./data/grid.json";
import officeholderData from "./data/officeholders.json";
import Dashboard from "./pages/Dashboard";
import Onboarding from "./pages/Onboarding";
import PolicyDetail from "./pages/PolicyDetail";
import Record from "./pages/Record";
import Scenario from "./pages/Scenario";
import { HowItWorks, Methodology } from "./pages/Explain";
import { clearProfile, loadProfile, saveProfile } from "./lib/profile";
import type { OfficeholderData } from "./lib/record";
import type { Grid, Profile } from "./types";

const grid = gridData as unknown as Grid;
const officeholders = officeholderData as unknown as OfficeholderData;

/**
 * Hash routing, deliberately.
 *
 * GitHub Pages serves static files and returns 404 for unknown paths, so a
 * history-API router breaks on refresh and on deep links. Hash routes always
 * resolve to index.html. It also guarantees no profile field can ever end up
 * in a request path.
 */
type Route =
  | { name: "onboarding" }
  | { name: "dashboard" }
  | { name: "policy"; id: string }
  | { name: "scenario" }
  | { name: "record" }
  | { name: "how" }
  | { name: "methodology" };

function parseHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, "");
  if (h.startsWith("policy/")) return { name: "policy", id: h.slice("policy/".length) };
  if (h === "profile") return { name: "onboarding" };
  if (h === "scenario") return { name: "scenario" };
  if (h === "record") return { name: "record" };
  if (h === "how") return { name: "how" };
  if (h === "methodology") return { name: "methodology" };
  return { name: "dashboard" };
}

function go(hash: string) {
  window.location.hash = hash;
}

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile());
  const [route, setRoute] = useState<Route>(() => parseHash());

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const commit = (p: Profile) => {
    setProfile(p);
    saveProfile(p);
    go("/");
  };

  const needsOnboarding = profile === null || profile.state === "";
  const effective: Route = needsOnboarding ? { name: "onboarding" } : route;

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="masthead">
        <div className="masthead-inner">
          <p className="wordmark">Economic Voting Engine</p>
          <nav className="nav" aria-label="Primary">
            <a href="#/" aria-current={effective.name === "dashboard" ? "page" : undefined}>
              Results
            </a>
            <a href="#/how" aria-current={effective.name === "how" ? "page" : undefined}>
              How it works
            </a>
            <a
              href="#/methodology"
              aria-current={effective.name === "methodology" ? "page" : undefined}
            >
              Methodology
            </a>
          </nav>
        </div>
      </header>

      <p className="provenance">
        <strong>{grid.data_status} data</strong> · {grid.engine} · tax year{" "}
        {grid.simulation_year} · stays on your device
      </p>

      <main className="shell" id="main">
        {effective.name === "onboarding" && (
          <Onboarding grid={grid} initial={profile} onDone={commit} />
        )}

        {effective.name === "dashboard" && profile && (
          <Dashboard
            grid={grid}
            profile={profile}
            onEdit={() => go("/profile")}
            onOpenPolicy={(id) => go(`/policy/${id}`)}
            onScenario={() => go("/scenario")}
            onRecord={() => go("/record")}
          />
        )}

        {effective.name === "policy" && profile && (
          <PolicyDetail
            grid={grid}
            profile={profile}
            policyId={effective.id}
            onBack={() => go("/")}
          />
        )}

        {effective.name === "record" && profile && (
          <Record
            grid={grid}
            data={officeholders}
            profile={profile}
            onBack={() => go("/")}
          />
        )}

        {effective.name === "scenario" && profile && (
          <Scenario grid={grid} profile={profile} onBack={() => go("/")} />
        )}

        {effective.name === "how" && <HowItWorks />}
        {effective.name === "methodology" && <Methodology grid={grid} />}

        {profile && (
          <p className="footnote" style={{ marginTop: "2.5rem" }}>
            Your profile is stored in this browser only.{" "}
            <button
              className="ghost"
              onClick={() => {
                clearProfile();
                setProfile(null);
                go("/profile");
              }}
            >
              Delete it
            </button>
          </p>
        )}
      </main>
    </>
  );
}
