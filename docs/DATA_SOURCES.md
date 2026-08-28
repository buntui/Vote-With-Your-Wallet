# Data sources

## In use

**PolicyEngine US** — <https://github.com/PolicyEngine/policyengine-us>
Open-source microsimulation model of the US federal and state tax and benefit system.
Supplies every dollar figure on the site. Chosen because it is open source (so the
calculation is inspectable rather than a black box), maintained against current statute,
and cross-validated against NBER's TAXSIM.

**senate.gov roll call votes** — <https://www.senate.gov/legislative/LIS/roll_call_votes/>
The official record compiled by the Senate bill clerk, published as XML at a stable URL
per vote. Supplies every recorded position in `src/data/officeholders.json`. Currently
one vehicle: H.R. 1319, Senate roll call 110, 6 March 2021. The committed file's tally
reconciles to the official result (50 Yea, 49 Nay, 1 Not Voting) and a test asserts it.

**Statutory sources cited per policy**
Each policy in `pipeline/policies.py` carries at least one source with a tier:

| Tier | Meaning |
|---|---|
| 1 | Government primary source (IRS, agency guidance) |
| 2 | Statute or official legislative record |
| 3 | Peer-reviewed or research body |
| 4 | Other |

A campaign website is never tier 1 or 2, and never sufficient on its own.

## Evaluated and not used

**Google Civic Information API — Representatives endpoint**
Retired April 2025. This was the free backbone for address → district → officeholder
lookup. Its removal is the single largest reason this build has no candidate features.

**Ballotpedia API**
The successor most projects were pointed toward. Commercial, contact-sales. Coverage is
federal, statewide, the largest ~100 cities and some state capitals — good, but it is
not free and cannot be committed to a public repo without exposing a credential or
adding a backend, both of which conflict with the static-site and no-secrets constraints.

**Congress.gov API** — <https://api.congress.gov>
Free, authoritative, government-run. Covers federal bills, sponsors, cosponsors and roll
calls across both chambers. This is the path from one recorded vote to a real track
record, and it is the next data addition. Requires a key, so it must be called from a
GitHub Action at build time, never from the browser.

**House Clerk roll call votes** — <https://clerk.house.gov/Votes>
The House counterpart to the senate.gov XML feed, same primary-source standing. Needed
before any House member's record can appear.

**Open States** — <https://openstates.org>
State legislation and legislators. The natural counterpart to Congress.gov for state
track record. Same build-time-only constraint.

**FEC API, Census, BLS**
Available and free. Useful for candidate finance and for labour-market context if
employment-channel modelling is ever added. None are needed for the current statutory
calculations.

**ProPublica Congress API**
Discontinued. Do not build against it.

## Rule

If a source cannot be reached without a credential, it is called at build time from a
GitHub Action with the key in repository secrets, and only the derived, validated JSON
is committed. No key ever reaches the client bundle. CI greps the tree for
credential-shaped strings on every pull request.

## Records versus ballots

These are different things and the distinction is load-bearing.

A **recorded vote** is history. It is published by the chamber, permanent, and free. This
build has it.

A **ballot** is a current fact about an upcoming election: who filed, in which district,
for which office. It is not derivable from voting history, it changes constantly, and no
free authoritative source covers it below the statewide level. This build does not have
it and does not pretend to.

Anything the interface says about a person is therefore phrased as what they did, never
as who you can vote for.

## What is deliberately absent

There are no synthetic candidates, no invented bills, and no demo-mode political data
anywhere in this repository. The one place the word DEMO could legitimately appear is a
clearly labelled fixture set, and the current build does not need one, because the
policies are real and the households in the grid are generic shapes rather than
pretend people.
