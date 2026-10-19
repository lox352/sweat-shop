# Where the Wool Week samplers' charts came from

The samplers knit the charts of the Shetland Wool Week hats from 2014 to 2026,
which Shetland Wool Week and their designers publish and sell. They came here
from the hat site (lox352/wool-week), where each was read out of its pattern -
see that repository's `PATTERNS.md` for how, chart by chart.

Each year is one file, `src/data/sweaters/wool-week/swwNN.json`, and one line
in `src/data/sweaters/wool-week/years.ts`. Take both out, and the year's cuts
out of `strips/cuts.ts` and its ladder out of `strips/refit.ts`, and that year
is gone, though both samplers count on thirteen. If Shetland Wool Week or a designer would rather a
year were not here, it should come out. This site is not public.

What comes over is the charts, cell for cell, but for 2026's band of
lettering; the hat's first colourway, which is what its yarns are put onto
the samplers' palettes from; every colourway the hat was published in, for
the samplers' collections; and, for 2026, which is charted a ground and a
motif to a row, the letters its other printing puts in each. No written
instructions.

```sh
# Bring the hats over again from a checkout of the hat site.
node --experimental-strip-types scripts/import-wool-week.mjs ../wool-week

# Put their yarns onto the samplers' palettes, and choose their collections.
node scripts/strip-colourways.mjs
```

| Year | Hat | Designer |
| --- | --- | --- |
| 2014 | Shwook Hat | Hazel Tindall |
| 2015 | Baa-ble Hat | Donna Smith |
| 2016 | Crofthoose Hat | Ella Gordon |
| 2017 | Bousta Beanie | Gudrun Johnston |
| 2018 | Merrie Dancers Toorie | Elizabeth Johnston |
| 2019 | Roadside Beanie | Sandra Manson, for Oliver Henry |
| 2020 | Katie's Kep | Wilma Malcolmson |
| 2021 | Da Crofter's Kep | Wilma Malcolmson |
| 2022 | Bonnie Isle Hat | Linda Shearer |
| 2023 | Buggiflooer Beanie | Alison Rendall |
| 2024 | Islesburgh Toorie | Anne Doull, for the Doull family |
| 2025 | Aal Ower Toorie | Rachel Hunter, for the Shetland Guild of Spinners, Knitters, Weavers and Dyers |
| 2026 | Birsie Beanny | Helen Robertson |
