"""
Ingest recorded congressional votes and map them to policies in the catalogue.

Bill-first, not candidate-first. We start from a bill whose provisions are
already priced by the rules engine, pull the official roll call, and attach each
member's recorded position. That ordering matters: a candidate record built the
other way round gives you a name and a promise with no mechanism behind it.

Source is senate.gov's own XML, which is the primary record compiled by the
Senate bill clerk. Nothing here is scraped from a news article, a campaign site
or an advocacy scorecard.

ATTRIBUTION WARNING, encoded rather than assumed:
A vote on an omnibus bill is a vote on the whole bill. A senator who voted for
the American Rescue Plan did not cast a vote on the child credit expansion in
isolation, and this pipeline must never imply they did. Every mapping below
carries `attribution: "omnibus"` and the application is required to display that
qualifier next to any figure derived from it.

Usage:
    python pipeline/ingest_votes.py --out src/data/officeholders.json
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

# --- Vehicles -------------------------------------------------------------
# A vehicle is an actual bill. `provisions` lists the catalogue policy ids whose
# mechanism was contained in that bill, with a plain-English note on exactly what
# the recorded vote does and does not establish.

VEHICLES = [
    {
        "id": "hr1319-117-s110",
        "bill": "H.R. 1319",
        "congress": 117,
        "title": "American Rescue Plan Act of 2021",
        "chamber": "senate",
        "roll_call": 110,
        "date": "2021-03-06",
        "question": "On Passage of the Bill (H.R. 1319, As Amended)",
        "result": "Passed 50-49",
        "xml_url": "https://www.senate.gov/legislative/LIS/roll_call_votes/vote1171/vote_117_1_00110.xml",
        "page_url": "https://www.senate.gov/legislative/LIS/roll_call_votes/vote1171/vote_117_1_00110.htm",
        "bill_url": "https://www.congress.gov/bill/117th-congress/house-bill/1319",
        # Both of these catalogue policies are provisions of this bill.
        "provisions": ["ctc_arpa_restore", "eitc_childless_arpa"],
        "attribution": "omnibus",
        "attribution_note": (
            "This was a single vote on a roughly $1.9 trillion bill covering "
            "public health, unemployment insurance, state aid and much else. A "
            "recorded position on the bill establishes that the member voted for "
            "or against a package that contained these provisions. It does not "
            "establish a position on the provisions individually, and it does "
            "not mean the member would support them as standalone legislation."
        ),
    },
]


def fetch_roll_call(url: str) -> list[dict]:
    """Return [{last_name, first_name, party, state, position}] from senate.gov XML."""
    req = urllib.request.Request(url, headers={"User-Agent": "economic-voting-engine/0.1"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        root = ET.fromstring(resp.read())

    members = []
    for m in root.iter("member"):
        def text(tag: str) -> str:
            node = m.find(tag)
            return (node.text or "").strip() if node is not None else ""

        members.append({
            "member_id": text("lis_member_id"),
            "last_name": text("last_name"),
            "first_name": text("first_name"),
            "party": text("party"),
            "state": text("state"),
            "position": text("vote_cast"),
        })
    if not members:
        raise SystemExit(f"No members parsed from {url}. The format may have changed.")
    return members


POSITION_MAP = {
    "Yea": "voted_for",
    "Nay": "voted_against",
    "Not Voting": "did_not_vote",
    "Present": "present",
}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="src/data/officeholders.json")
    ap.add_argument(
        "--offline",
        metavar="PATH",
        help="Read a previously saved payload instead of fetching. Used only to "
             "verify the file parses; never to invent records.",
    )
    args = ap.parse_args()

    if args.offline:
        payload = json.loads(Path(args.offline).read_text())
        Path(args.out).write_text(json.dumps(payload, separators=(",", ":")))
        print(f"copied {args.offline} -> {args.out}")
        return 0

    officeholders: dict[str, dict] = {}
    actions: list[dict] = []

    for vehicle in VEHICLES:
        print(f"fetching {vehicle['bill']} roll call {vehicle['roll_call']}", flush=True)
        members = fetch_roll_call(vehicle["xml_url"])
        print(f"  {len(members)} members", flush=True)

        for m in members:
            key = f"{m['state']}-{m['last_name']}-{m['first_name']}".lower().replace(" ", "-")
            officeholders.setdefault(key, {
                "id": key,
                "name": f"{m['first_name']} {m['last_name']}".strip(),
                "last_name": m["last_name"],
                "party": m["party"],
                "state": m["state"],
                "chamber": vehicle["chamber"],
                "office": "U.S. Senate",
                "record_congress": vehicle["congress"],
            })
            actions.append({
                "officeholder_id": key,
                "vehicle_id": vehicle["id"],
                "action": POSITION_MAP.get(m["position"], "unknown"),
                "raw_position": m["position"],
            })

    payload = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_status": "REAL",
        "record_scope": (
            "Recorded roll call votes only. This file contains no campaign "
            "promises, no candidate filings and no ballot data."
        ),
        "currency_warning": (
            "These are historical records from the 117th Congress. Whether any "
            "of these people currently hold office, or appear on any ballot, is "
            "not established by this file and must not be inferred from it."
        ),
        "vehicles": VEHICLES,
        "officeholders": sorted(officeholders.values(), key=lambda o: (o["state"], o["last_name"])),
        "actions": actions,
    }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"wrote {out} ({out.stat().st_size / 1024:.0f} KB, "
          f"{len(payload['officeholders'])} officeholders, {len(actions)} actions)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
