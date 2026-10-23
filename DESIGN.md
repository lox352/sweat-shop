# How the designs are made

## Hamefarin

A top-down, circular-yoke Fair Isle jumper, knitted in one piece from the neck
down in Shetland 2ply jumper weight. Its file is
`src/data/sweaters/hamefarin.ts`.

### Construction

1. **Neck.** Cast on, join, and work twelve rounds of corrugated rib - knit
   two in a contrast, purl two in the body colour - on 2.75mm needles.
2. **Back neck.** Change to 3.25mm needles, and raise the back of the neck
   with German short rows in the body colour, centred on the beginning of the
   round: knit a sixth of the neck past it, turn, make a double stitch, and
   purl back as far past it the other way; then two more pairs, each turning
   a twentieth of the neck beyond the last, and knit on to the end of the
   round. Six rows at the middle of the back raise it about two centimetres,
   as a back neck needs - without them the front of the neck rides up to
   meet the throat.
3. **Yoke.** A first increase round, which works the last two double
   stitches as one each as it reaches them, then five bands, each preceded by
   a plain increase round:

   | band | rounds | repeat |
   | --- | --- | --- |
   | Peerie | 5 | 6 |
   | Border | 9 | 12 |
   | Peerie seeds | 3 | 4 |
   | OXO | 17 | 24 |
   | Lozenges | 7 | 12 |

   then plain rounds to the depth of the yoke.
4. **Divide.** From the middle of the back: knit half the back, put the right
   sleeve's stitches on hold and cast on the underarm, knit the front, put the
   left sleeve's on hold and cast on the other underarm, knit the rest of the
   back. Knitted top down and turned the right way up, the rounds run left to
   right as you look at them, which is why the first sleeve reached is the
   wearer's right.
5. **Body.** Plain, then the peerie seeds again above twenty rounds of
   corrugated rib, and bind off.
6. **Sleeves.** Each in turn: put the held stitches back on the needles, and
   with new yarn, from the middle of the underarm, pick up half the underarm,
   knit the held stitches, pick up the other half. Decrease either side of the
   underarm - k2tog leaning right, ssk leaning left - down to the cuff, work
   the seeds and the rib, and bind off.

### The bands

Every band is the same upside down as the right way up. A top-down chart is
knitted from the neck, so whatever it draws comes out turned through half a
circle on the finished yoke; a motif that is its own reflection looks the same
either way, and nobody has to knit a chart upside down.

They are drawn in the design file as rows of characters, `x` for the pattern
colour and `.` for the ground, one string per round, top row first, each row
naming its own ground and pattern slots:

```ts
const peerie = band("peerie", "Peerie", [
  ["...x..", "A", "E"],
  ["..x.x.", "A", "E"],
  [".x.x.x", "A", "F"],
  ["..x.x.", "A", "E"],
  ["...x..", "A", "E"],
]);
```

The OXO is built the way the old ones are: two diagonals cross at every X and
run on to the next, framing each O between them - the strong diagonals that
are the point of an OXO. Each O holds a smaller lozenge and a seed; each X has
a lozenge round its crossing and one in the space above and below it.

### Colour

Eight slots. A is the body and the darkest ground; B, C and D shade the
grounds from dark to light towards the middle of a band; E, F, G and H are the
pattern colours, shading the other way, so that every row keeps its contrast.
No round uses more than two.

