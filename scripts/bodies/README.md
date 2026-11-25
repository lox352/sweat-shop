# The bodies a shaped yoke is placed for

`src/compiler/designs/wool-week/strips/bodies.json` is made here, once, and
kept: the room each part of the way round a yoke has at each depth below the
cast-on, for each size, as the mean of four bodies. `body.ts` beside it says
how the compiler uses it. Nothing here runs when the site is built or tested.

## What it is made from

- **Anny**, NAVER Labs' parametric body model (`pip install anny`; code under
  Apache 2.0, body shapes from MakeHuman under CC0). Only its own `anny`
  topology is used: the optional `smplx` one is licensed for non-commercial
  use and is not wanted here.
- For each size, **three men** (165, 175.5 and 188cm tall) **and a woman**
  (172cm), each as big round the chest as the size is to fit. Where Anny
  cannot be made that big or that small at that height, the nearest she can be
  is made wider and deeper to it, not taller (`widen` in each body's file).
- The 105.6cm chest and 175.5cm stature of the man in the middle are the
  medians of the men of the US Army's ANSUR II survey, which is size L.

## How

1. `yoke.mjs` writes a size's yoke as Each Year Once knits it: for the length
   of its cast-on and how many rows deep it is.
2. `anny_body.py` fits Anny to a chest and a stature, lets her arms down to
   hang at her sides, leaves off her head and jaw, and **fills her in** as a
   ball of 5cm rolled all over her would leave her: knitting lies straight
   across the hollows a body has where they are small, and follows the body
   where they are wide. It writes the filled body's surface round an upright
   axis through the middle of the neck's ring.
3. `lines.mjs` lays the neck's ring on it - as long as the cast-on, and tilted
   so that the back wants the six rows more than the front that the pattern's
   three pairs of short rows give it - and runs the lines down from it that a
   yoke's columns follow: straight down from where they start, as seen from
   above, a round lying where every column has come the same number of rows.
4. `tables.mjs` takes the width between those lines, in 48 sectors of the
   round at every half centimetre of depth, evened over two sectors either
   side, and the mean of a size's four bodies.

`all.sh` does all of it for every size (about an hour): it wants Python with
`anny`, `numpy`, `scipy` and `torch`, and this repository's `node_modules`.

## What was decided, and by what

- **Placing for a mix of bodies** and not one: increases placed for one man
  left a woman's yoke at 0.14 uneven where her own would be 0.04; placed for
  the four at once, 0.11, at a cost to the men of about 0.01 each.
- **Placing freely**, to a 48th of the round, and not by a few stretches:
  measured on bodies it was not placed for, it did better than five stretches
  a side on every one.
- **A 5cm ball.** Between 3cm and 5cm the answer hardly moves; at 8cm the
  hollows round the neck itself fill in and every placement does worse than
  none.
- **The pattern's own short rows**, and the neck put where they fit: left to
  rest where it would sit lowest, the ring asked for five times as many.
- **Each band's own doubled columns are left as they are**, the same in every
  repeat: letting a repeat take them or not by where it is round the body made
  the yoke 0.007 more even, and would have given every band two charts.

- **No round leans its stitches more than four** (`LEAN` in `body.ts`): placed
  with no limit, 2XL and 3XL each had a round making ten stitches in the thirty
  across the middle of the front, which carried the stitches beside them four
  or five stitches round off what they were worked into. Capped at four, the
  yokes at their foot are 0.03 to 0.10 uneven where uncapped they were 0.03 to
  0.10 too, and Each Year Once's are 0.18 to 0.35.

(Unevenness: over every stitch of the yoke, the root mean square of the log of
the room a stitch's place has for it against a stitch's share.)
