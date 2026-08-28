# Economic Voting Engine

Estimates what specific tax and benefit policies are worth to **your** household, in
dollars, with the working shown.

The question it answers is narrow on purpose: *given my actual finances, which policy
changes would leave me better off, and how confident should I be in that number?*

It does not ask what you believe, infer where you sit politically, or produce a score
you cannot inspect.

---

## What makes the numbers real

The dollar figures are not estimated by a language model and not hand-derived. They come
from [PolicyEngine US](https://github.com/PolicyEngine/policyengine-us), an open-source
microsimulation model that encodes federal and state tax and benefit law as executable
code — over 95,000 parameters across 5,500+ variables, covering 55+ programmes.

At build time the pipeline runs that engine twice for every policy: once under current
law, once with only that policy's parameters changed. The difference is what the site
reports. You can see the exact parameter paths on every policy page.

A worked example the test suite pins down: restoring the 2021 child credit is worth
exactly **+$6,600** to a household with two children and no earnings, because
$3,600 + $3,000 with full refundability replaces a credit that delivers nothing without
earnings. In the flat range it is worth **+$2,200**. Those are not approximations.

---

## Philosophy

Profile → policies → mechanism → evidence → dollars → confidence.

Two people in the same town with different finances get different answers. Two people
with identical finances get the same answer regardless of anything else about them.
That is the entire model. There is no ideological axis in the code because there is no
place for one to live.

---

## Architecture in one paragraph

Python pipeline runs the rules engine over a grid of generic household shapes and emits
a static JSON file. React + TypeScript front end loads that file, looks up the two
nearest income points for your household shape, and interpolates. There is no server,
no account, and no request that carries your data. See
[ARCHITECTURE.md](docs/ARCHITECTURE.md).

```
pipeline/          rules engine → validated static JSON
src/lib/           lookup, interpolation, scoring, confidence
src/pages/         onboarding, dashboard, policy detail, scenario, methodology
src/data/grid.json generated; never edited by hand (CI enforces this)
tests/             25 tests, including regression fixtures for distinct household types
```

## Running it

```bash
npm install
npm run dev        # local dev server
npm test           # 25 tests
npm run build      # production build

pip install -r pipeline/requirements.txt
npm run data       # regenerate the grid (~100s)
```

Deployment is a GitHub Actions workflow that builds with `VITE_BASE` set to the
repository name and publishes to Pages. Routing is hash-based so that refreshing a deep
link cannot 404 on a static host.

---

## Current coverage, stated plainly

| | |
|---|---|
| States | CA, VA, TX, NY, FL, OH, PA, WA |
| Filing status | Single, married filing jointly |
| Children | 0–3 |
| Income | $0 – $600,000 |
| Policies | 3 reforms, all with statutory citations |
| Recorded votes | 100 senators, 1 bill (H.R. 1319, roll call 110) |
| Ballots / candidates | **None** |

Anything outside that grid is reported as unsupported. It is never approximated with a
neighbouring state, because a different state's tax code is a different answer, not a
rougher version of the right one.

## Recorded votes, and why there are still no ballots

The build values what people **did**. It carries all 100 senators' recorded positions on
H.R. 1319 from the official senate.gov roll call, and prices the provisions of that bill
against your household — so the identical vote is worth a different amount to a parent
earning $20,000 than to a childless filer earning $120,000. That is the feature working.

Three guards on it:

- **Omnibus attribution is stated, not assumed.** A vote on a $1.9 trillion package is not
  a vote on the child credit expansion in isolation. Every figure derived from a
  bill-level vote says so, in the data and in the interface.
- **No scores or grades.** One bill is not a record. Summarising it into a rating would
  imply a sample breadth that does not exist.
- **Records are not ballots.** A recorded vote is published history. Who is on your ballot
  is a current fact that changes constantly, and no free authoritative source covers it
  below the statewide level — Google retired the Civic Information Representatives API in
  April 2025 and the usual replacement is commercial. So the interface says what people
  did and never who you can vote for.

Getting from here to a real track record means the Congress.gov API, bill by bill. See
[docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).

## Known limitations

Static, first-order statutory effects only. No behavioural response, no general
equilibrium, no macro feedback, no employment or rent or price channels. Housing cost is
collected but does not yet feed the benefit calculation, which understates SNAP for
renters with high housing costs. Full list in
[docs/METHODOLOGY.md](docs/METHODOLOGY.md).

## Not advice

These are analytical estimates, not guarantees. A campaign promise is not an enacted
policy. An economic ranking of policies is not a recommendation about how to vote, and
the vote remains yours.

## Licence

MIT. See [LICENSE](LICENSE).