Three colourways, each from one spinner's 2ply jumper weight in the yarn
library: **Simmer Dim** (Jamieson's Spindrift: navy, teals and gold, the
midsummer twilight), **Hairst** (Jamieson & Smith: harvest browns, rust,
mustard and greens) and **Moorit** (Uradale's undyed naturals).

### Changing it

Edit the strings and the slots, and the dev server shows the result at once.
A change of colour is only a change of colour: it never changes how many
stitches anything has, so it never needs the sweater's shape settling again.
A change to a band's size or the number of rounds does.

## Grading

`scripts/grade.mjs` turns each size's target measurements - standard body
measurements with about ten centimetres of ease at the chest - into the
numbers its pattern prints:

- the neck's cast-on, a multiple of four for the rib;
- the back neck's short rows: three pairs, the first turning a sixth of the
  neck past the middle of the back and each pair after it a twentieth
  further;
- the count after each increase round, a multiple of the next band's repeat.
  A yoke is a cone over the shoulders and a band round the chest and arms
  below them, so its circumference grows with depth for the first part of the
  way and then stops: here, linearly from the neck to its full count at six
  tenths of the depth, read where each band begins;
- how the yoke divides: an underarm of about four per cent of the body, the
  sleeve's top near its target, and the yoke a whole number of the last
  band's repeats;
- plain rounds to make up the yoke's depth, the body's length and the
  sleeve's;
- the sleeve's decreases, as evenly as whole rounds allow: so many every n
  rounds, then the rest every n - 1.

Its output is reviewed and pasted into the design file as a table, and the
table - not the script - is the pattern. The tests knit every size through and
hold it to every number in its table, to the measurements it was graded to
(within a centimetre), and to the rules of Fair Isle.

## What it learned from

The vocabulary is the tradition's own: peerie patterns, borders, OXOs, shaded
grounds, two colours a round. The construction is the one that modern top-down
yokes share, and these are the designs that were looked at for it. None of
their charts is copied here.

- **Kirsten-Michele** - Breiwick, Caitria, Iora, Concinnity: Fair Isle yokes
  worked top down, and the 1960s habit of keeping the colourwork to the yoke.
- **Jennifer Steingass** - Silverlining, Engi, Treysta, The Storyteller: top
  down, seamless, with neckline shaping before the colourwork.
- **Ysolda Teague** - Threipmuir: a top-down round yoke.
- **Boreal** - a top-down circular yoke in J&S 2ply jumper weight at 28
  stitches and 32 rounds to 10cm on 3.25mm, with 2.75mm ribbing: the gauge and
  needles used here.
- **Gudrun Johnston** - Burrafirth, Heritage Yoke: Shetland yokes knitted from
  the top.
- **Ella Gordon** - the Crofthoose and Hap yokes: short rows at the neck for
  the fit, which is the next thing this design will grow.
- **Edinburgh** - four or five increase rounds, depending on size.
- **Anoushka** - short rows worked after the neck rib.
- **Elizabeth Zimmermann's percentage system** - neck about 40 per cent of the
  body's stitches, sleeves 33, underarm 8, and a yoke of about 134 per cent
  after three increases of a half each: the proportions the grading starts
  from, with a smaller underarm, as modern top-down yokes have.

## The Paul Klee Sweater

Midori Hirose's pattern, bought and transcribed into
`src/data/sweaters/paul-klee.ts` for its owner's own knitting. Its licence
is for personal use, and nothing of it here is to be shared.

It was as much a test of the engine as a second design: it asks for
everything Hamefarin does and a good deal more.

- **Every size the pattern gives**: four for children, by age, and twelve
  for adults, from 2XS to 6XL, each its own knitting. The pattern groups the
  sizes by how many bands of colour their yokes have room for, from seven to
  twelve, and so does the file.
- **Its counts, to the letter.** Every stitch count the pattern states is a
  check the knitting must leave: the neck, the set-up, the short rows, each
  band, the raglan, the body, and each sleeve's top and cuff.
  `paul-klee.test.ts` holds the knitting to the rest of what the pattern
  says: how many rounds the yoke takes, how many colours each size knits,
  how far the short rows reach, how many rounds each sleeve has, the bust and
  upper arm it comes out at, and how the divide is worked.
- **Its bands, drawn.** The pattern writes the colourwork in words, block by
  block. Here each band is a chart of blocks four stitches wide and five
  rounds deep, in the band's own two colours, with its last round's
  increases - a block worked k1, kfb, k2 - where the pattern puts them. The
  next band starts its blocks afresh from the beginning of the round, as the
  pattern does.
- **Its methods**, which the engine learned for it:
  - a cable cast-on, with one stitch more than the round keeps passed over
    at the join;
  - short rows with increases in them;
  - a third size of needles, for the colourwork;
  - a raglan: a KBF before each marker and a KFB after it;
  - a divide worked the pattern's way:
    - a wrap at each corner before a sleeve goes on hold;
    - the underarm cable cast on, one more than stays, with the last of it
      passed over the stitch after;
    - a new beginning of the round half way along the right underarm, and
      the quarter round knitted on to it from the old one;
  - sleeves that pick up more than their underarm has;
  - ribs worked k1, p1 a run at a time - "(K1, p1) x 48" - and bound off
    in pattern.
- **Its markers**, placed and taken off where the pattern says: one band's,
  which the bands after it increase between; the raglan's four; and the new
  beginning of the round. Each is a step in the order of work, and a line up
  the chart between two columns. A marker changes how the rounds are
  counted, never the knitting, so the knitting keeps two sets of rounds:
  - the rounds from each piece's seam, which the physics stands on and which
    no marker changes;
  - the rounds as the knitter counts them, from the beginning of the round
    in force, which the chart and the knitting panel show. Once the divide
    places the new beginning, the whole chart is cut at it from the neck
    down, and turned so that it is the chart's right-hand edge.

  A project saved before the markers were added moves on past each one
  before its stitch, the first time it is opened.
- **Its wool.** The metres are the pattern's own, size by size, for the main
  colour and each band's colours, and the wool list shows them in place of
  an estimate. Its three colourways are the three its charts are drawn in,
  each colour read off the pattern and matched to the nearest Jamieson's
  Spindrift shade.

## The Wool Week samplers

Every Shetland Wool Week hat from 2014 to 2026 in one top-down jumper, two
ways. Each is one file, `src/data/sweaters/wool-week-strips-*.ts`, a call to
`stripSampler` with a name, a story and a layout; all they share is in
`src/data/sweaters/wool-week/strips/`, and the hats' charts are in
`src/data/sweaters/wool-week/` (see `WOOL-WEEK.md` for where they came from).

| File | Layout |
| --- | --- |
| `wool-week-strips-once-oldest.ts` | **Each Year Once.** 2014 to 2016 round the yoke, 2017 to 2021 down the body, 2022 to 2026 down both sleeves, each year as full as its piece has room for (`refit.ts`) |
| `wool-week-strips-lined-oldest.ts` | **Thirteen Strips.** All thirteen years from the neck to the hem, each in a strip of about the same height; the sleeves knit the body's strips round for round and carry 2026 on to the cuff (`lined` in `plan.ts`) |

- **Turned, so every picture stands up.** Knitted from the neck down, a
  hat's chart is read from its top row: the sheep, houses, boat and ram stand
  the right way up on the jumper as worn, and the lettering reads.
- **The cuts** (`cuts.ts`). Each hat cut into building blocks: a motif, and
  the symmetrical additions it can take, and, where a chart mirrors about a
  row, cropped evenly about it.
- **Thirteen Strips' plan.** Every strip within five per cent of its piece's
  average, give or take the round it is rounded to: a plain round, which
  carries any shaping, then the cut nearest its height, padded with plain
  rounds. Both plans put a plain round wherever two quanta meet that don't
  go together (see Quanta below).
- **Each Year Once's plan** (`refit.ts`), by these rules:
  - A plain round outside a pattern carries on a neighbouring pattern's
    background, the commonest yarn in the three rows nearest that edge,
    never a colour from elsewhere. Padding carries on its own strip's; a
    round between two strips takes the stronger neighbour's, or, where one
    neighbour's edge row is already plain, the other's.
  - A pattern's own plain first or last row is its increase round, so no
    round goes beside it. Where neither neighbour has one, one plain round
    goes between them.
  - A cut's plain edge rows are kept or dropped in pairs, so a band is
    framed alike top and bottom: the houses, 2018's dancers, 2020's stars.
  - Where two quanta meet that don't go together, a plain round goes
    between them, in the stronger one's background, so they don't run into
    each other: 2014's peeries and stars, its two stars where a cut parts
    them, 2019's boat and sheep, 2023's peeries and flowers. In L the sheep
    give up two rows of sky and one of field to make room.
  - Spare rounds go to patterned edges first, up to two each, strongest
    background first: sky above the boats, ground under the sheep.
  - Each year's cuts are a ladder from fullest down, and a piece takes the
    trims in a set order until it fits: on the yoke 2014's outer rows, then
    the sheep's sky and field, two rows to one; on the body 2020's outer
    peeries, 2018's plain rows, then a row off each side of 2017 and of 2018.
    A trim a later one has made room for again is given back. The sleeves
    start mid-ladder and spend their spare rounds upwards.
- **Quanta** (`quanta.ts`). Each hat's pattern is cut into quanta, the
  pieces that go together and whose foreground is never altered, only
  spaced: a band of stars, a row of sheep, a peerie. A *free* quantum can
  be put in or left out alone; a *core* may have *frames*, borders in pairs
  either side, both or neither, nesting outwards. Most frames drift, each a
  quantum of its own; 2014's star borders, 2021's lattice borders and
  2026's bands stay aligned with their core, one quantum with it. Every
  stitch is foreground or background: by yarn, as `roles.json` reads each
  hat; 2014's bands row by row, the stars' light yarns their motif; 2025's by its diamonds, the light yarns the
  ground inside them and the dark outside. Two quanta knitted one against
  the other, neither edge a round of one yarn, need a plain round between
  them (`plainBetween`) - save a core and its aligned frames, and the
  quanta the knitter settled go together: 2017's zigzags, 2019's peerie
  bands and the waves the boat sails on.
- **Shaping by quanta** (`shaping.ts`). A piece's rounds are units: a
  quantum as far as the piece has it, or a round of one yarn. Each unit is
  laid out on its own count, a whole number of its repeat with some columns
  doubled, the same in every repeat. Between units the count changes freely,
  in a round of one yarn or spread through a unit's first round. Inside one,
  a column may be doubled, with a make-one beside it in its yarn, only where
  no foreground is in its chain of descendants: the column below it, to the end
  of its quantum. In a mirror image it goes with its mirror partner. Columns
  doubled are never within two of each other, and increase rounds are kept
  apart where the target allows. The counts come from a search over each
  size's rounds that keeps them near the target; decreases are the same
  search on a piece's rounds reversed, the rule then reading a column's
  ancestors.
- **The knitting** (`knit.ts`). The yoke grows by its quanta, from the neck
  to the divide, within about 4 to 8% of its target where it once fell a
  fifth behind; the 2014 stars, which the site once fanned out by doubling
  columns that ran into the stars below, now grow only near their foot. The
  body keeps every repeat whole, and changes count in plain or one-colour
  rounds, or spread through a round of the pattern where the repeat
  changes.
- **The sleeves** (`knit.ts`, `shaping.ts`). Seamless where a band can be,
  seamed on the inner arm where it can't: every round within 10% of a straight
  taper from the upper arm to the cuff. A seamless band is on whole repeats,
  narrowing between bands or where a doubled background column ends - one
  whose ancestors, from the top of the band down, are all background. A band
  that can't stay within the tolerance so is seamed: centred on the arm, its
  repeats meeting part-way at a seam stitch on the inner arm (chosen to break
  the floats either side of it), two decreases at a time either side, and
  slid round, the same all through the band, to the offset that leaves the
  least foreground touching the seam. Seamed rounds cost the search far more
  than any departure within the tolerance, so it seams as few as it can, and
  a sleeve never widens. Strictly seamless sleeves are impossible in most
  sizes: with whole repeats and a falling count, the bands' repeats compound
  from the cuff up - 2026's 32-stitch lattice, 2025's 18, the ram's 20, the
  flower's 34 - past the stitches the sleeve starts with.
- **The colourways** (`colours.ts`, from `colourways.json`, which
  `scripts/strip-colourways.mjs` works out). Each yarn of each hat is its own
  slot, "14A" or "26DA" (see `slots.ts`), so a colourway is a yarn for every
  slot, and a ball of wool can do many. A colourway is a palette, all dark or
  all light:
  - **Fifteen palettes**, each a few Spindrift yarns after a knitting
    tradition, grouped in the picker by where it is from: Shetland and Fair
    Isle (Shetland naturals; Indigo, madder and white; Fawn and grey, 1920s;
    Vintage allover, 1930s, the Aal Ower Toorie's own yarns); North Atlantic
    and Scandinavia (Icelandic greys; Black and white, after Selbu, Setesdal
    and the Faroes; Marius; Bohus blues); the Baltic (Muhu brights; Latvian
    white ground); further afield (Cochineal and indigo; Sanquhar peat and
    gold); from the hats (Buggiflooer brights; Sea anemone); and the samplers'
    first colours (Aa ae colour, classic). Each is two families, lights and
    darks, the first of each the ground, with perhaps some middle shades and
    an accent. All dark in Shetland naturals is the default. Bohus's close
    heathered shades keep 17 L* apart where the rest keep 20.
  - **Nine of many colours**, tens of Spindrift yarns each, from the colour
    research: lightness carries the pattern, colours change their
    neighbours, brights go in small doses, and one organising idea holds tens
    of colours together. Colour journey (a step round the colour circle each
    year), Night journey (the same on dark grounds), Shetland landscape (each
    year a place, in soft heathers), Undyed grounds with dyed figures,
    Shaded Fair Isle, the hats' own hues, Bohus heathers, Muhu stockings (the
    bold one, brights over the hats' tenth on purpose) and Shetland seasons.
    Each hat's yarns go on by what they draw, 2014's by its own light and
    dark, nearest a target within lightness bands for ground and figure,
    every two that meet in a round 20 L* apart (Bohus 17), the sheep Natural
    White with Black faces. Each is one colourway, its grounds light or dark
    as its idea has them; the sheep years and the Buggiflooer turn over in
    the light ones.
  - **Shaded bands.** Shaded Fair Isle gives every band's rounds their own
    shades, as Fair Isle does: the ground steps through four shades of one
    family and the pattern four of another, edge to centre and back, and the
    centre round of a band seven or more deep takes a bright. The knitting
    marks each chart row with its place in its band (knit's `banded`), and a
    row's slots carry it: "14D/f2" is 2014's yarn D as a round's main figure
    at step 2 of 3 (`bandSlotsOfRow`). Every other colourway knits those
    slots in the slot's own yarn, so the knitting is the same in all of them;
    the colour keys and wool list show each yarn once. 2025's allover, which
    shades itself, keeps its own eight yarns.
  - **Ground and figure.** Each hat's yarns are read by what its charts
    depict (`roles.json`): the ground behind, the figure drawn on it, and,
    in the Shwook Hat, a middle that stands between the two. All light puts
    the ground on the palette's lights and the figure on its darks; all dark
    the other way round. Then each hat's yarns go onto the palette's the
    cheapest way that keeps every two yarns that meet in a round apart - 20
    L* between ground and figure, 8 between two grounds or two figures, as
    Fair Isle shades a ground - and keeps the hat's order of contrast, gives
    its rarest touches the accent, and shares the palette out over the
    years. Going by roles rather than the commonest yarn matters where a hat
    has several grounds (2016, 2019, 2021, 2022, 2025, 2026) and where the
    figure is the commonest yarn - the Roadside Beanie's sheep.
  - **Pictures pin colours.** Sheep are white: the Baa-ble Hat's bodies and
    the Roadside Beanie's sheep the palette's lightest yarn, the Baa-ble
    Hat's faces its darkest, whatever the grounds.
  - **The trim.** The neck, waist and wrist ribbing is its own slot,
    `trim`, which a colourway gives the palette's ground. A knitter may
    choose it separately among all the palette's yarns (`Colourway.trims`,
    `SweaterPattern.trim`); the project keeps the choice, and starting from
    another colourway resets it.
- **Measurements.** Hamefarin's, but the yoke a centimetre and a half deeper
  and the body three and a half longer: thirteen hats make a long jumper.
  Knitted at 32 stitches and 38 rounds to 10cm.
- **What it asks of a knitter.** The charts are knitted as their designers
  drew them, so some floats are long, and are caught behind the work; one
  round of the Shwook Hat is in three colours.

## The chart's views

Every stitch on a chart stands over the stitches it was worked into, so a
column is a column of the knitting. The underarm's cast-on stitches can't be
drawn that way on one chart: the body knits on from them, and the sleeve
picks up out of them on the other side of the same edge. So each design has
four charts, chosen by tabs over the chart, and every one of them is worked
out from the stitches in order, never from what comes after:

- **From the neck**, generated by the cast-on: the yoke, and above it the
  body and the sleeves, everything but the underarms.
- **Each hold** of stitches, with any number cast on in their place, makes
  two more:
  - **the body**, the round's remaining stitches with the cast-on ones among
    them: both underarms, the whole body and most of the yoke;
  - **a sleeve**, its held stitches and the cast-on ones after them, the
    other way round: its underarm and the whole sleeve. Each stitch picked up
    out of the underarm stands over the stitch it came out of, and any picked
    up out of a corner stand beside them.

A view is its generating row, everything worked out of that row, and
everything that row was worked out of. While you knit, the chart stays on
its view for as long as each stitch is in it. The first stitch cast on at an
underarm takes it to the body, and a sleeve's first picked-up stitch takes
it to that sleeve. A stitch put on hold carries a bracket over its cell.
