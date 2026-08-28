"""
Build-time data pipeline.

Runs the PolicyEngine US rules engine across a grid of household shapes under
current law and under each reform in the policy catalog, then writes a static
JSON file the browser can interpolate against.

This exists because the rules engine is Python and the application is a static
site. Nothing is computed on a server at request time; nothing about a real
user's profile ever leaves their browser. The grid is generic -- it contains no
user data, only "a single filer with two children in Ohio earning $45,000 nets
$X" style reference points.

Every household shape and income point is packed into ONE vectorised simulation
per policy, which is far faster than simulating each cell separately.

Usage:
    python pipeline/generate_grid.py --out src/data/grid.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from policies import POLICIES, YEAR  # noqa: E402

from policyengine_core.reforms import Reform  # noqa: E402
from policyengine_us import Simulation  # noqa: E402

# --- Grid definition -------------------------------------------------------
# Coverage is deliberately explicit. A jurisdiction absent from this list is
# reported to the user as unsupported. It is never silently approximated.
STATES = ["CA", "VA", "TX", "NY", "FL", "OH", "PA", "WA"]
MARITAL = ["single", "joint"]
N_CHILDREN = [0, 1, 2, 3]

# Non-uniform income ladder: dense where credit phase-ins and phase-outs live,
# sparse in the flat upper range. Extends to $600k because the SALT cap does not
# bind below roughly $400k of state and local tax exposure, and a policy that is
# worth zero to everyone in the covered range should not be in the catalogue.
INCOME_POINTS: list[int] = (
    [i * 2_500 for i in range(0, 21)]          # $0 - $50,000 in $2,500 steps
    + [50_000 + i * 5_000 for i in range(1, 11)]   # $55,000 - $100,000
    + [100_000 + i * 20_000 for i in range(1, 11)]  # $120,000 - $300,000
    + [300_000 + i * 50_000 for i in range(1, 7)]   # $350,000 - $600,000
)
INCOME_MIN = INCOME_POINTS[0]
INCOME_MAX = INCOME_POINTS[-1]

ADULT_AGE = 35
SPOUSE_AGE = 35
CHILD_AGES = [4, 9, 14]

OUTPUT_VARIABLES = [
    "household_net_income",
    "household_tax",
    "household_benefits",
]


def cell_key(state: str, marital: str, n_children: int) -> str:
    return f"{state}|{marital}|{n_children}"


def build_batch(states, incomes):
    """Return (situation, index) where index[i] = (cell_key, income_position)."""
    people, tax_units, families = {}, {}, {}
    spm_units, marital_units, households = {}, {}, {}
    index = []

    n = 0
    for state in states:
        for marital in MARITAL:
            for n_children in N_CHILDREN:
                key = cell_key(state, marital, n_children)
                for pos, income in enumerate(incomes):
                    uid = f"u{n}"
                    adult = f"{uid}_adult"
                    members = [adult]
                    people[adult] = {
                        "age": {YEAR: ADULT_AGE},
                        "employment_income": {YEAR: income},
                    }
                    if marital == "joint":
                        spouse = f"{uid}_spouse"
                        people[spouse] = {
                            "age": {YEAR: SPOUSE_AGE},
                            "employment_income": {YEAR: 0},
                        }
                        members.append(spouse)
                        marital_units[f"{uid}_m"] = {"members": [adult, spouse]}
                    else:
                        marital_units[f"{uid}_m"] = {"members": [adult]}

                    for c in range(n_children):
                        child = f"{uid}_c{c}"
                        people[child] = {"age": {YEAR: CHILD_AGES[c]}}
                        members.append(child)
                        marital_units[f"{uid}_mc{c}"] = {"members": [child]}

                    tax_units[f"{uid}_tu"] = {"members": list(members)}
                    families[f"{uid}_f"] = {"members": list(members)}
                    spm_units[f"{uid}_spm"] = {"members": list(members)}
                    households[f"{uid}_hh"] = {
                        "members": list(members),
                        "state_name": {YEAR: state},
                    }
                    index.append((key, pos))
                    n += 1

    situation = {
        "people": people,
        "tax_units": tax_units,
        "families": families,
        "spm_units": spm_units,
        "marital_units": marital_units,
        "households": households,
    }
    return situation, index


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="src/data/grid.json")
    ap.add_argument("--states", default=",".join(STATES))
    args = ap.parse_args()

    states = [s.strip().upper() for s in args.states.split(",") if s.strip()]
    incomes = list(INCOME_POINTS)

    started = time.time()
    situation, index = build_batch(states, incomes)
    print(
        f"built batch: {len(index)} households, {len(situation['people'])} people "
        f"({time.time() - started:.0f}s)",
        flush=True,
    )

    cells: dict = {}
    for key, _ in index:
        cells.setdefault(key, {})

    for policy in POLICIES:
        t0 = time.time()
        reform = (
            Reform.from_dict(policy["reform"], country_id="us")
            if policy["reform"] is not None
            else None
        )
        sim = (
            Simulation(situation=situation, reform=reform)
            if reform
            else Simulation(situation=situation)
        )
        results = {}
        for var in OUTPUT_VARIABLES:
            results[var] = [float(v) for v in sim.calculate(var, YEAR)]

        for key in cells:
            cells[key][policy["id"]] = {
                v: [0.0] * len(incomes) for v in OUTPUT_VARIABLES
            }
        for i, (key, pos) in enumerate(index):
            for var in OUTPUT_VARIABLES:
                cells[key][policy["id"]][var][pos] = round(results[var][i], 2)

        print(f"  {policy['id']:<22} {time.time() - t0:.0f}s", flush=True)

    catalog = []
    for policy in POLICIES:
        entry = {k: v for k, v in policy.items() if k != "reform"}
        entry["is_reform"] = policy["reform"] is not None
        if policy["reform"] is not None:
            entry["parameter_changes"] = sorted(policy["reform"].keys())
        catalog.append(entry)

    payload = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "simulation_year": YEAR,
        "engine": "policyengine-us",
        "data_status": "REAL",
        "coverage": {
            "states": states,
            "marital": MARITAL,
            "children": N_CHILDREN,
            "income_min": INCOME_MIN,
            "income_max": INCOME_MAX,
        },
        "grid_assumptions": [
            "Adults are aged 35; children are aged 4, 9 and 14 as household size grows.",
            "All income is modelled as W-2 employment income earned by one adult; "
            "a married couple is modelled as a single-earner couple.",
            "Housing cost is set to zero, so shelter-sensitive benefit rules "
            "(for example the SNAP excess shelter deduction) are not yet reflected. "
            "This understates benefit amounts for renters with high housing costs.",
            "No investment income, self-employment income, or itemised deductions "
            "other than those the engine derives from state and local taxes.",
            "Interpolation between income points is linear. Steps are $2,500 below "
            "$50,000, where credit phase-ins and phase-outs are dense, and widen "
            "to $50,000 in the flat upper range."
        ],
        "income_points": incomes,
        "variables": OUTPUT_VARIABLES,
        "policies": catalog,
        "cells": cells,
    }

    blob = json.dumps(payload, separators=(",", ":"))
    payload["content_hash"] = hashlib.sha256(blob.encode()).hexdigest()[:16]

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, separators=(",", ":")))

    size_kb = out_path.stat().st_size / 1024
    print(
        f"\nwrote {out_path} ({size_kb:.0f} KB, {len(cells)} cells, "
        f"{len(catalog)} policies) in {time.time() - started:.0f}s"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
