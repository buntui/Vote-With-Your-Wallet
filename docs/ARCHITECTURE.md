# Architecture

## The constraint that shapes everything

The rules engine that produces trustworthy numbers is Python. The deployment target is a
static host with no server. Those two facts are in tension, and every significant design
decision here resolves it the same way: **compute at build time, interpolate at runtime.**

```
  statute
     │
     ▼
  PolicyEngine US  (Python, build time, GitHub Actions)
     │  run twice per policy: baseline, and baseline + one parameter delta
     ▼
  src/data/grid.json  (validated, committed, CI-reproducible)
     │
     ▼
  static bundle  ──►  browser
                        │  looks up household shape, interpolates income
                        ▼
                     your figures  (never leave the device)
```

## Why not the alternatives

**Call PolicyEngine's hosted API from the browser.** Simplest, and rejected: it sends the
user's financial profile to a third party on every keystroke, which breaks the privacy
guarantee that is the reason the tool is usable at all.

**Run the engine in the browser via Pyodide/WASM.** Technically possible. It means
shipping a multi-megabyte Python runtime plus the model to a phone, for a calculation
that a 300 KB lookup table answers exactly. Rejected on weight.

**Add a small backend.** Reintroduces a server, a deployment surface, a place for
financial data to accumulate, and a running cost. Rejected against the static-site
requirement.

The grid wins because the thing being approximated — a piecewise-linear tax schedule — is
almost perfectly suited to interpolation, so the approximation error is close to zero
where it matters and measurable where it is not.

## Layers

| Path | Responsibility |
|---|---|
| `pipeline/policies.py` | Policy catalogue: parameter deltas, evidence status, sources, assumptions |
| `pipeline/generate_grid.py` | Packs every household shape into one vectorised simulation per policy |
| `src/lib/grid.ts` | Cell lookup, coverage check, interpolation, interpolation slack |
| `src/lib/engine.ts` | Impacts, confidence, expected value, priorities, double-count safeguard |
| `src/lib/profile.ts` | localStorage only |
| `src/lib/format.ts` | Rounding rules that refuse false precision |
| `src/pages/*` | Onboarding, dashboard, policy detail, scenario, explanation |

The engine layer has no React dependency and the UI layer has no calculation logic. That
is what makes the 25 tests able to assert on statute directly.

## Performance note

Simulating each grid cell separately took ~67 seconds per cell. Packing all 3,008
household shapes into one vectorised simulation per policy brought the full build to
about 100 seconds. If you extend the grid, extend it by adding rows to the batch, not by
adding loops around `Simulation()`.

## Data model

`UserProfile` is local and private. Everything else — `Policy`, `Source`,
`EvidenceStatus`, `PolicyImpact`, `ImpactComponent`, `Confidence`, `PriorityFactor` — is
public application data with no user-specific content. The two never mix in storage, only
in a pure function.

## Deployment

`deploy.yml` builds with `VITE_BASE=/${repository-name}/` so the same source deploys to a
project site or a user site without edits, adds `.nojekyll`, and publishes to Pages.
Routing is hash-based: a static host returns 404 for unknown paths, so a history-API
router would break on refresh and on every shared deep link.

## Extending it

**More states** — add to `STATES` in the pipeline and rerun. Cost is linear.

**Housing in the benefit calculation** — add a housing-cost dimension to the grid. This
is the highest-value next change and roughly multiplies build time by the number of
housing tiers.

**Federal legislative track record** — Congress.gov API, called from a GitHub Action at
build time, normalised into the same `Policy` shape. This is the path to candidate
features, and it should be built bill-first, not candidate-first.
