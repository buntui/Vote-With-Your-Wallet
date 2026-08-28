"""
Policy catalog for the Economic Voting Engine.

EVERY entry here must be a real, citable policy. Each reform is expressed as a
PolicyEngine parameter delta so that the dollar effect is computed by a rules
engine encoding actual statute -- not estimated by hand and not invented.

Evidence status vocabulary (see METHODOLOGY.md):
    PROMISE     - a candidate/official says they intend to do this
    PROPOSED    - a concrete bill text exists
    PASSED      - one or both chambers approved it
    ENACTED     - signed into law
    IMPLEMENTED - being administered now
    HISTORICAL  - a materially identical policy has already operated and
                  measurable outcomes exist

`baseline` is current law as encoded by PolicyEngine for the simulation year.
It is not a reform; it is the counterfactual everything else is measured against.
"""

from typing import Any

YEAR = 2026
PERIOD = f"{YEAR}-01-01.{YEAR}-12-31"


def _p(**kwargs: Any) -> dict:
    return {k.replace("__", "."): {PERIOD: v} for k, v in kwargs.items()}


POLICIES: list[dict] = [
    {
        "id": "baseline",
        "name": "Current law",
        "short": "What you get under the tax and benefit rules in force today.",
        "reform": None,
        "evidence_status": "IMPLEMENTED",
        "mechanism": (
            "Federal and state income tax, payroll tax, and the major "
            "means-tested benefit programs as they are currently administered."
        ),
        "beneficiaries": ["Everyone -- this is the reference point"],
        "categories": ["taxes", "benefits"],
        "sources": [
            {
                "label": "PolicyEngine US rules engine (parameter tree)",
                "url": "https://github.com/PolicyEngine/policyengine-us",
                "tier": 2,
            },
            {
                "label": "IRS -- Internal Revenue Code, current tax year",
                "url": "https://www.irs.gov/",
                "tier": 1,
            },
        ],
        "assumptions": [],
    },
    {
        "id": "ctc_arpa_restore",
        "name": "Restore the 2021 expanded Child Tax Credit",
        "short": (
            "Raises the Child Tax Credit to $3,600 per child under 6 and $3,000 "
            "for ages 6-17, and makes it fully refundable so families with little "
            "or no earnings receive the full amount."
        ),
        "reform": {
            **_p(**{
                "gov__irs__credits__ctc__amount__arpa[0]__amount": 3_600,
                "gov__irs__credits__ctc__amount__arpa[1]__amount": 3_000,
                "gov__irs__credits__ctc__phase_out__arpa__in_effect": True,
                "gov__irs__credits__ctc__refundable__fully_refundable": True,
            })
        },
        "evidence_status": "HISTORICAL",
        "mechanism": (
            "Increases the per-child credit amount and removes the earnings "
            "phase-in, converting a partially refundable credit into a fully "
            "refundable one. Households with children below the current "
            "refundability threshold see the largest change."
        ),
        "beneficiaries": [
            "Households with children under 18",
            "Low-earning and non-earning parents (largest effect)",
            "Middle-income parents below the phase-out thresholds",
        ],
        "categories": ["taxes", "benefits", "income"],
        "sources": [
            {
                "label": "American Rescue Plan Act of 2021, P.L. 117-2, Sec. 9611",
                "url": "https://www.congress.gov/bill/117th-congress/house-bill/1319/text",
                "tier": 2,
            },
            {
                "label": "IRS -- 2021 Child Tax Credit and Advance Payments",
                "url": "https://www.irs.gov/credits-deductions/2021-child-tax-credit-and-advance-child-tax-credit-payments-topic-a-general-information",
                "tier": 1,
            },
        ],
        "assumptions": [
            "Uses the nominal 2021 statutory amounts ($3,600 / $3,000) without "
            "inflation adjustment. A version indexed to the present would be "
            "somewhat larger, so this is a conservative estimate.",
            "Assumes the ARPA phase-out schedule ($75k single / $150k joint) "
            "applies to the expansion amount, as it did in 2021.",
        ],
    },
    {
        "id": "eitc_childless_arpa",
        "name": "Expand the Earned Income Tax Credit for workers without children",
        "short": (
            "Roughly triples the maximum EITC for workers with no qualifying "
            "children and opens eligibility to workers aged 19-24 and 65+."
        ),
        "reform": {
            **_p(**{
                "gov__irs__credits__eitc__max[0]__amount": 1_502,
                "gov__irs__credits__eitc__phase_in_rate[0]__amount": 0.153,
                "gov__irs__credits__eitc__eligibility__age__min": 19,
                "gov__irs__credits__eitc__eligibility__age__max": 125,
            })
        },
        "evidence_status": "HISTORICAL",
        "mechanism": (
            "Raises the credit ceiling and the phase-in rate for the childless "
            "EITC schedule, and removes the upper and lower age bounds that "
            "currently exclude younger and older childless workers."
        ),
        "beneficiaries": [
            "Low-wage workers with no dependent children",
            "Workers aged 19-24 and 65+ currently age-excluded",
            "Part-year and part-time earners in the phase-in range",
        ],
        "categories": ["taxes", "income", "employment"],
        "sources": [
            {
                "label": "American Rescue Plan Act of 2021, P.L. 117-2, Sec. 9621-9626",
                "url": "https://www.congress.gov/bill/117th-congress/house-bill/1319/text",
                "tier": 2,
            },
            {
                "label": "IRS -- EITC parameters and qualifying rules",
                "url": "https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit-eitc",
                "tier": 1,
            },
        ],
        "assumptions": [
            "Uses nominal 2021 statutory values ($1,502 maximum, 15.3% phase-in) "
            "with no inflation adjustment. Treat the result as a lower bound.",
            "Age ceiling is modelled as removed (set to 125), matching the 2021 rule.",
        ],
    },
    {
        "id": "salt_cap_repeal",
        "name": "Repeal the cap on the state and local tax deduction",
        "short": (
            "Removes the dollar limit on deducting state and local income, sales, "
            "and property taxes from federal taxable income."
        ),
        "reform": {
            **_p(**{
                "gov__irs__deductions__itemized__salt_and_real_estate__cap__SINGLE": 1e12,
                "gov__irs__deductions__itemized__salt_and_real_estate__cap__JOINT": 1e12,
                "gov__irs__deductions__itemized__salt_and_real_estate__cap__HEAD_OF_HOUSEHOLD": 1e12,
                "gov__irs__deductions__itemized__salt_and_real_estate__cap__SEPARATE": 5e11,
                "gov__irs__deductions__itemized__salt_and_real_estate__cap__SURVIVING_SPOUSE": 1e12,
                "gov__irs__deductions__itemized__salt_and_real_estate__phase_out__in_effect": False,
            })
        },
        "evidence_status": "HISTORICAL",
        "mechanism": (
            "Increases the itemized deduction available to filers whose state and "
            "local tax bill exceeds the current cap, lowering federal taxable "
            "income. Has no effect on filers who take the standard deduction."
        ),
        "beneficiaries": [
            "Itemizers in high-tax states",
            "Higher-income households",
            "Homeowners with large property tax bills",
        ],
        "counter_beneficiaries": [
            "No direct effect on households taking the standard deduction, "
            "which is the large majority of filers."
        ],
        "categories": ["taxes", "housing"],
        "sources": [
            {
                "label": "26 U.S.C. Sec. 164(b)(6) -- limitation on SALT deduction",
                "url": "https://www.law.cornell.edu/uscode/text/26/164",
                "tier": 1,
            },
            {
                "label": "Pre-2018 federal law: uncapped SALT deduction (historical baseline)",
                "url": "https://www.irs.gov/taxtopics/tc503",
                "tier": 1,
            },
        ],
        "assumptions": [
            "Modelled as full repeal of the cap and its phase-out. Proposals to "
            "merely raise the cap would produce a smaller effect.",
            "The engine assumes the household itemizes only if doing so beats the "
            "standard deduction, which is how the statute works.",
        ],
    },
]

REFORM_IDS = [p["id"] for p in POLICIES]
