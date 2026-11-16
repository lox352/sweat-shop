import { describe, expect, it } from "vitest";
import { measured } from "./design";
import { chosen } from "./refit";

/**
 * What Each Year Once's layout chooses for each published size: how its years
 * are shared between the yoke, the body and the sleeves, the rounds each
 * piece has, and each year's cut with its rounds of pattern. A change to the
 * planner that changes any size's pattern shows here as the cut that changed,
 * before it shows as an edition's name.
 */
const published: Record<string, { split: string; rounds: [number, number, number]; yoke: string[]; body: string[]; sleeve: string[] }> = {
  xs: {
    split: "3/5/5",
    rounds: [72, 126, 147],
    yoke: ["2014 Chart C between peeries (21)", "2015 Sheep, 8 sky and 4 field rows off (13)", "2016 Three strips (29)"],
    body: ["2017 Three bands, 2 rows off each side (17)", "2018 Dancers and plusses, a row off each side (17)", "2019 Sheep and boat, a round between (24)", "2020 Both star bands (30)", "2021 With its borders (31)"],
    sleeve: ["2022 Anchors and waves (27)", "2023 Flowers (25)", "2024 Rams between zigzags (29)", "2025 Twice, dotted strip between (29)", "2026 Cropped to 28 (28)"],
  },
  s: {
    split: "3/5/5",
    rounds: [75, 131, 151],
    yoke: ["2014 Chart C between peeries (21)", "2015 Sheep, 6 sky and 3 field rows off (16)", "2016 Three strips (29)"],
    body: ["2017 Three bands (21)", "2018 Dancers and plusses, a row off each side (17)", "2019 Sheep and boat, a round between (24)", "2020 Both star bands (30)", "2021 With its borders (31)"],
    sleeve: ["2022 Anchors and waves (27)", "2023 Flowers (25)", "2024 Rams between zigzags (29)", "2025 Twice, dotted strip between (29)", "2026 Cropped to 28 (28)"],
  },
  m: {
    split: "3/5/5",
    rounds: [78, 136, 155],
    yoke: ["2014 Chart C between peeries (21)", "2015 Sheep, 4 sky and 2 field rows off (19)", "2016 Three strips (29)"],
    body: ["2017 Three bands (21)", "2018 Dancers and plusses (21)", "2019 Sheep and boat, a round between (24)", "2020 Both star bands (30)", "2021 With its borders (31)"],
    sleeve: ["2022 Anchors and waves (27)", "2023 Flowers (25)", "2024 Rams between zigzags (29)", "2025 Twice, dotted strip between (29)", "2026 Cropped to 32 (32)"],
  },
  l: {
    split: "3/5/5",
    rounds: [80, 141, 159],
    yoke: ["2014 Both stars, a round between (26)", "2015 Sheep, 4 sky and 2 field rows off (19)", "2016 Three strips (29)"],
    body: ["2017 Three bands (21)", "2018 Dancers and plusses (21)", "2019 Sheep and boat, a round between (24)", "2020 As the hat (38)", "2021 With its borders (31)"],
    sleeve: ["2022 Anchors and waves (27)", "2023 Flowers between peeries (33)", "2024 Rams between zigzags (29)", "2025 Twice, dotted strip between (29)", "2026 Cropped to 28 (28)"],
  },
  xl: {
    split: "3/5/5",
    rounds: [84, 145, 163],
    yoke: ["2014 Both stars, a round between (26)", "2015 As the hat, all the sky (25)", "2016 Three strips (29)"],
    body: ["2017 Four bands (28)", "2018 Dancers and plusses (21)", "2019 Sheep and boat, a round between (24)", "2020 Both star bands (30)", "2021 With its borders (31)"],
    sleeve: ["2022 Anchors and waves (27)", "2023 Flowers between peeries (33)", "2024 Rams between zigzags (29)", "2025 Twice, dotted strip between (29)", "2026 Cropped to 32 (32)"],
  },
  "2xl": {
    split: "3/5/5",
    rounds: [87, 149, 163],
    yoke: ["2014 Both stars, a round between (26)", "2015 As the hat, all the sky (25)", "2016 Three strips with seed borders (33)"],
    body: ["2017 Four bands (28)", "2018 Dancers, plusses, dancers, a row off each side (27)", "2019 Sheep and boat, a round between (24)", "2020 Both star bands (30)", "2021 With its borders (31)"],
    sleeve: ["2022 Anchors and waves (27)", "2023 Flowers between peeries (33)", "2024 Rams between zigzags (29)", "2025 Twice, dotted strip between (29)", "2026 Cropped to 32 (32)"],
  },
  "3xl": {
    split: "3/5/5",
    rounds: [90, 154, 166],
    yoke: ["2014 Both stars, a round between (26)", "2015 As the hat, all the sky (25)", "2016 Three strips with seed borders (33)"],
    body: ["2017 Four bands (28)", "2018 Dancers, plusses, dancers (31)", "2019 Sheep and boat, a round between (24)", "2020 Both star bands (30)", "2021 With its borders (31)"],
    sleeve: ["2022 Anchors and waves (27)", "2023 Flowers between peeries (33)", "2024 Rams between zigzags (29)", "2025 Twice, dotted strip between (29)", "2026 Cropped to 36 (36)"],
  },
  "4xl": {
    split: "3/5/5",
    rounds: [94, 158, 166],
    yoke: ["2014 Both stars, peerie between (30)", "2015 As the hat, all the sky (25)", "2016 Three strips with seed borders (33)"],
    body: ["2017 Four bands (28)", "2018 Dancers, plusses, dancers (31)", "2019 Sheep and boat, a round between (24)", "2020 As the hat (38)", "2021 With its borders (31)"],
    sleeve: ["2022 Anchors and waves (27)", "2023 Flowers between peeries (33)", "2024 Rams between zigzags (29)", "2025 Twice, dotted strip between (29)", "2026 Cropped to 36 (36)"],
  },
};

describe("what Each Year Once's layout chooses", () => {
  for (const size of measured) {
    it(`for ${size.id}`, () => {
      expect(chosen(size.finished, size.id)).toEqual(published[size.id]);
    });
  }
});
