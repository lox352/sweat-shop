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
