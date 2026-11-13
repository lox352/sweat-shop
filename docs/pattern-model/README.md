# Patterns as instructions: a domain model proposal

Status: **second draft for discussion. Nothing is implemented.**

- The first draft was written without web access. This revision checks its prior art against primary sources and its picture of today's code against the code itself, at `main` 9d926ca. It also tests the proposed model against hard cases.
- `proposal.html` beside this file is still the illustrated **first** draft. Where they disagree, this file is right; see "Changes from the draft" below.
- All example stitch ids are from a build of the repository at that commit.

## Changes from the draft

1. **The atom stays, with a sharper definition.** An atom is one thing a knitter does that makes at most one new loop of yarn; a step makes none. Every system I checked draws its line in the same place:
   - Knitout's operations each make at most one loop.
   - Stitch meshes have one face per stitch.
   - KnitSpeak has one symbol per stitch, with a turn *between* columns.

   So chart cells, physics nodes and saved progress stay one-to-one. (See "The atom".)
2. **The draft's signature was not enough; kinds become recipes.** The draft gave each family a fixed signature: takes, makes, live, effect. That could not describe these five cases:
   - a three-needle bind-off, which takes from two needles at once;
   - grafting, which makes a loop that never goes on a needle;
   - the first half of a KFB, which works into a stitch without taking it off the needle;
   - a slip, which moves a loop without making one;
   - `sl1po`, which the draft got wrong: it keeps a stitch and fastens the one before it.

   Each kind is now a short **recipe** of a few needle-machine moves, in the spirit of Knitout's abstract machine. The site replays the moves, so a new kind needs no new site code. (See "Kinds".)
3. **Short-row methods are not variants of one atom.** German, wrap-and-turn, Japanese and shadow-wrap short rows differ in which loops and strands they make and later consume. A shadow wrap even makes an extra loop. A short-row method is a choice the compiler expands into different atoms; it is not a label on a `turn`. (See "Short rows".)
4. **"Indivisible" is split in two.** A span (a stretch of atoms read as one instruction) can be *said as one* (the panel shows it as one instruction) or *done as one* (progress never rests inside it). Saved progress is never rewritten to honour either; the site interprets it.
5. **The draft named the project's pinned version `version`, which would have broken every project.** `Project.version` already exists. It is the storage format (`1`), and `readProject` rejects any other value. The pinned compiled pattern is called the **edition** instead.
6. **Pinning projects to an edition reverses a principle of today's code, and that's your decision.** `helpers/projects.ts` says a project "never held a copy" of the chart, so it "still opens after a chart is corrected". Pinning keeps knitting stable, but corrections stop reaching knitters on their own. It is now an open decision, with a recommendation.
7. **Settled 3D is keyed by topology, not by edition.** Editions that differ only in steps, wording or markers share one settle, as today, and old settles are kept so pinned projects still render.
8. **The CI precedent was misdescribed.**
   - Pull requests do not run `settlement-plan --check`. That runs only on pushes to `main`, in `settle-missing.yml`, to decide whether to settle.
   - What does fail a pull request is `settled.test.ts`, inside `npm test`, when a size has no settled file or the file's length no longer matches the fabric.
9. **PR #89 needs the same hold as PR #90.** It moves make-ones in both Wool Week samplers' yokes, including rounds of Each Year Once L that you have already knitted. It changes no stitch counts, so no id moves, but the knitting at those ids changes.
10. **The prior-art section is verified and expanded,** with sources. (See "What prior systems do".)
11. **Smaller corrections:**
    - Measured: size L has 121,932 records, not 121,928. Kind, yarn and side form 51,579 runs.
    - The compact stream (kinds, yarns and runs only) is 8.7 KB gzipped. Shipping the full record list with its links would be 1.07 MB gzipped per size.
    - The phantom stitch 0 is the join's extra cast-on stitch, placed *before* the cast-on rather than at the join. The draft said the extra stitch wasn't in the stream at all.

## Terms

- **Loop**: one loop of yarn in the fabric, the thing a stitch is.
- **Atom**: one record in the compiled stream (today, one `Stitch`). Either it makes at most one new loop, or it is a **step** that changes the state of the work and makes none. Progress is a position among atoms.
- **Kind**: what an atom is, written `family.variant`, such as `decrease.ssk` or `castOn.longTail`.
  - The **family** is the role: increase, decrease, cast-on...
  - The **variant** is the method a knitter would name.
- **Recipe**: the needle-machine moves a kind stands for (take, make, keep, slip, pass over...). See "Kinds".
- **Span**: a stretch of consecutive atoms read as one thing: a round, a repeat, "divide for the sleeves", a KFB.
- **Written pattern**: what a printed pattern says, round by round. Today's `RoundSpec`s.
- **Stream**: the flat list of atoms, plus the spans over it.
- **Edition**: one compiled stream for one design and size, named by a hash of its knitting. Immutable once published.
- **Replay**: running the stream through a model of the needles to work out what each loop is worked into (the links).

## The idea

A design is compiled once, **in CI**, into an immutable stream of atoms with spans over it. The site only interprets it.
- A project records the edition it was started on, and its progress is a position in that stream.
- Nothing published later moves anyone's knitting unless they choose to move.

Your framing still holds:
- **Work:** some instructions do work (knit, purl, increases, decreases).
- **Inert:** some do none (placing markers, changing needles, turning).
- **In between:** some shape the construction without adding stitches (joining in the round, putting stitches on hold).
- **Extensible:** there are many methods of each, and composite instructions that show several atoms as one on screen.

