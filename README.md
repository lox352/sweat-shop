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
- **Casting on, explained where it happens**: at the neck, and at each
  underarm, part way round with only the yarn at the needle and the work
  turned, step by step, in whichever cast-on the design asks for.
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
- **How much wool**: the pattern's own metres for the size you choose, where
  it gives them, and otherwise worked out from that size's stitches; and
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
Rapier, settled in a browser; a sweater is ten times that, in every size.
So `src/physics/solver.ts` is a small position-based solver in plain
TypeScript that settles a size in Node in a minute or so, gives the same
answer every time, and is never loaded by the site at all. Its answers are
committed, a size to a file, in `src/data/sweaters/settled/`: a position for
each stitch of the fabric, and none for the steps between - a change of
needles, a turn - which are put beside the stitch before them.

The physics stands on the rounds as they are worked from each piece's seam,
the middle of the back or of an underarm, whatever marker a pattern counts
its rounds from: see `src/physics/knitting.ts`.

```sh
npm run settle                 # every size of every sweater
npm run settle -- --changed    # only those whose knitting or physics changed
npm run bench                  # each piece's tension and frill, size by size
```

A sweater is settled again when its knitting or the physics changes, and
only then. Recolouring it never re-settles it, and nor does a step gained or
lost: see `scripts/settlement-plan.mjs`. On `main`, `settle-missing.yml` does that by
itself and commits the answer.

The settling starts from `src/physics/pose.ts`, which lays the sweater out
blocked with every rope at or under its length. The body hangs straight
down from the underarms. Each sleeve leaves the body from an upright armhole
and bends down to the arm's angle, as a sleeve does over the shoulder. The
neck rib stands as a collar, and the yoke spreads from its foot to where the
body and the sleeves begin. What that leaves too long - a raglan puts all its
increases at four lines, which no smooth yoke has room for - is pulled in by
passing over the ropes a few times, as the solver does. A size not yet
settled is drawn as posed, and so is any size with `?settled=0` in the
address.

Hamefarin's medium is seventy-six thousand stitches and its largest a
hundred and twenty-five thousand, which the hat site's sixty-four-triangle stitches could
never draw on a phone. Here each stitch is a single quad, one instance of
one mesh, with the stitch painted on by its shader: a chevron whose point
dips into the stitch it was worked into, so each column of stitches nests
together like knitting. See `src/model/stitch-quad.ts`. three.js and all of
this load only when the sweater is on screen, and the instructions work
without them.

## The designs

- **Hamefarin**, an original circular yoke in the Fair Isle tradition,
  graded in eight sizes from 86 to 156cm finished chest.
- **The Paul Klee Sweater**, by Midori Hirose: a pattern bought and
  transcribed for its owner's own knitting, which is all its licence allows -
  it is not to be shared. A yoke of colour blocks in as many as twenty-four
  colours, turning into a raglan below them, in sixteen sizes from a child's
  of two to a 6XL, every count the pattern states checked against the
  knitting.
- **The Nasca Felines**, two jumpers after a Nasca tunic in the Metropolitan
  Museum of Art: its two great red felines, one on the front and one on the
  back, traced vertex by vertex from a photograph and drawn as stitches as
  large as each size has room for, midway between a deep neck band of the hem
  creatures' squared spiral tails and the tunic's hem band of small gold
  creatures at the waist, with its sleeve ends' small gold felines at the
  cuffs.
  One is a raglan, the other a round yoke; both in eight sizes from 86 to
  156cm finished chest.

See [DESIGN.md](DESIGN.md) for how each was made, and how Hamefarin's sizes
were graded.

Adding a design is one file, one line and one command:

1. Write `src/data/sweaters/<id>.ts`: its charts (drawn as rows of
   characters), its colourways, and each size's script.
2. Add it to the list in `src/data/sweaters/index.ts`.
3. `npm run editions`, and commit what it writes: see Editions.

The tests then knit every size of it through and check that it states its
counts truthfully and keeps the rules of Fair Isle: two colours a round and
no float longer than seven stitches. A design's own test file holds it to
whatever else it promises - its measurements, or what its pattern says.

## Editions: a project knits what it was started on

