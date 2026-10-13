# How the designs are made

## Hamefarin

A top-down, circular-yoke Fair Isle jumper, knitted in one piece from the neck
down in Shetland 2ply jumper weight. Its file is
`src/data/sweaters/hamefarin.ts`.

### Construction

1. **Neck.** Cast on, join, and work twelve rounds of corrugated rib - knit
   two in a contrast, purl two in the body colour - on 2.75mm needles.
2. **Yoke.** Change to 3.25mm needles. A first increase round straight after
   the rib, then five bands, each preceded by a plain increase round:

   | band | rounds | repeat |
   | --- | --- | --- |
   | Peerie | 5 | 6 |
   | Border | 9 | 12 |
   | Peerie seeds | 3 | 4 |
   | OXO | 17 | 24 |
   | Lozenges | 7 | 12 |

   then plain rounds to the depth of the yoke.
3. **Divide.** From the middle of the back: knit half the back, put the right
   sleeve's stitches on hold and cast on the underarm, knit the front, put the
   left sleeve's on hold and cast on the other underarm, knit the rest of the
   back. Knitted top down and turned the right way up, the rounds run left to
   right as you look at them, which is why the first sleeve reached is the
   wearer's right.
4. **Body.** Plain, then the peerie seeds again above twenty rounds of
   corrugated rib, and bind off.
5. **Sleeves.** Each in turn: put the held stitches back on the needles, and
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