## What's there today (checked against the code)

| Layer | Where | What |
| --- | --- | --- |
| Written pattern | `src/data/sweaters/types.ts`: `Size.sections`, `RoundSpec`, `ShapingOp`, `DivideSegment`, `MarkerAt`, `Chart` | `RoundSpec` is one of `castOn`, `join`, `needles`, `rounds`, `shaping`, `chart`, `divide`, `walk`, `piece`, `bindOff`, `shortRows`. A divide segment can `hold` with `wrap`, cast on in the holder's place, `close: "slipPassOver"`, and place a marker part way through the cast-on. The Wool Week samplers generate their written pattern (`wool-week/strips/knit.ts` plus the shaping solver); other designs write theirs from grading tables. |
| Expansion | `src/knitting/engine.ts` (`buildSweater`) driving `src/knitting/needles.ts` (`Needles`) | Produces a flat `Stitch[]` (`src/types/Stitch.ts`): one record per loop of fabric, plus *step* records. `links` lists the stitches it works, then the stitch the yarn ran on from. Also `slot`, `piece`, `wrongSide`, `from` (a pick-up's edge stitch), and step fields (`holder`, `count`, `wrap`, `marker`, `begins`, `removed`, `needles`). After building, every stitch is stamped with the needle size it is worked on. Doubled-column copies carry a hidden `spacer` flag. Runs in the browser, cached per design and size in `knitting/useSweater.ts`. |
| Kinds | `src/types/StitchType.ts` | One flat union of 21: `castOn k1 p1 k1tbl m1 kfb kbf k2tog ssk s2kp sk2p sl1po pickUp bindOff bindOffPurl` plus the steps `join needles hold resume turn marker`. `consumption` gives how many loops each takes; `makesTwo` marks KFB and KBF, whose second loop is the `m1` straight after. |
| Progress | `src/knitting/progress.ts`, `src/helpers/projects.ts` | `Project.progress` is the id of the last record worked (0 = nothing yet). The panel's runs ("knit 12", "(k1, p1)"), rounds and labels all derive from it. A KFB pair is reported as one run. End of round stops before any step part way round. |
| Saved projects | `src/helpers/projects.ts`, `src/knitting/timing/log.ts` | `Project.version` is the storage format (`currentVersion = 1`); `readProject` rejects any other value. `revision` is optional. The knitting-time log records each change *in progress*, so moving progress means moving the log too, which `revisions.ts` does. |
| Sides | `src/knitting/sides.ts` | Records store what a stitch looks like from the right side, plus `wrongSide`. A purl worked from the wrong side is stored as `k1`, and a PFB as `kbf`. `workedAs` turns that back into what you do; `reverseOf` pairs each stitch with its look from behind. |
| Key | `src/knitting/stitch-key.ts` | Wording, how-to and alternatives per stitch; designs override them with `stitchNotes`. It tells the neck's long-tail cast-on from the underarm's knitted one **by context** (`castOnPartWay`), not by kind. |
| Revisions | `src/helpers/revisions.ts`, `SweaterPattern.revisions` | Can only say "these kinds of *step* were added". Progress is moved past them, and the time log with it. One design uses it: Paul Klee, for its markers. |
| Physics | `src/physics/*`, `src/data/sweaters/settled/*`, `scripts/settle.mjs` | One settled file per design and size, holding a position for every *fabric* stitch (steps and the phantom stitch 0 left out). The file is overwritten when re-settled. `scripts/settlement-manifest.json` holds one fingerprint per design: the physics source plus every size's fabric topology (`settled/topology.ts`, which leaves out colours and steps). Adding steps therefore never forces a re-settle. |
| CI | `.github/workflows/validate.yml`, `settle-missing.yml`, `scripts/settlement-plan.mjs` | Pull requests run lint, unit tests (including `settled.test.ts`'s length check), build, budgets and the browser tests. On push to `main`, `settle-missing.yml` uses `settlement-plan --check` to decide whether to settle, settles in plain Node, commits the files and triggers a deploy. That is the model to copy for compiled patterns. |

Where today's records are strained, with real ids:

- **The join.** Size L casts on records 0-152:
  - **0** is a "phantom" `castOn` with no links. It is the extra stitch a join casts on and lifts over, but it sits at the *start* of the cast-on so that a project with nothing knitted has progress 0.
  - **153** is `join`. It rewires stitch 1's links to point at 152.
  - So "cast on one more" is in the stream but in the wrong place, and "lift it over" is not in it at all.
- **KFB.** Paul Klee, size M2:
  - 2316 is `kfb`, links `[2205, 2315]`;
  - 2317 is `m1`, links `[2205, 2316]`.

  The second loop is stored as a make-one (which it isn't), and code must recognise the pair (`makesTwo`). Felines raglan, size XL, has `kbf` 2301 + `m1` 2302 beside `kfb` 2303.
- **The turn.** Size L has six (`turn` 1548, 1596, 1652, 1716, 1788, 1868). The panel says "turn and make a double stitch", but the double stitch is nothing you can point at, and the later stitch that works it "as one" is a plain `k1`.
- **Divide with a wrap and a closing slip.** Paul Klee, size M2, ids 21991-22004:
  - marker off, then `hold` (sleeve-right, 80, **wrap**), then marker off;
  - `castOn` ×4, then a marker placed as the new beginning of the round, then `castOn` ×5;
  - `sl1po` (22004), links `[21679, 22003]`: it slips held-back stitch 21679 and passes the last cast-on, 22003, over it.

  The wrap is a flag on the hold, not an action you can see. `sl1po` *keeps* a stitch and fastens the one before it.
- **Divide, simple.** Each Year Once, size L: `hold` 32161 (sleeve-right, 100), then `castOn` ×14 (32162-32175), then knitting resumes at 32176. Again at 32348.
- **Sleeve start.** Size L, ids 91230-91345:
  - `resume` 91230 (sleeve-left, 100);
  - `pickUp` ×7, 91231-91237, out of underarm stitches 32355 back to 32349;
  - `k1` ×100, 91238-91337;
  - `pickUp` ×7, 91338-91344;
  - `marker` 91345, "the start of the left sleeve's rounds".

Size L in numbers: 121,932 records. They are:
- **Fabric:** 116,244 `k1`, 4,240 `p1`, 189 `k1` worked from the wrong side, 412 `m1`, 112 `k2tog`, 181 `castOn`, 28 `pickUp`, 254 each of `bindOff` and `bindOffPurl`.
- **Steps (18):** 1 join, 3 markers, 4 needle changes, 6 turns, 2 holds, 2 resumes.

## What prior systems do (verified)

| System | What it is | Unit of work | Variants | Authored form vs expanded form | Composites |
| --- | --- | --- | --- | --- | --- |
| **Knitout** ([spec](https://textiles-lab.github.io/knitout/knitout.html), document v0.6, magic line `;!knitout-2`) | Low-level, machine-independent instructions for knitting machines | One operation per line, one needle at a time. `knit`, `tuck` and `split` each form one new loop; `xfer`, `drop` and `miss` form none | None. The language is deliberately "low-level… no flow-control, abstractions, or grouping primitives" | Output-only: "Knitout contains exactly the instructions required to fabricate a knit object"; design tools compile into it. `;!source:` comments tie each line back to the source that produced it | None. A decrease is not an operation: you transfer loops onto one needle, then `knit` pulls one loop through all of them. `split` is the one built-in combination ("knit… transferring the old loops"); `drop`, `amiss` and `xfer` are synonyms for yarnless `knit`, `tuck` and `split` |
| **KnitML** ([source on GitHub, exported from Google Code](https://github.com/fiddlerpianist/knitml); schema [`operations-0.7.xsd`](https://github.com/fiddlerpianist/knitml/blob/master/knitml/trunk/knitml-core/src/main/resources/com/knitml/core/xml/operations-0.7.xsd)) | XML for hand-knitting patterns | Operations in three groups. **Atomic inline** (inside a row): `knit`, `purl`, `decrease`, `double-decrease`, `increase`, `increase-into-next-stitch`, `slip`, `cross-stitches`, `turn`, `place-marker`, `remove-marker`, `inline-cast-on`, `slip-to-stitch-holder`, `from-stitch-holder`, `pass-previous-stitch-over`, `bind-off`, `no-stitch`... **Composite inline**: `repeat`, `group`, `inline-instruction`, `using-needle`. **Atomic block** (outside rows): `cast-on`, `join-in-round`, `pick-up-stitches`, `declare-flat-knitting`/`declare-round-knitting`, `arrange-stitches-on-needles`, `use-needles`, `graft-together`, `label-needle` | An attribute. `increase type=` is one of `m1 m1p m1a m1t m1l m1r m1lp m1rp kll krl pll prl kfb pfb moss decorative yo`. `decrease type=` is one of `ssk k2tog ssp p2tog skp k2tog-tbl p2tog-tbl`. `double-decrease` is one of `cdd sk2p k3tog k3tog-tbl p3tog p3tog-tbl sssk`. `bind-off` and `pick-up-stitches` are knitwise or purlwise. **Cast-on `style` is free text** ("e.g. 'long-tail', 'cable'") | Yes. Knitting Expression Language (KEL) is the authored form; `knitml convert` turns it into KnitML, `knitml validate` "validates and test-knits" it, and `render` writes text ([samples README](https://github.com/fiddlerpianist/knitml/blob/master/knitml/trunk/knitml-distribution/samples/README.txt)). Validation fills in computed values: `turn`'s `stitches-left` "can be calculated by a pre-processor". The validated form is still the pattern with annotations, not a flat stream | KFB is one `increase`. `increase-into-next-stitch` holds a sequence of `knit`/`purl` worked into one stitch, "the number of elements… dictates the number of stitches". `turn` is just "Turn the work without working stitches": no short-row method |
| **KnitSpeak** ([guide](https://stitch-maps.com/about/knitspeak/), [abbreviations](https://stitch-maps.com/about/abbreviations/)) | Stitch Maps' dialect of written stitch-pattern instructions | One symbol per stitch. Note the line it draws: "turn symbols sit *between* columns of stitches", but "each w&t symbol stands for a wrapped stitch, and *is part of* a stitch column" | Abbreviations, each with its other-side pair ("M1L on RS, M1Lp on WS") | Written rows in, a chart without a grid out | Brackets for fixed repeats; `*… rep from *` for the one stretch of adjustable width per row. Every row must "use up" the stitches of the row before, except short rows, which end in `turn` or `w&t`. `CO` counts as an increase and `BO` as "a sort of decrease" inside rows |
| **Craft Yarn Council** ([abbreviations](https://www.craftyarncouncil.com/standards/knitting-abbreviations), [chart symbols](https://www.craftyarncouncil.com/standards/knit-chart-symbols)) | The US industry's standard abbreviations and chart symbols | One chart symbol per stitch; "for the most part each symbol represents a stitch as it looks on the right side of the work", given as pairs ("K on RS, p on WS") | Abbreviations with their lean (table below) | n/a | Cables are single symbols over several stitches ("2/2 RC") |
| **McCann et al. 2016**, "A Compiler for 3D Machine Knitting" ([doi](https://doi.org/10.1145/2897824.2925940), [pdf](https://la.disneyresearch.com/wp-content/uploads/A-Compiler-for-3D-Machine-Knitting-Paper.pdf)) | Compiles "assemblies of high-level shape primitives (tubes, sheets) into low-level machine instructions" | An abstract machine: each needle holds an ordered list of loops. `loop(y, d, n)` makes a new loop; `knit` pulls it "through all of the loops currently held"; `tuck` adds one; `xfer` moves them | n/a | Yes: shape primitives, then machine operations | Shaping is planned as transfers ("transfer planning… for knit cycles") |
| **Lin et al. 2023**, "Semantics and Scheduling for Machine Knitting Compilers" ([page](https://textiles.cs.cmu.edu/publications/2023-knitout-semantics/)) | A formal semantics for Knitout ("fenced tangles") | Knitout operations | n/a | Gives "a mathematical definition of knitting program equivalence": different instruction sequences can knit the same object | Rewrite rules proven to preserve the object |
| **Stitch meshes** (Yuksel et al. 2012, [page](http://www.cemyuksel.com/research/stitchmeshes/)); augmented stitch meshes ([Narayanan et al. 2019](https://textiles.cs.cmu.edu/publications/2019-visualknit/)) | A mesh whose faces are stitches | One face per stitch. The 2019 version "stores low-level knitting operations per-face and encodes the dependencies between faces using directed edge labels" | Stitch types assigned to faces | Mesh, then a scheduled machine program | n/a |
| **Instruction graphs** ([Lin et al. 2024](https://textiles.cs.cmu.edu/publications/2024-instruction-graphs/)) | An intermediate representation for all machine-knitting programs | Instructions as graph nodes | n/a | A graph that is "upward, forward, and ordered" can be turned into a program | n/a |
| **KnitScript** (Hofmann et al., UIST 2023, [doi](https://doi.org/10.1145/3586183.3606789)) | A scripting language with "a comprehensive virtual model of knitting machines" | Abstract only, see "What I couldn't verify" | | | |

What this says about our model:

- **The atom line is the common one.**
  - Every machine-level system makes at most one loop per operation, and every hand-knitting system has one symbol per stitch.
  - KnitSpeak's split between `turn` (between columns) and `w&t` (part of a column) is exactly our split between steps and loops.
- **Decreases are a consequence, not a primitive.** In Knitout and McCann's machine, "takes two" is not a property of an operation. Two loops are on one needle and one new loop is pulled through both. A recipe over a few needle moves (see "Kinds") is the hand-knitting version of the same idea.
- **Free-text variants are a trap.** KnitML's cast-on `style` is free text, so nothing downstream can rely on it. Our variants drive the key, the time estimate, yardage and possibly physics, so they must come from a registry.
- **The authored and expanded forms really are separate, but don't pretend the stream is unique.**
  - KnitML separates "directions" from a validated, test-knitted form, and Knitout is purely the compiled end.
  - Lin et al. show that different sequences can make the same object. An edition's identity should therefore be a hash of the *stream* (what you are told to do). "Is this the same fabric?" is a separate question about the replayed links (see "Settled 3D").
- **Keep source references.** Knitout's `;!source:` comments are cheap and make CI failures readable: spans should carry a reference to the `RoundSpec` that produced them.

### Abbreviations and leans (from the Craft Yarn Council unless marked)

| Ours today | Standard | CYC says | Note |
| --- | --- | --- | --- |
| `k2tog` | k2tog | "single right-leaning decrease" | |
| `ssk` | ssk | "single left-leaning decrease" | Also SKP, "single left-leaning decrease"; ksp is "single right-leaning" |
| `sk2p` | SK2P | "double left-leaning decrease" | Matches our "leans". sssk is also double left-leaning |
| `s2kp` | **S2KP2** | "centered double decrease" | Our name differs from CYC's; KnitML and Stitch Maps call it `cdd` / sl2-k1-p2sso |
| `m1` | M1 / M1K | "make one stitch knitwise; single knit increase" | M1L "single left-leaning", M1R "single right-leaning", M1p, M1lp, M1rp |
| `kfb` | kfb | "single knit increase" | pfb likewise for purl |
| `kbf` | not on the list | | A design-specific mirror of KFB: define it in the key |
| (none) | yo, byo, yon | yarn over; backward yarn over | |
| (none) | lifted increases | chart symbols only: "Right-slanting lifted inc", "Left-slanting lifted inc" | KnitML: `krl`/`kll`; Stitch Maps: incR/incL |
| `castOn` | CO | "cast on" | **No standard abbreviations for cast-on methods**; they are named in words |
| `bindOff` | BO | "bind off" | No standard for methods either |
| `marker` | pm, sm, m | place marker, slip marker, marker | **No "rm"** on the list; patterns define it themselves |
| `turn` | w&t | "wrap and turn" | **No abbreviation for German short rows or a double stitch** (patterns use "DS" and define it) |
| `pickUp` | none | | KnitML: `pick-up-stitches type=knitwise/purlwise` |
| `hold` / `resume` | none | | "Stitch holder" and "waste yarn" are spelled out in patterns |
| `sl1po` | sl, psso | slip; "pass slipped stitch over" | Ours passes the *cast-on* stitch over the slipped one, the reverse of psso: say it in words |

Two cautions:
- The chart-symbol page labels one symbol "SK2P on RS, SSSK on RS, SSSP on WS", which looks like a typo; the abbreviations page is clearer.
- [Wikipedia's increase article](https://en.wikipedia.org/wiki/Increase_(knitting)) describes M1R and M1L with handedness that contradicts both CYC and Stitch Maps, and calls them "decreases". Trust CYC and Stitch Maps.

## Proposal

### 1. Three layers, the boundary in CI (unchanged)

Design source (slow, clever) → **written pattern** (`RoundSpec`s: what a printed pattern says) → **stream** (atoms + spans). The stream is compiled in CI. The browser replays the stream on a model of the needles to work out links, then draws the chart, the panel, the 3D model, yardage and time.

Publish the written pattern too:
- It is the readable diff in a pull request ("shaping 344 → 360").
- It is the source for a printed-pattern view.
- Like KnitML's validated form, it can carry values the compiler worked out ("turn with 37 stitches left").

### 2. The atom

**One thing a knitter does that makes at most one new loop of yarn; or a step, which makes none but changes the state of the work.**
- Today's granularity is kept, so chart cells, physics nodes and every saved project's progress keep their meaning.
- Everything finer (inserting the needle, wrapping the yarn) belongs in the how-to text.
- Everything coarser (a KFB, a divide, a short row) is a span.

Why not one atom per knitter action, so that a KFB is one? Because then one atom could make two loops. Its chart cells, physics nodes and progress would stop being one-to-one, and every existing project's progress past the first KFB would move. KnitML takes the coarser route (one `increase type="kfb"`) because it never needs to address individual loops; we do.

### 3. Kinds: families, variants and recipes

A kind is `family.variant`. Each kind has a **recipe**: a few moves on a small model of the needles, close to Knitout's abstract machine. The replay knows only the moves, never the kinds, so a new kind is an entry in a registry, shipped in the compiled file, with no site code.

The moves:

| Move | Meaning |
| --- | --- |
| `take(n, from)` | Take the next `n` loops off a source: the working needle by default, or a named needle, a holder, or an edge's stitches |
| `into(source)` | Work into without taking off: the stitch stays where it is (the first half of a KFB) |
| `bar` / `strand` / `edge(id)` / `below(id)` | What a new loop is drawn through, when it isn't a loop on a needle: the bar between stitches (M1), nothing (yarn over, cast-on), an edge stitch (pick-up), the stitch below (lifted increase, shadow wrap) |
| `make` | Draw one new loop of yarn through what was taken |
| `slip` | Move the taken loop to the right needle unchanged: no new yarn |
| `keep` / `finish` | The new loop goes on the right needle, or is fastened off (bind-off, graft) |
| `passOver` | Lift the previous loop over this one, fastening it |
| `mark(state)` | Change a loop without making one (a German double stitch, a wrap) |
| step moves | `join`, `turn`, `hold`, `resume`, `needles`, `marker`, `cut` (for steeks): the state changes the needle model already has |

Testing the moves on the cases you named, and on today's kinds:

| Kind | Recipe | Draft's signature? |
| --- | --- | --- |
| `work.knit` (k1) | `take(1) make keep` | fine |
| `decrease.k2tog`, `decrease.ssk` | `take(2) make keep`; the lean is a property of the variant, for the key and physics | fine |
| `split.kfb` (two atoms) | first: `into(1) make keep`; second: `take(1) make keep` | **no**: "takes 1, next takes 0 from the same loop" can't say the first leaves the stitch on the needle |
| `increase.m1l` / `m1r` | `bar make keep` (lean in the variant) | fine |
| `increase.yarnOver` | `strand make keep`. It makes a loop from nothing; physics should know it leaves an eyelet | fine |
| `castOn.longTail` | `strand make keep` | fine |
| `castOn.provisional` | `strand make keep`, and it marks its edge **releasable**. Later a `release(edge)` step turns the edge into a holder whose loops are drawn from the cast-on stitches (like `pickUp.from`), and a `resume` takes them up | **no**: the draft had no way to make an edge become live stitches |
| `bindOff.knitwise` | `take(1) make passOver keep`; the last loop of the round is finished | roughly |
| `bindOff.threeNeedle` | `take(1, front) take(1, back) make passOver keep` | **no**: two sources |
| `graft.kitchener` | `take(1, front) take(1, back) make finish`; the yarn is sewn, so no loop goes onto a needle | **no**: two sources, not live |
| `slip.purlwise` | `take(1) slip` | **no**: no new loop |
| `sl1po` (today) | `take(1) slip passOver`: keeps a stitch, fastens the last cast-on | **wrong**: the draft had "takes 1, makes 0" |
| `pickUp.knit` | `edge(id) make keep` | fine |
| German double stitch | not an atom. The `turn.german` step does `turn` + `mark(doubled)` on the stitch just worked; the later stitch is `work.knitDouble`: `take(1) make keep`, the one loop now doubled | the draft's `loop.makeDouble` atom would have made a record that is neither a loop nor a step |

**The rule for families:** variants of one family share a recipe and differ only in method, lean, how-to, time and physics constants. If a "variant" needs a different recipe, it's a different family, or a different expansion (next section).

### 4. Short rows are an expansion choice

What each method puts in the stream, from the turning point to where the gap is closed in a later row or round (sources: [Wikipedia](https://en.wikipedia.org/wiki/Short_row_(knitting)), [Interweave on German short rows](https://interweave.com/article/knitting/how-to-knit-german-short-rows-make-double-stitch), [shadow wraps](https://knotions.com/tutorial-shadow-wrap-short-rows/)):

| Method | At the turn | Later, closing the gap |
| --- | --- | --- |
| German | `turn.german`: turn, slip the stitch, pull the yarn up over the needle so it shows two legs ("double stitch") | `work.knitDouble`: both legs worked as one; one loop taken |
| Wrap and turn | `wrap` step (`mark(wrapped)`) on the next stitch, then `turn` | `work.knitWithWrap`: the stitch and its wrap worked together. The wrap is a strand, not a loop, so the count is still one |
| Japanese | `turn`, with a removable marker holding the working yarn (`mark` on the strand) | the marked strand lifted onto the needle and worked together with the stitch: one loop plus a strand |
| Shadow wrap | a **new loop** knitted into the stitch below (`below(id) make keep`), then `turn` | the twin and its mother stitch worked together: `take(2) make keep`, like a k2tog |

The draft treated short-row methods as variants of a `turn` atom. The table shows they aren't: shadow wraps add loops, so counts and physics change, and every method changes the atom that closes the gap, often a round later. The written pattern says `shortRows: { method: "german", … }` and the compiler expands it. Today's `shortRows` is German, so the current stream stays what it is.

### 5. Composite instructions are spans

The stream is flat; everything read on screen is a nested span over it.

```ts
interface Span {
  kind: "piece" | "section" | "round" | "row" | "instruction" | "repeat" | "chartRow" | "check";
  type?: string;               // instruction: "joinInTheRound", "divide", "startSleeve", "kfb", "shortRow"...
  start: number; end: number;  // atom range, end exclusive
  said?: "one";                // the panel shows it as one instruction
  done?: "one";                // progress never rests inside it
  closes?: number;             // a turn's span: the atom, later on, that closes its gap
  source?: string;             // the RoundSpec it came from, as Knitout's ;!source:
  params?: Record<string, unknown>;
}
```

Every composite you named fits:

- **Join in the round** (size L, atoms 0-153): `said: one`. "Cast on 152 and join to work in the round" covers 0-153 including the phantom 0. In a new edition, an honest version makes 0 an ordinary `castOn` and 153 a `join` step whose recipe passes the extra stitch over. That is your "a knit, and a join which subtracts a knit", without a fake knit.
- **German turn** (size L, 1548): a one-atom span, `type: "shortRow"`, `closes:` pointing to the stitch in a later row that works the double stitch. The span reaches forward without containing everything in between.
- **Wrap and turn**: span `wrap`, `turn`, with `closes` likewise.
- **Divide** (Paul Klee M2, 21991-22004): one span, `said: one`, from the marker taken off to the closing `sl1po`. Each atom inside keeps its own id, so you can still be mid-cast-on, as today. Each Year Once L (32161-32175) is the simpler hold plus 14 cast-ons.
- **KFB** (Paul Klee M2, 2316-2317): `said: one, done: one`.
- **Start a sleeve** (size L, 91230-91345): `said: one` for "take up the held stitches and pick up 7 at each side"; a round span over the same atoms.
- **Repeats**: `[m1, k8] x 29` is a repeat span; chart rows are spans that carry the chart id and row.

**Where "indivisible" goes.** `done: one` belongs only where stopping inside would leave the needles in a state the pattern never describes. A KFB qualifies (one stitch half-worked); a 14-stitch cast-on doesn't. Saved progress is **never rewritten** to honour it. If a saved position falls inside a `done: one` span (today you can tap the first cell of a KFB), the site reads it as "at the start of the span".

### 6. Sides: store as worked, derive the look

Each atom records **what you do**, plus which side faces you. What it looks like from the right side comes from a per-kind `fromOtherSide` entry: `sides.ts`'s pairs, the other way round.

- **Why:**
  - The stream is instructions. CYC charts pair symbols by side and KnitSpeak writes wrong-side rows as they are worked; both present the look from the right side while instructing what is done.
  - Not every future stitch has a named counterpart from the other side. A bobble or a cable from the wrong side would be a stored "look" with no instruction behind it. `sides.ts` already admits sk2p from behind is only "close" to sssp.
- **For editions already published:** today's kinds form an exact two-way mapping, and the only wrong-side atoms in any stream are `k1`→p1 and `kbf`→pfb. Converting is mechanical, and the edition's knitting is unchanged (see "Editions").

### 7. Yarn, strands and floats

- **Yarn joins and breaks are derived in CI and shipped as annotations, not atoms.**
  - Today they are implied by slot changes, and a piece begun with new yarn is the `resume` atom plus "the first stitch has nothing before it".
  - They never need progress to stop, and they change no loops.
  - The compiler works them out once, so the site and the printed pattern agree.
- **Float catches:** a flag on the atom where the catch is made (`catch: "behind"`), worked out in CI from the design's `rules.float`. Catching is done while working a stitch, not instead of one. It is an instruction, so it counts towards the edition's hash.
- **Strands, later.** Today one yarn *slot* is one strand. Intarsia and some colour joins need two strands of the same colour, as Knitout distinguishes carriers from yarn types (`Yarn-C`). Make room for an optional `strand` beside `slot`, but don't add it until a design needs it.

### 8. What future designs need

| Need | Fits by |
| --- | --- |
| Flat pieces | A piece's mode, flat or round, as in KnitML's `declare-flat-knitting`. Rows alternate sides by themselves: no `turn` atom per row (you don't confirm every row end). Short-row turns stay explicit. Selvedge slips are kinds |
| Seams | A finishing atom per seam stitch: `edge(a) edge(b) make finish`, the edges referenced the way `pickUp.from` is. Physics gets links between the two edges |
| Steeks | Ordinary atoms in a `steek` span, then a `cut` step that severs the links across the steek's middle column. It is the only move that changes fabric made earlier, so the replay must allow it and physics must re-pose. Picking up from the cut edge is `pickUp` from an edge |
| Several needles or holders | The needle model becomes named needles, each an ordered list of loops (KnitML: `label-needle`, `using-needle`). Holders already work this way. Three-needle bind-offs and grafting take from two at once |
| Colour joins | Strands (above), and a `twist` mark at intarsia joins |

### 9. The compiled file

```ts
interface CompiledPattern {
  schema: 1;                       // the file format; readers refuse newer, with a message
  design: string; size: string;
  edition: string;                 // hash of the knitting: kinds, atoms, params, spans that instruct
  topology: string;                // hash of the replayed fabric, which the settled file is keyed by
  provenance: { commit: string; generator: string };
  kinds: KindDefinition[];         // the registry entries this stream uses, with recipes
  slots: string[];
  atoms: number[];                 // run-length coded [kind, slot, side, count]...
  params: Record<number, StepParams>;  // per-atom extras: holder, count, marker, from, catch...
  spans: Span[];
  checks: Record<string, number>;
  linksHash: string;               // the replay's links, hashed: the browser checks it
}
```

Measured on Each Year Once L: 121,932 atoms in 51,579 runs.
- Kinds, slots and runs alone are 492 KB of JSON, **8.7 KB gzipped**. With params and spans, expect 10-15 KB.
- Shipping the full record list with links instead would be 15.7 MB, **1.07 MB gzipped**, per size. So links are replayed, not shipped, and the `linksHash` makes the replay part of the contract.

Versioning follows Knitout's rule: a reader accepts any schema it knows and refuses a newer one, saying so. The edition hash covers the knitting, not the encoding, so a schema change that re-encodes an edition (to "as worked", say) keeps its hash.

### 10. Editions, progress and upgrades

- **A project records `edition` as a new optional field.** `version` stays the storage format, so old builds can still read new saves and nothing is rejected.
- **A project with no `edition` is on edition 0:** today's `buildSweater` output, frozen at the commit that introduces compiled files (step 1 below).
- **A project always loads its own edition.** Nothing published later moves anyone's knitting.
- **Moving to a new edition is the knitter's choice.** The site offers "this pattern has been updated" and shows where the editions first differ.
- **CI publishes an upgrade map per pair of editions:**
  - the shared prefix, where progress carries over unchanged;
  - any later stretches that match atom for atom, where progress shifts by a known offset.

  Outside those, the site asks you to "knit up to here" instead of guessing. The time log moves with progress, as `revisions.ts` already does.
- **`revisions.ts` stays, as a reader of the past.** Paul Klee projects saved before its markers revision are moved on as today, then stamped with edition 0.

The decision this rests on: today's code deliberately lets corrections reach existing projects ("a project saved today still opens after a chart is corrected"). Pinning stops that. A middle course is to mark an edition **errata**, offered more strongly, but never applied without the knitter's say. See the decisions below.

### 11. Settled 3D

- **Keyed by `topology`, not by edition:** `settled/<design>--<size>--<topology>.json`. Editions that differ only in steps, markers, wording or variants share one settle, exactly as today's fingerprint already ignores steps and colours.
- **Old settles are kept,** so a project pinned to an old edition still has its 3D model.
- **Cost:** each knitting change adds one file per size (100-250 KB each). If that grows too large, move old settles off the main branch, and fall back to the newest settle of the same design and size, marked approximate, when one is missing.
- **The manifest stays,** but per topology, not per design: one changed size no longer marks the whole design stale.

### 12. Pipeline

1. **Compile** every design and size in CI (plain Node, as `settle.mjs` does). Run the stitch-count checks and knitting rules there, not in the browser.
2. **Pull requests:** fail when compiled files are stale, the way `settled.test.ts` already fails on a wrong length. A knitting change then arrives as a reviewable data diff: the written pattern, plus a summary of the editions changed.
3. **On `main`:** settle new topologies (today's workflow), commit, deploy.
4. **Publish:** hash-named files plus a manifest of the latest edition per design and size.

### 13. Migration that does not touch your knitting

0. **Freeze knitting changes until step 1 is in.** Hold PR #90 (as already agreed) and PR #89, since both change Each Year Once L's yoke.
1. **Edition 0: compile what exists.**
   - Today's `buildSweater` output and today's 21 kinds, loaded instead of built.
   - A CI test that, for every design and size, the compiled stream replays to exactly today's records.
   - Every existing project reads as edition 0. No stored value changes.
2. **Spans.** Move the panel and the round index onto them. Presentation only; the stream is unchanged.
3. **The kind registry and recipes,** first as a mapping from today's kinds. The stream is unchanged; kinds are renamed in the encoding only.
4. **Store as worked + side:** a mechanical re-encoding. The edition hash is unchanged.
5. **Honest atoms in a new edition:**
   - the join's extra stitch where it belongs;
   - KFB's second loop as `split.kfb`, not `m1`;
   - `turn.german` and `work.knitDouble`;
   - the hold's wrap as a step.

   Offered, never forced.
6. **Then shaping changes ship as new editions:** PR #90, PR #89, and symmetric spacing from `claude/wider-repeats-wip`.

Step 1 alone unblocks PR #90 and PR #89: once your project is pinned to edition 0, they can merge without touching it.

## Decisions open for the owner

1. **Atom granularity.** Keep today's: at most one loop per atom, steps separate. *Recommended*, because every prior system draws the same line and it keeps all progress valid. The alternative is one atom per action (KFB as one).
2. **How kinds are defined.** Recipes over a few needle moves, shipped in the compiled file. *Recommended*: they cover three-needle bind-offs, grafting, slips and provisional cast-ons, which a fixed signature can't. The alternative is the draft's signature tuple.
3. **Short-row methods.** A choice in the written pattern that the compiler expands. *Recommended*. The alternative, a variant label on `turn`, can't express shadow wraps.
4. **"Indivisible".** Split into `said: one` and `done: one`, and never rewrite saved progress to honour them. *Recommended*.
5. **Sides.** Store as worked plus side, and derive the look. *Recommended*. The alternative is as seen, as today.
6. **Links.** Replay them in the browser and check a hash. *Recommended*: shipping them costs about 1 MB gzipped per size.
7. **Yarn joins and float catches.** Worked out in CI and shipped as annotations and flags, not atoms; strands are added only when a design needs them. *Recommended*.
8. **Pinning versus corrections.** Pin projects to editions, offer updates, and allow a stronger "errata" offer. *Recommended*, but it reverses today's "corrections reach you" principle, so it is your call. The alternative is to follow the latest edition with an upgrade map, as `revisions.ts` does now, which only works when the map is complete.
9. **Naming.** `edition` for the pinned compiled pattern; `version` stays the storage format. *Recommended*: there's no real alternative without a storage migration.
10. **Settled 3D.** Key it by topology, keep old settles, and fall back to the newest with an "approximate" label. *Recommended*.
11. **Publish the written pattern.** *Recommended*.
12. **Order of work.** Freeze #89 and #90, then step 1, then the rest. *Recommended*.

## What I couldn't verify

- **knitml.com.** The Wayback Machine was "Temporarily Offline", so I couldn't read the original site or its user guide. Everything above about KnitML comes from its source code and schemas on [GitHub](https://github.com/fiddlerpianist/knitml), not from the site's own prose.
- **KnitScript.** I only saw the [abstract](https://doi.org/10.1145/3586183.3606789) (through Semantic Scholar), so how it gives loops identity or tracks carriers is unchecked.
- **The newer Textiles Lab papers.** For the instruction graphs and equivalence papers I read abstracts only, not the full texts.
- **TECHknitting.** Searches found only a few blog posts (for example its [jogless join](https://techknitting.blogspot.com/2016/10/smoothed-circles-jogless-join-for.html)), no cast-on or short-row reference pages. The technique lists above rest on Wikipedia ([short rows](https://en.wikipedia.org/wiki/Short_row_(knitting)), [casting on](https://en.wikipedia.org/wiki/Casting_on_(knitting)), [binding off](https://en.wikipedia.org/wiki/Binding_off), [grafting](https://en.wikipedia.org/wiki/Grafting_(knitting)), [steeks](https://en.wikipedia.org/wiki/Steek)), CYC and Stitch Maps.
- **Shadow wraps.** The description rests on a [tutorial](https://knotions.com/tutorial-shadow-wrap-short-rows/) and search summaries, and sources disagree about whether "Japanese" and "shadow" name the same method.
- **Timings.** The 4-20× slowdown and the ~10 s per size on `claude/wider-repeats-wip` are carried over from the first draft. I didn't re-measure them.

## Related work in this repository

- **PR #90** (`claude/sweat-shop`) adds Baa-ble Hat's two missing snowflakes, imported from Wool Week. It changes size L's yoke rounds 47-55 (4 fewer stitches). **On hold** until you finish round 55, or until migration step 1.
- **PR #89** (`like-coloured-make-ones`) puts make-ones between two stitches of the same colour where that costs little, in both Wool Week samplers. Stitch counts are unchanged, so no ids move, but the make-ones in Each Year Once L's yoke, including rounds already knitted, move by a stitch or two. **It should wait for the same reason as #90.**
- **`claude/wider-repeats-wip`** holds shaping-solver experiments behind environment switches, all off by default:
  - wider repeats (`WIDER`, `ANYK`, `SUPER`);
  - equal groups of any size (`ANYGROUPS`, `MINGROUPS`);
  - symmetric spacing mirrored about the round's start (`SPREAD`, `NOGROUPS`);
  - a plain-round candidate fix (`FIXC`).

  Harnesses are in `src/data/sweaters/wool-week/strips/experiments/`. Symmetric spacing is the recommended option, not yet chosen. It is too slow to run in the browser, which is what motivated compiling in CI.