A project's progress is the id of the last stitch it worked, so it only means
anything against the knitting it was counted in. A design's knitting changes
now and then - a chart corrected, a better way to shape a yoke - and a project
part way through should not have its knitting change under it.

So each knitting a size has had is kept, as an **edition**, named by a hash of
it. `src/data/sweaters/editions/manifest.json` says which edition of each size
is current, and which was the first the site named; `public/editions/` holds a
frozen copy of each, the built sweater itself, so it decodes to the same
stitches whatever the code that built it has since become.

- A project records the edition it was started on. One saved before editions
  knits the first.
- The published site knits every size from its frozen copy - a file of some
  15KB over the wire, kept by the service worker from then on - so no phone
  works a pattern out for itself: that is the slowest thing the site does,
  and the answer is the same for everyone. Where the copy of a size's
  knitting as it is now cannot be had, offline on a size never opened, the
  pattern is worked out in the browser as it always was. Developing, and in
  the unit tests, it always is: the copies are those of the last `npm run
  editions`.
- A project on an edition its size has moved on from knits that edition's
  copy. If it cannot be fetched, the project says so and shows nothing, never
  some other knitting.
- The project's pages then say the pattern has been updated, where the update
  first differs, and whether that is before or after where the knitting has
  got to. Moving on is the knitter's choice; their place may need putting
  right with *Knit up to here* where the two differ behind them.
- The sweater in three dimensions is settled for a size's knitting as it is
  now. When a size is settled again for a new edition, the settled sweater of
  the edition before is kept beside its frozen copy
  (`public/editions/<design>--<size>--<edition>.settled.json`), and a project
  still on that edition is shown it. `scripts/settled-editions.json` records
  which edition each size's settled file is for.

A page reads no design's own file. What it shows of a design - its name, its
sizes and their measurements, its colourways - it reads from the
**catalogue** (`src/data/sweaters/catalogue/`): every design without its
knitting, written from the designs' files. The designs' files and the engine
that knits them are the **builder** (`src/knitting/builder.ts`), a part of
the site fetched only where a pattern has to be worked out in the browser
after all. Developing, and in the tests, it is loaded first, and the designs
shown are the designs as they are in hand.

**When a change alters any size's knitting, or anything a design says of
itself**, the tests fail until its editions are named and frozen and the
catalogue written again:

```sh
npm run editions              # name every size; freeze any new edition; update the manifest and the catalogue
npm run editions -- --check   # fail if anything is out of date, and write nothing
```

Commit what it writes. The manifest's diff is the list of sizes whose knitting
changed, which is worth reading: a size that changed and was not meant to is a
bug. Frozen copies are never rewritten once superseded, and never deleted -
projects out in the world knit from them.

What a frozen copy holds, and what the chart, the knitting panel and the
sweater in three dimensions all read, is one thing: a size knitted, its
stitches and steps in the order they are worked and the rounds they fall in
(`src/knitting/knitted.ts`). The engine makes one from a design; an edition is
one frozen. Nothing that shows a sweater knows how its pattern was written or
worked out.

A change to what rounds are called in the chart's margin, or to how wide a
stitch is drawn, is not a change to the knitting and makes no new edition.

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
npm run editions # after a change to any size's knitting: see Editions
```

## Deploying

Pushing to `main` builds, tests and publishes the built site to the
`gh-pages` branch. The workflow can publish the branch but cannot enable
Pages itself, so the first time round that is one manual step: **Settings →
Pages → Source: "Deploy from a branch" → `gh-pages` / `(root)`**.

The site is kept out of search engines, as the hat site is: every page
carries a `noindex, nofollow` robots tag, which `src/search.test.ts` holds it
to. The `robots.txt` beside it says the same, but crawlers read robots.txt
only at the root of a host, so the tags are what count. The repository
itself is public, though, and GitHub's own search and the search engines can
find what is in it.

The site is built with `base: "/sweat-shop/"`, for a project page at
`lox352.github.io/sweat-shop/`. Serving it from a domain of its own means
changing that to `"/"` along with the favicon and font links in `index.html`,
the `src:` urls in `public/fonts/fonts.css`, and the redirect in
`public/404.html`.
