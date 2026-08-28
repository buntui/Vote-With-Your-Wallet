# Methodology

Written so an economist can attack it. Every choice below is a choice, and the ones that
are arbitrary are labelled arbitrary.

## 1. The calculation

For policy *p* and household *h*:

```
effect(h, p) = net(h, p) − net(h, baseline)
```

where `net` is annual household net income after federal income tax, state income tax,
payroll tax and means-tested benefits, computed by PolicyEngine US for the simulation
year.

Only the parameters listed on each policy's page are altered. Everything else in the tax
and benefit system is held at current law. That is what makes the difference
attributable to the policy and nothing else.

**This is a static, first-order statutory calculation.** No behavioural response, no
labour supply elasticity, no general equilibrium, no macroeconomic feedback. A household
that would work more hours under a larger EITC is modelled as working the same hours.
This is a real limitation and it is the reason no figure here claims to forecast your
finances.

## 2. The grid and interpolation

The rules engine is Python; the site is static. So the engine runs at build time over a
grid of generic household shapes and the browser interpolates.

- States: CA, VA, TX, NY, FL, OH, PA, WA
- Filing status: single, married filing jointly (modelled as a single-earner couple)
- Children: 0–3, aged 4, 9 and 14 as household size grows
- Adults: aged 35
- Income: a non-uniform ladder, $2,500 steps to $50,000, then $5,000 to $100,000,
  then $20,000 to $300,000, then $50,000 to $600,000

The ladder is dense at the bottom because credit phase-ins and phase-outs are dense
there, and sparse at the top because the schedules are flat.

Tax and benefit schedules are piecewise linear between kinks, so linear interpolation is
**exact** within any step that contains no kink, and slightly smoothed where a step
contains one. `interpolationSlack` measures the curvature across neighbouring grid
points and lowers confidence where it is large relative to the effect.

## 3. Implementation priors

Expected value = estimated effect × probability the policy is actually in force
affecting you.

| Stage | Prior |
|---|---|
| PROMISE | 0.15 |
| PROPOSED | 0.25 |
| PASSED | 0.60 |
| ENACTED | 0.90 |
| IMPLEMENTED | 1.00 |
| HISTORICAL | 0.35 |

**These are stated priors, not measurements.** They are not derived from base rates of
bill passage, and they should not be read as if they were. They exist to stop a campaign
promise outranking an enacted law by claiming a bigger headline number. They are
published here and in the interface precisely so that a reader who disagrees with a
figure can recompute the expected value from the estimate.

`HISTORICAL` sits low deliberately: a policy having operated before tells you the
mechanism and parameters are known, which raises *confidence in the size*, while telling
you nothing reassuring about whether it will return, which is what the prior measures.
Those two things are scored separately on purpose.

## 4. Confidence

Starts at 0.5, then moves on four things:

| Factor | Effect |
|---|---|
| Evidence stage | −0.25 (promise) to +0.35 (in force) |
| Computed by a rules engine rather than by hand | +0.10 |
| Income near a phase-in or phase-out edge | −0.15 |
| Two or more stated modelling assumptions | −0.05 |
| Incomplete profile | −0.10 |

Clamped to [0.05, 0.98]. High ≥ 0.72, medium ≥ 0.45, low below.

The score is not the output; the *reasons* are. Every policy page lists them in plain
sentences, because a reader can argue with "your income sits near a phase-out edge" and
cannot argue with "0.61".

## 5. Reported ranges

The band widens as confidence falls: ±8% at high, ±20% at medium, ±45% at low. Rounding
steps coarsen with magnitude, so a figure over $2,000 is rounded to $50.

This is a presentation rule, not a statistical interval. It exists to stop the interface
implying that a number derived from a promise deserves the same number of significant
figures as one derived from statute. `$1,743.26` is never displayed; `$1,750` or
`$1,500–$2,000` is.

## 6. Double counting

Every policy is measured against the same baseline, so two policies touching the same
statutory quantity overlap and their figures **cannot be added**.

Each component carries a `mechanism` tag. `overlapWarnings` detects collisions and the
dashboard refuses to display a combined total for them, saying why instead. A genuine
combined figure requires simulating the policies jointly in the pipeline. The browser
cannot fake that, and the interface does not pretend otherwise.

## 7. Priority ranking

The "what moves your money" list is annual dollars of exposure per category, computed
from your profile: total tax burden from the engine, housing cost × 12, benefits from
the engine, transport × 12, student loan interest, and an employment term that dominates
when you are out of work. It is a magnitude ranking, not a preference ranking — it tells
you which areas *can* move your finances most, not which you care about.

## 8. Attribution

Nothing in this build attributes an economic outcome to a named politician. When
candidate data exists, the distinction between "this happened during their tenure" and
"they caused this" must be made explicitly, and any figure of the first kind must not be
scored as if it were the second.

## 9. Known limitations

- Static first-order effects only (§1)
- Housing cost is collected but does not feed the benefit calculation, so SNAP is
  understated for renters with high shelter costs
- All income modelled as W-2 wages from one earner; no self-employment, investment
  income, or capital gains
- Married filing separately, head of household and surviving spouse are not in the grid
- No local or municipal taxes
- No candidates, ballot measures or elections
- 8 states of 50
- Interpolation smooths kinks within a step

## 10. What would change these numbers

Upstream statutory changes encoded in PolicyEngine. The scheduled workflow reruns the
pipeline monthly and opens a pull request when the output differs, so a human reviews the
diff before the published figures move. CI independently verifies that the committed
grid reproduces exactly from a fresh run, which is what stops anyone editing the numbers
by hand.
