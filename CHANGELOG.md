# Changelog

## 0.2.0 — recorded votes

**Added**
- `pipeline/ingest_votes.py`: build-time ingestion of official Senate roll call XML,
  mapping bills to already-priced provisions in the policy catalogue
- All 100 recorded positions on H.R. 1319, Senate roll call 110 (6 March 2021), from
  senate.gov. Tally reconciles to the official 50-49-1 and a test asserts it
- Track record layer: values a member's recorded votes against the user's household, so
  the same vote is worth different amounts to different people
- Recorded votes page, reachable from the dashboard, filtered to the user's state
- 11 further tests (36 total)

**Deliberately constrained**
- Every bill-level vote carries an omnibus attribution caveat in the data, in the scoring
  layer and in the interface. A vote on a $1.9 trillion package is not a vote on the child
  credit expansion in isolation, and nothing in the build implies it is
- No score, grade, rank or percentage is produced for any person. One bill is not a
  record, and summarising it would imply a sample breadth that does not exist
- Members who did not vote are attributed nothing rather than imputed
- Records are labelled as 117th Congress history. The build makes no claim about who
  currently holds office or who appears on any ballot

## 0.1.0 — initial build

**Added**
- Build-time pipeline running PolicyEngine US over 3,008 generic household shapes,
  batched into one vectorised simulation per policy (~100s full run)
- Policy catalogue with three real reforms, each a parameter delta with statutory
  citations: ARPA child credit restoration, ARPA childless EITC expansion, SALT cap
  repeal
- Grid covering 8 states, single and joint filing, 0–3 children, $0–$600,000 on a
  non-uniform income ladder
- Onboarding, dashboard with computed priority ranking, per-policy detail with sources,
  assumptions and exact parameter paths, scenario mode, plain-English and technical
  explanation pages
- Confidence scoring with published reasons; implementation priors; expected value
- Double-counting safeguard that refuses to sum overlapping mechanisms
- 25 tests including regression fixtures for distinct household types
- CI: typecheck, tests, build, dependency audit, credential grep, and a check that the
  committed grid reproduces exactly from a fresh pipeline run
- Monthly scheduled workflow that opens a pull request when the engine's output changes

**Deliberately absent**
- Candidates, ballot measures and elections. No free authoritative source currently
  supplies reliable ballot-level records; the Google Civic Representatives API was
  retired in April 2025. The dashboard states this rather than shipping invented data.

**Notes**
- The initial grid stopped at $250,000 and SALT cap repeal computed to exactly $0 for
  every household in it, because the cap now sits above $40,000. The grid was extended
  to $600,000 rather than the test being weakened. Cap repeal first bites around
  $500,000 for a California joint filer.
