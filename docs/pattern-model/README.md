# Patterns as instructions: a domain model proposal

Status: **draft for discussion**, nothing implemented. `proposal.html` beside
this file is the illustrated version the owner has read; this Markdown carries
the same proposal plus the working notes behind it.

## The idea

A design is compiled once, **in CI**, into an immutable sequence of
instructions. The site only interprets it. Progress is a place in that
sequence, and a project always points at the exact version it started on.

The owner's framing: "a sequence of instructions produces a unique pattern;
your progress becomes an index in the instruction array. Some instructions
include working (knit, purl, increases, decreases), others are inert (placing
markers, changing needles, turning the work), and some in between influence
the construction without adding stitches (joining in the round, putting
stitches on hold)." They want it extensible: **many types of a given
instruction** (cast-ons, increases...) and **composite instructions** that show
several atomic ones as one on-screen instruction (joining in the round is "a
knit and a join which subtracts a knit"; German short-row turns; casting on and
joining the underarm).

## Why now

- The shaping solver (`src/data/sweaters/wool-week/strips/shaping.ts`) runs in
  the browser inside `buildSweater`. New shaping rules (see "Related work"
  below) made it 4-20x slower: up to 10 s for one size on a desktop.
- A change to a design's knitting moves every saved project's progress, which
  is a stitch index. The owner is mid-knit (Each Year Once, size L,
  colourway "Night journey, in step, gentler", yoke round ~55), and PR #90 is
  on hold because it would re-shape rounds they have already knitted. The
  existing `revisions` mechanism can only describe *added steps*, not changed
  knitting.

## What's there today

| Layer | Where | What |
| --- | --- | --- |
| Written pattern | `src/data/sweaters/types.ts` (`Size.sections`, `RoundSpec`, `ShapingOp`, `DivideSegment`, `MarkerAt`, `Chart`) | castOn, join, needles, rounds, shaping (`[m1, k8] x 29`), chart, divide, walk, piece, shortRows, bindOff. The samplers generate theirs (`wool-week/strips/knit.ts` + the solver); other designs write theirs from grading tables. |
| Expansion | `src/knitting/engine.ts` (`buildSweater`) driving `src/knitting/needles.ts` (`Needles`) | Emits a flat `Stitch[]` (`src/types/Stitch.ts`): one record per loop of fabric, plus *step* records (`join`, `needles`, `hold`, `resume`, `turn`, `marker`). Each has `links` (the loops it works, then the stitch before it), `slot`, `piece`, `wrongSide`, step params. Runs in the browser; cached per design/size in `knitting/useSweater.ts`. |
| Kinds | `src/types/StitchType.ts` | One flat union: castOn k1 p1 k1tbl m1 kfb kbf k2tog ssk s2kp sk2p sl1po pickUp bindOff bindOffPurl + the steps. `consumption`, `stepTypes`, `makesTwo`. |
| Progress | `src/knitting/progress.ts` (`indexRounds`, `positionOf`, runs and words), `helpers/projects.ts` | Progress = id of the last record worked. Rounds, labels, the knitting panel's runs ("knit 12", "[k1, p1]"), the time log all derive from it. |
| Sides | `src/knitting/sides.ts` | Records store how a stitch *looks from the right side* plus `wrongSide`; `workedAs` turns that back into what is done. |
| Key | `src/knitting/stitch-key.ts` | Wording, how-to, alternatives per stitch; designs override with `stitchNotes`. Already distinguishes the neck's long-tail cast-on from the underarm's knitted one, by context. |
| Revisions | `src/helpers/revisions.ts`, `SweaterPattern.revisions` | Only "kinds of step added"; progress is moved past them. |
| Physics | `src/physics/*`, `src/data/sweaters/settled/*`, `scripts/settle.mjs` | Settled positions per stitch id, keyed by a topology fingerprint. |
| CI precedent | `.github/workflows/settle-missing.yml`, `scripts/settlement-plan.mjs --check` | Settles stale sizes on main in plain Node and commits them; `--check` fails CI when a settle is stale. The exact model to copy for compiled patterns. |

Where today's record type is strained:

- **Join** is a step that rewires the first cast-on's `links` (`Needles.join`);
  the knitter's method (cast on one more, lift the first over it) is not in
  the stream.
- **KFB** is two records, `kfb` then an `m1` held by the same stitch, that code
  must recognise as a pair (`makesTwo`): a composite in disguise.
- **Turn** implies the German double stitch ("turn and make a double stitch")
  without the double stitch being anything you can point at.

Concrete atoms from size L (stitch ids):

- Neck: `castOn` ids 0-152 (0 is the phantom record that starts the cast-on, so 152 cast-on stitches), `join` (153), `marker` new beginning (154), rib.
- Short rows: `k1` x4, `turn` (1548), `k1` x3 ... six turns in all.
- Divide: `k1`..., `hold` (32161, count = sleeve stitches), `castOn` x14 (underarm), `k1`...; again at 32348.
- Sleeve: `resume` (91230), `pickUp` x7, `k1` x100 (the held stitches), `pickUp` x7, `marker`.

