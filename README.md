# Sweat Shop

A companion for knitting a Fair Isle jumper from the top down. Pick a design,
a size and your wool, and watch the sweater come up stitch by stitch as you
knit it.

## What it does

- **A chart that knows where you are**, one piece at a time - the yoke, the
  body, then each sleeve - with every stitch of every round, the one you are
  on marked and the chart following you.
- **The sweater in three dimensions**, with the wool filling in as you work.
- **Colourways as costumes.** A design is drawn once in yarn slots, and a
  colourway says which real shade goes in each - so any yarn can be swapped
  for any of 998 Shetland shades from the five spinners, or any colour at all,
  and the chart and the sweater follow at once.
- **A knitting mode** built for someone holding needles: the piece, the round,
  the stitch within it, and how many of this colour before you change. The
  things that are not stitches - joining the round, changing needles, putting
  the sleeves on hold, taking them up again - are steps of their own, worked
  and undone like stitches.
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

The sweater on screen is blocked, with its arms held out: each stitch where
`src/physics/pose.ts` lays it, from the knitting's own links. The body hangs
straight down from the underarms. Each sleeve leaves the body from an
upright armhole, bends down to the arm's angle as a sleeve does over the
shoulder, and runs on to the cuff. The neck rib stands as a collar, and the
yoke spreads from its foot to where the body and the sleeves begin.

The pose is also where the physics will start, so it puts every rope between
two stitches at or under its length. Ribs and the sleeve's taper come in no
faster than a round's height allows, and the stitches over decreases are
evened out only part of the way. The neck stands high enough that the yoke
reaches the tops of the sleeves. The tests hold every size of every design
to it.

A medium is seventy-six thousand stitches and the largest a hundred and
twenty-five thousand, which the hat site's sixty-four-triangle stitches could
never draw on a phone. Here each stitch is a single quad, one instance of one mesh, with
the stitch painted on by its shader: a chevron whose point dips into the
stitch it was worked into, so each column of stitches nests together like
knitting. See `src/model/stitch-quad.ts`. three.js and all of this load only
when the sweater is on screen, and the instructions work without them.

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
