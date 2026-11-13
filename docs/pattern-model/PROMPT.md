# Prompt for a local Claude Code session

Paste everything below the line into Claude Code, run from a clone of
`lox352/sweat-shop`.

---

You're picking up a design task in this repository (sweat-shop: a Vite + React + TypeScript site that turns sweater designs into interactive knitting charts, written instructions and a settled 3D model). A cloud session drafted a domain model but couldn't reach the web, so its research is unverified. Your job is to verify it against real sources, deepen it, and produce a revised proposal. **Design only: don't implement anything** unless I ask after reading your result.

## Get set up

```
git fetch origin
git checkout claude/pattern-model
```

Read, in this order:

1. `docs/pattern-model/README.md`: the proposal, the current-state map with file references, open decisions and research gaps. `proposal.html` beside it is the illustrated version I've already read.
2. The code it describes, enough to check every claim about today's model: `src/types/StitchType.ts`, `src/types/Stitch.ts`, `src/data/sweaters/types.ts` (the `RoundSpec` "written pattern"), `src/knitting/needles.ts` and `src/knitting/engine.ts` (expansion), `src/knitting/progress.ts`, `src/knitting/sides.ts`, `src/knitting/stitch-key.ts`, `src/helpers/revisions.ts`, `src/helpers/projects.ts`, `scripts/settle.mjs`, `scripts/settlement-plan.mjs`, `.github/workflows/settle-missing.yml`, and `DESIGN.md` for how designs are constructed.

## The goal, in my words

Move the whole pattern calculation to CI and have the site simply interpret the result. A sequence of instructions produces a unique pattern, and progress becomes an index into that instruction array. Some instructions do work (knit, purl, increases, decreases), some are inert (placing markers, changing needles, turning the work), and some sit in between, shaping the construction without adding stitches (joining in the round, putting stitches on hold). It must stay extensible:
- Many types of a given instruction: kinds of cast-on, increase, decrease and so on.
- Composite instructions that show a few atomic ones as one on-screen instruction. Joining in the round is in some sense "a knit, and a join which subtracts a knit". German short-row turns, and casting on and joining the underarm stitches, may or may not fall into that camp.

## What to do

1. **Verify the prior art** listed under "Research gaps" in the README, from primary sources, and correct anything the draft got wrong. Fetch:
   - Knitout: https://textiles-lab.github.io/knitout/knitout.html. Its operation set, carrier operations, header and versioning, and how it treats ordering and anything composite.
   - The Craft Yarn Council's standard abbreviations and chart symbols: https://www.craftyarncouncil.com/standards/knitting-abbreviations and https://www.craftyarncouncil.com/standards/knit-chart-symbols. Use them to check and complete the family-and-variant table, especially increase and decrease leans and the cast-on, bind-off, marker, short-row, pick-up and holder abbreviations.
   - KnitSpeak: https://stitch-maps.com/about/knitspeak/ and its reference pages.
   - KnitML. The original site and repository may be gone; try the Wayback Machine and a search. I want its element names, how it represents variants (cast-on styles, increase types), and whether it separates an authored form from an expanded one.
   - Anything else you find that genuinely bears on modelling knitting as instructions. Candidates I'm aware of but haven't checked: McCann et al. 2016, "A Compiler for 3D Machine Knitting"; KnitScript (UIST 2023); stitch meshes. For the variant lists, use reputable technique references (for example TECHknitting) for cast-ons, short-row methods (German, wrap-and-turn, Japanese, shadow wraps), ways of joining in the round, increases and bind-offs.

   Cite every claim you keep with a link. Flag anything you couldn't verify.
2. **Pressure-test the model** against what you learn and against the code, and revise it where it's wrong or thin. At least:
   - **The atom's definition and granularity.** The draft keeps today's: one record per loop or step, so chart cells, physics nodes and saved progress stay 1:1. Is that right? How do the prior systems draw the line?
   - **Families versus variants.** Is the signature (takes, makes, live, effect) enough for the needle machine to replay any variant without knowing it? Test it on a three-needle bind-off, grafting, a yarn over, a provisional cast-on and the German double stitch.
   - **Composite instructions as spans.** Do the join, German turn, wrap-and-turn, divide (hold plus underarm cast-on, sometimes closed with `sl1po`), KFB and sleeve start all fit? Where should "indivisible" sit?
   - **Storing as worked plus side, versus as seen.** The code stores as seen today; see `sides.ts`.
   - **Yarn changes and float catches:** derived or explicit?
   - **What future designs need:** flat pieces, seams, steeks, multiple needles or holders, colour joins.
   - **The compiled file format and versioning**, including how settled 3D positions key off versions, and the migration plan. The migration must not move any existing project's progress.
3. **Write the result** into `docs/pattern-model/README.md` on this branch. Keep the "what's there today" section accurate against the code, put changes from the draft in a short "Changes from the draft" section at the top, and keep the "Decisions open for the owner" list current, each with a recommendation. Update `proposal.html` only if you're confident the HTML stays well formed. Otherwise leave it and say so.
4. **Commit and push** to `claude/pattern-model` with a clear message. Nothing else is needed to verify a docs-only change, but if you touch code, run `npm run lint`, `npm test` and `npm run build` first.

## Constraints

- **I'm knitting Each Year Once, size L, right now** (yoke round about 55). Nothing you propose may silently change the knitting of an existing project, or move saved progress. Saved progress is a stitch index; see `helpers/projects.ts` and `helpers/revisions.ts`.
- **Leave other branches alone.** Don't touch `main`, PR #90's branch (`claude/sweat-shop`) or the solver experiments (`claude/wider-repeats-wip`). PR #90 stays unmerged.
- **Design only.** No implementation unless I ask.
- **Write for me, not for the code.** I read the docs as the person who makes the decisions: plain language, defined terms, real examples from the repository's designs (the README has stitch ids from size L to start from).

## When you're done

Reply with:
- what you verified, with links;
- what you changed from the draft, and why;
- what you couldn't verify;
- the open decisions, each with your recommendation.
