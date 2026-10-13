#!/usr/bin/env python3
"""Rebuild the yarn library, and bring every hat's shades back into step.

An authoring tool, run by hand when a better reading of the spinners' colours
turns up. Its output is reviewed and committed; the site never fetches
anything.

There are two halves to it, and only the first one is interesting.

  The library itself - src/data/yarns/shetland-yarns.json - is written from a
  catalogue of Shetland wool: one entry per shade, with a spinner, a yarn, a
  colour, a shade number and a link to buy it. It is stored grouped by yarn
  rather than as a flat list of shades, because that is how wool is sold, how
  it is shopped for, and because a range then names its spinner once instead
  of two hundred and twenty-seven times.

  The hats' own shades are copies out of it, inline, so that drawing a hat
  never loads nine hundred shades. Each says which wool it is by id, and this
  re-copies the name, the number and the colour for every one of them. Which
  is why this is not a matching problem: the hard part - deciding that 2025's
  "Shade 96" is Jamieson & Smith's Pale Lemon, that its Uradale "Grall" was a
  mistyped Graeff, that 2021 works one yarn in Shetland Supreme and five in
  ordinary 2ply - was done once, by hand and against the printed pages, and
  is recorded in the hat files. A new reading of the colours does not change
  any of it.

  Shades with no `wool` are left alone. They are Foula Wool and 2021's
  handspun, neither of which sells online in a form that can be read.

Run it as:

    python3 scripts/refresh_yarns.py CATALOGUE.json [PALETTE.json]

where CATALOGUE.json carries a "colours" list of entries with an id, a
manufacturer, a range, a range_id, a yarn_weight, a colour_name, a
shade_code, a hex and a product url. The optional PALETTE.json is the same
shades keyed by id, and is used only for its buy links where it has better
ones. Anything the hats point at that the new catalogue has dropped is
reported and left as it was, rather than quietly losing a colour.

Afterwards, `npm test` checks every copy against the library it came from.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIBRARY = ROOT / "src/data/yarns/shetland-yarns.json"
HATS = sorted((ROOT / "src/data/hats").glob("sww*.ts"))

# A shade as the hat files write it: everything readable on one line, the
# library key on the next. Matched over the whole file rather than line by
# line, because a shade is two lines.
SHADE = re.compile(
    r'^(?P<indent>[ ]*)\{ slot: "(?P<slot>[A-H])",(?P<rest>.*?)\},$',
    re.S | re.M,
)


def build_library(catalogue: dict, palette: dict | None) -> dict:
    """The library, grouped by yarn and ordered so diffs stay readable."""
    ranges: dict[str, dict] = {}
    colours = catalogue["colours"]
    for colour in sorted(
        colours, key=lambda c: (c["manufacturer"], c["range"], c["colour_name"])
    ):
        spun = ranges.setdefault(
            colour["range_id"],
            {
                "spinner": colour["manufacturer"],
                "range": colour["range"],
                "weight": colour["yarn_weight"],
                "colours": {},
            },
        )
        also = (palette or {}).get(colour["id"], {})
        entry = {
            "name": also.get("name") or colour["colour_name"],
            "hex": (also.get("hex") or colour["hex"]).lower(),
            "url": also.get("buy_url") or colour["product_url"],
        }
        code = also.get("code") or colour.get("shade_code")
        if code:
            entry["code"] = str(code)
        available = also.get("available")
        if available is None:
            available = colour.get("availability") != "unavailable"
        if not available:
            entry["soldOut"] = True
        spun["colours"][colour["id"]] = entry
    return {
        key: ranges[key]
        for key in sorted(ranges, key=lambda k: (ranges[k]["spinner"], ranges[k]["range"]))
    }


def shades_of(library: dict) -> dict:
    return {
        wool_id: {**shade, "range_id": range_id}
        for range_id, spun in library.items()
        for wool_id, shade in spun["colours"].items()
    }


def restate(indent: str, slot: str, wool_id: str, shade: dict) -> list[str]:
    """One shade, written the way the hat files write them."""
    bits = [f'slot: "{slot}"', f'name: "{shade["name"]}"']
    if shade.get("code"):
        bits.append(f'code: "{shade["code"]}"')
    bits += [f'hex: "{shade["hex"]}"', 'source: "library"']
    key = f'wool: "{wool_id}"'
    head = indent + "{ " + ", ".join(bits) + ","
    # Keep the line inside the width the rest of these files sit in, moving
    # fields down to join the key rather than wrapping one per line.
    while len(head) > 92 and len(bits) > 2:
        key = bits.pop() + ", " + key
        head = indent + "{ " + ", ".join(bits) + ","
    return [head, indent + "  " + key + " },"]


def main() -> int:
    if not 2 <= len(sys.argv) <= 3:
        print(__doc__)
        return 2
    catalogue = json.loads(Path(sys.argv[1]).read_text())
    palette = json.loads(Path(sys.argv[2]).read_text()) if len(sys.argv) == 3 else None

    library = build_library(catalogue, palette)
    LIBRARY.write_text(
        json.dumps(library, indent=0, separators=(",", ":"), ensure_ascii=False)
    )
    shades = shades_of(library)
    print(
        f"{LIBRARY.relative_to(ROOT)}: {len(library)} yarns, {len(shades)} shades"
    )

    counted = {"restated": 0, "lost": 0}

    def rewrite(match: re.Match) -> str:
        wool = re.search(r'wool: "([^"]+)"', match.group("rest"))
        if not wool:
            return match.group(0)
        shade = shades.get(wool.group(1))
        if shade is None:
            print(f"  ! {match.group('slot')}: no such wool as {wool.group(1)}")
            counted["lost"] += 1
            return match.group(0)
        counted["restated"] += 1
        return "\n".join(
            restate(match.group("indent"), match.group("slot"), wool.group(1), shade)
        )

    stand_ins = 0
    for path in HATS:
        text = path.read_text()
        path.write_text(SHADE.sub(rewrite, text))
        stand_ins += path.read_text().count('source: "approximate"')

    print(
        f"{counted['restated']} shades restated, {stand_ins} left as stand-ins,"
        f" {counted['lost']} lost"
    )
    return 1 if counted["lost"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
