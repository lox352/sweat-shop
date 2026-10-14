# Sweat Shop

A companion for knitting a Fair Isle jumper from the top down. Pick a design,
a size and your wool, and watch the sweater come up stitch by stitch as you
knit it.

## What it does

- **A chart that knows where you are**: the whole sweater on one chart, the
  yoke and above it the body and both sleeves side by side, with every stitch
  of every round, the one you are on marked and the chart following you -
  past the sleeves as you go round the body, and up a sleeve a row at a time.
  As on the hat site, every stitch stands over the stitch it was knitted
  into, so a column of the chart is a column of the knitting, and the chart
  turns over with the work when a short row is purled back from the wrong
  side, every stitch shown as it looks from there: knits as purls, purls as
  knits, a k2tog as a p2tog.
- **Casting on, explained where it happens**: a long-tail cast-on at the neck,
  and at each underarm, part way round with only the yarn at the needle, a
  knitted cast-on worked with the work turned, step by step.
- **The sweater in three dimensions**, with the wool filling in as you work.
- **Colourways as costumes.** A design is drawn once in yarn slots, and a
  colourway says which real shade goes in each - so any yarn can be swapped
  for any of 998 Shetland shades from the five spinners, or any colour at all,
  and the chart and the sweater follow at once.
- **A knitting mode** built for someone holding needles: the piece, the round,
  the stitch within it, and how many of this colour before you change. The
  things that are not stitches - joining the round, changing needles, turning
  at the end of a short row, putting the sleeves on hold, taking them up
  again - are steps of their own, worked and undone like stitches.
- **How much wool**, worked out from the stitches of the size you choose, and
  **how long it has taken and has left**, from your own taps.

## Where it came from

It is [Wool Week Toories](https://github.com/lox352/wool-week)' machinery,
taken on to sweaters. The hat site replays published hat patterns; everything
downstream of the replay only ever wanted a list of stitches and the rounds
they fall in, and that carries straight over - the chart, the knitting panel,
the yarn library, the projects, the knitting time.

What does not carry over is the knitting itself. A hat is one tube, and its
Knitter only ever knew "the round below". A top-down sweater divides at the
underarms: the sleeves' stitches go on hold, new stitches are cast on in their
place, the body is knitted on its own, and each sleeve later takes its held
stitches back up and picks up more out of that cast-on. So the engine here
models what a knitter actually has - the stitches on the needles, and the
stitches on hold - and knits pieces:

```
a design, size by size  ->  Needles  ->  Stitch[] + rounds, by piece
                                            |
            the chart, the sweater, the row counter, the knitting panel
```

See `src/knitting/needles.ts` and `src/knitting/engine.ts`.

## The sweater in three dimensions

The sweater on screen has been settled under gravity, held at the neck,
with its arms out: each piece falls the way it was knitted - the yoke and
the body down, each sleeve down its arm - and each round is pushed out from
its own middle, which is what holds it round. Every link between two
stitches is a rope that can go slack but never stretch. It is the hat
site's model, but not its engine. A hat was ten thousand rigid bodies in
Rapier, settled in a browser; a sweater is ten times that in eight sizes.
So `src/physics/solver.ts` is a small position-based solver in plain
TypeScript that settles a size in Node in a minute or so, gives the same
answer every time, and is never loaded by the site at all. Its answers are
committed, a size to a file, in `src/data/sweaters/settled/`.

```sh
npm run settle                 # every size of every sweater
npm run settle -- --changed    # only those whose knitting or physics changed
npm run bench                  # each piece's tension and frill, size by size
```

A sweater is settled again when its knitting or the physics changes, and
only then. Recolouring it never re-settles it: see
`scripts/settlement-plan.mjs`. On `main`, `settle-missing.yml` does that by
itself and commits the answer.

The settling starts from `src/physics/pose.ts`, which lays the sweater out
blocked with every rope at or under its length. The body hangs straight
down from the underarms. Each sleeve leaves the body from an upright armhole
and bends down to the arm's angle, as a sleeve does over the shoulder. The
neck rib stands as a collar, and the yoke spreads from its foot to where the
body and the sleeves begin. A size not yet settled is drawn as posed, and so
is any size with `?settled=0` in the address.

A medium is seventy-six thousand stitches and the largest a hundred and
twenty-five thousand, which the hat site's sixty-four-triangle stitches could
never draw on a phone. Here each stitch is a single quad, one instance of
one mesh, with the stitch painted on by its shader: a chevron whose point
dips into the stitch it was worked into, so each column of stitches nests
together like knitting. See `src/model/stitch-quad.ts`. three.js and all of
this load only when the sweater is on screen, and the instructions work
without them.

## The designs

One so far: **Hamefarin**, an original circular yoke in the Fair Isle
tradition, graded in eight sizes from 86 to 156cm finished chest. See
[DESIGN.md](DESIGN.md) for how it was made, what it was inspired by, and how
its sizes were graded.

Adding a design is one file and one line:

1. Write `src/data/sweaters/<id>.ts`: its charts (drawn as rows of
   characters), its colourways, and each size's script.
2. Add it to the list in `src/data/sweaters/index.ts`.

The tests then knit every size of it through and check that it states its
counts truthfully, knits up to its measurements, and keeps the rules of Fair
Isle: two colours a round and no float longer than seven stitches.

## Running it

```sh
npm install
npm run dev      # http://localhost:5173/sweat-shop/
npm test
npm run lint
npm run build
npm run budgets  # what a phone fetches, gzipped, against its budgets
npm run test:e2e
node scripts/grade.mjs   # regrade the sizes, to review and commit
```

## Deploying

Pushing to `main` builds, tests and publishes the built site to the
`gh-pages` branch. The workflow can publish the branch but cannot enable
Pages itself, so the first time round that is one manual step: **Settings →
Pages → Source: "Deploy from a branch" → `gh-pages` / `(root)`**.

The site is built with `base: "/sweat-shop/"`, for a project page at
`lox352.github.io/sweat-shop/`. Serving it from a domain of its own means
changing that to `"/"` along with the favicon and font links in `index.html`,
the `src:` urls in `public/fonts/fonts.css`, and the redirect in
`public/404.html`.