## Proposal

### 1. Three layers, the boundary in CI

Design source (slow, clever) -> **written pattern** (what a printed pattern
says, round by round) -> **instruction stream** (atoms + spans). Both made in
CI. The browser replays the stream on a model of the needles to derive links,
then draws the chart, panel, 3D, yardage and time.

Keep the written pattern as a published artifact too: it is the readable diff
in a PR (`shaping 344 -> 360`) and the source for a printed-pattern view.

Links are derived by replay, not shipped. That makes the replay part of the
contract, so each version records a hash of its replayed links and the
browser checks it.

### 2. The atom

The smallest action on the needles the rest of the system needs to tell
apart: it makes one loop of fabric, or changes the state of the work without
making any. **Today's granularity, kept on purpose**: one chart cell, one
physics node and every saved project's progress index keep their meaning.

```ts
interface Signature {
  takes: { from: "needle" | "edge" | "holder" | "otherNeedle"; count: number };
  makes: 0 | 1;          // loops of fabric
  live: boolean;         // stays on the needle (knit) or finished (bound off)
  effect?: "join" | "turn" | "hold" | "resume" | "changeNeedles" | "placeMarker" | "removeMarker"
         | "newBeginning" | "startPiece" | "makeDouble" | "wrap" | "joinYarn" | "breakYarn";
}
```

### 3. Kinds: `family.variant`

The family fixes the signature and role (the needle machine reads only the
family); the variant carries what a knitter cares about. A new cast-on is a
registry entry.

| Family | Signature | Variants | Today |
| --- | --- | --- | --- |
| castOn | takes 0, makes 1 live | longTail, knitted, cable, backwardLoop, germanTwisted, tubular, provisional | `castOn` (variant inferred from context) |
| work | takes 1, makes 1 | knit, purl, knitTbl, purlTbl, slipKnitwise, slipPurlwise (yarn front/back) | `k1 p1 k1tbl` |
| increase | takes 0, makes 1 | m1, m1l, m1r, m1p, yarnOver, lifted (L/R) | `m1` |
| split | takes 1, makes 1; next atom takes 0 from the same loop | kfb, kbf, pfb, k1yok1 | `kfb kbf` (+ `m1`) |
| decrease | takes 2-3, makes 1 | k2tog, ssk, p2tog, ssp, k3tog, sssk, s2kp, sk2p | `k2tog ssk s2kp sk2p` |
| bindOff | takes 1, makes 1 not live | knitwise, purlwise, stretchy, sewn, tubular, threeNeedle | `bindOff bindOffPurl` |
| pickUp | takes 0 from an edge, makes 1 | pickUpAndKnit, pickUpPurlwise | `pickUp` |
| passOver | takes 1, makes 0 (fastens it) | liftOver, slipPassOver | `sl1po`; hidden half of join |
| structure | 0/0 | joinInTheRound, turn, startPiece | `join turn` |
| loop | takes 1, makes 1 (same loop changed) | makeDouble, wrap, twist | implicit in `turn` |
| holder | moves loops, makes 0 | hold, resume, graft | `hold resume` |
| needles | 0/0 | changeSize | `needles` |
| marker | 0/0 | place, remove, newBeginning | `marker` + flags |
| yarn | 0/0 | join, break, catchFloat | derived from slot changes |

```ts
interface KindDefinition {
  id: string;               // "decrease.ssk"
  family: Family;
  signature: Signature;
  lean?: "left" | "right" | "centre";
  fromOtherSide?: string;   // knit <-> purl, kfb <-> pfb, ssk <-> ssp
  chartSymbol?: ChartSymbol;
  abbreviation: string;     // "ssk", "M1L", "CO"
  label: string;
  how: string;
  steps?: string[];
  physics?: { width?: number; rise?: number };
  seconds?: number;         // relative time, for estimates
}
```

Designs can still reword kinds (`stitchNotes`) and choose variants per
context; the variant then lives in the stream instead of being inferred.

### 4. Instructions are spans

The stream is flat; everything read on screen is a nested span over it.

```ts
interface Span {
  kind: "piece" | "section" | "round" | "row" | "instruction" | "repeat" | "chartRow" | "check";
  type?: string;            // instruction: "joinInTheRound", "germanTurn", "divide", "kfb"...
  start: number; end: number;   // atom range, end exclusive
  params?: Record<string, unknown>;
  indivisible?: boolean;    // progress may not stop inside it
}
```

- **Join in the round** (indivisible): `castOn.longTail`, `passOver.liftOver`
  - the owner's "a knit and a join which subtracts a knit".
- **German turn** (indivisible): `structure.turn`, `loop.makeDouble`. Wrap and
  turn: `loop.wrap`, `structure.turn`. Short-row methods are variants of a
  composite, not new families.
- **Divide**: `holder.hold` (one step with a count), `castOn.knitted` x14.
- **Start a sleeve**: `holder.resume`, `pickUp` x7, `work.knit` x100,
  `pickUp` x7, `marker.newBeginning`.
- **KFB** (indivisible): `split.kfbFront`, `split.kfbBack`.
- **Repeats**: `[m1, k8] x 29` is a repeat span with 29 passes; chart rows are
  spans carrying chart id and row.

### 5. Sides

Store atoms **as worked**, with a side. Appearance from the right side is a
pure function of kind + side via `fromOtherSide` (what `sides.ts` does today,
the other way round).

### 6. The compiled file

```ts
interface CompiledPattern {
  schema: 1;
  design: string; size: string;
  version: string;               // content hash
  provenance: { commit: string; generator: string };
  kinds: string[];               // dictionary
  slots: string[];               // dictionary
  atoms: number[];               // run-length coded [kind, slot, side, count]...
  params: Record<number, StepParams>;
  spans: Span[];
  checks: Record<string, number>;
  linksHash: string;
}
```

Measured on Each Year Once, L: 121,928 atoms, ~51,000 runs of identical
(kind, yarn); ~1 MB JSON raw, **10-15 KB gzipped** (settled positions are
100-250 KB per size today).

### 7. Versions and progress

- A project stores `{ design, size, version, progress }`; it always loads its
  own version, so nothing published later moves anyone's knitting.
- Moving to a new version is the knitter's choice ("this pattern has been
  updated"), with "knit up to here" to correct progress; the site can show
  where the versions first differ, from the spans.
- The revisions mechanism goes. Today's projects all point at "version 1",
  whose stream is identical to today's build.
- Settled positions are keyed by version.

### 8. Pipeline

1. Compile every design and size; run the stitch-count checks and knitting
   rules.
2. PR validation: compiled files must be fresh (like `settlement-plan --check`),
   so pattern changes arrive as reviewable data diffs.
3. Settle new versions (the existing workflow).
4. Publish hash-named files + a manifest of the latest version per design/size.

### 9. Migration that does not touch the owner's knit

1. Compile what exists: today's `buildSweater` output, today's types as kinds,
   loaded instead of built, with a test that it is identical to the live
   build. Every existing project becomes "version 1".
2. Spans; move the panel and progress onto them.
3. Registry of `family.variant` kinds, first as a mapping from today's types.
4. Honest atoms (join, double stitch, KFB pair) - a new version.
5. Then shaping changes (PR #90, the doubling rules) ship as new versions.

Step 1 alone unblocks PR #90.

## Decisions open for the owner

- Atom granularity: today's (recommended) vs one per knitter action.
- Store as worked + side (recommended) vs as seen.
- Replay links + hash (recommended) vs ship them.
- Yarn joins / float catches: derived spans for now (recommended) vs atoms.
- Keep the written pattern published (recommended).
- Start with migration step 1, then PR #90 as version 2 (recommended).

## Research gaps (not verified)

The cloud session that wrote this could not reach external sites, so the
prior art below is from memory and must be checked:

- **Knitout** (CMU Textiles Lab), https://textiles-lab.github.io/knitout/knitout.html -
  low-level machine-knitting format: knit, tuck, xfer, split, drop, miss,
  carrier ops (in/out/inhook/releasehook/outhook), rack; versioned header;
  higher-level tools compile into it.
- **KnitML** - XML for hand-knitting patterns (typed increases/decreases,
  cast-on styles, markers, repeats; authored vs rendered forms). Original site
  knitml.com and repo locations uncertain; try the Wayback Machine.
- **KnitSpeak** (Stitch Maps), https://stitch-maps.com/about/knitspeak/ - a
  parser for written stitch-pattern instructions.
- **Craft Yarn Council standards**,
  https://www.craftyarncouncil.com/standards/knitting-abbreviations and
  https://www.craftyarncouncil.com/standards/knit-chart-symbols - standard
  abbreviations and chart symbols for the registry.

## Related work in this repository

- **PR #90** (`claude/sweat-shop`): Baa-ble Hat's two missing snowflakes,
  imported from wool-week; changes size L's yoke rounds 47-55 (4 fewer
  stitches); **on hold** until the owner finishes round 55, then to be merged
  as a straight swap.
- **`claude/wider-repeats-wip`**: shaping-solver experiments behind
  environment switches, all off by default: wider repeats (`WIDER`,
  `ANYK`, `SUPER`), equal groups of any size (`ANYGROUPS`, `MINGROUPS`),
  symmetric spacing mirrored about the round's start (`SPREAD`, `NOGROUPS`),
  a plain-round candidate fix (`FIXC`). Harnesses in
  `src/data/sweaters/wool-week/strips/experiments/`. Symmetric spacing is the
  recommended option, not yet chosen by the owner; it is too slow in the browser (~10 s for size L),
  which is what motivated precompiling.
