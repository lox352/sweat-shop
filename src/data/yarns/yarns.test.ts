import { describe, expect, it } from "vitest";
import { sweaters } from "../sweaters";
import { ranges, searchWools, woolById, woolRanges, wools } from ".";

/**
 * The library is the one place a wool's colour is decided, and every
 * design's shades are copies out of it. Copies go stale, so these check them.
 */
describe("the yarn library", () => {
  it("is nine hundred and ninety-eight shades from five spinners", () => {
    const all = wools();
    expect(Object.keys(all)).toHaveLength(998);
    expect(new Set(Object.values(all).map((w) => w.spinner))).toEqual(
      new Set([
        "Jamieson's of Shetland",
        "Jamieson & Smith",
        "Uradale Yarns",
        "Aister 'oo'",
        "Laxdale Yarn",
      ]),
    );
    // Every entry is a colour you can go and buy.
    Object.entries(all).forEach(([id, wool]) => {
      expect(wool.hex, id).toMatch(/^#[0-9a-f]{6}$/);
      expect(wool.url, id).toMatch(/^https:\/\//);
      expect(wool.name.length, id).toBeGreaterThan(0);
    });
  });

  it("groups into ranges, and every wool is in exactly one", () => {
    const grouped = woolRanges();
    expect(grouped.length).toBe(Object.keys(ranges).length);
    expect(grouped.reduce((n, r) => n + r.wools.length, 0)).toBe(
      Object.keys(wools()).length,
    );
    // And every wool knows which range it came out of.
    grouped.forEach((range) =>
      range.wools.forEach((wool) => expect(wool.rangeId).toBe(range.id)),
    );
  });

  it("is searched by name, by number, by yarn and by spinner", () => {
    expect(searchWools("293").map((w) => w.name)).toContain("Port Wine");
    expect(searchWools("spindrift port wine")).toHaveLength(1);
    expect(searchWools("uradale flukkra").length).toBeGreaterThan(0);
    expect(searchWools("no such wool anywhere")).toHaveLength(0);
  });
});

/**
 * Some shades say what colour they are. Uradale name their undyed wool
 * "Graeff (Shetland black)", "Laebrak (dark grey)", "Flukkra (natural
 * white)", which is as near to a known answer as a photograph of wool gets -
 * so it is worth asking the library whether it agrees with them.
 *
 * Four once did not, and are listed here no longer: Graeff and Laebrak
 * sampled as a mid grey and a light blue, Shoormal as a light blue, Moorit
 * as a neutral. All four were the sample itself rather than the shadow
 * correction applied to it, since no amount of lightening turns a grey blue,
 * and all four have since been read again. Nothing disagrees now, and this
 * fails if anything starts to.
 */
describe("shades that name their own colour", () => {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return (
      0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
    );
  };
  const neutral = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return Math.max(r, g, b) - Math.min(r, g, b) < 14;
  };

  it("are the colour they say", () => {
    const wrong: string[] = [];
    let asked = 0;
    Object.values(wools()).forEach((wool) => {
      const says = /\(([^)]+)\)/.exec(wool.name)?.[1]?.toLowerCase();
      if (!says) return;
      asked += 1;
      const light = lum(wool.hex);
      const ok =
        says.includes("black") ? light < 70
        : says.includes("white") ? light > 200
        : says.includes("grey") ? neutral(wool.hex)
        : says.includes("brown") ? !neutral(wool.hex)
        : true;
      if (!ok && !wrong.includes(wool.name)) wrong.push(wool.name);
    });
    expect(asked).toBeGreaterThan(10);
    expect(wrong.sort()).toEqual([]);
  });

  it("lift the whites without lifting the blacks", () => {
    /*
     * What the shadow correction is for, checked in the aggregate rather than
     * shade by shade: a photograph of wool is partly the gaps between its
     * strands, so a raw sample runs dark, and correcting it must not simply
     * wash everything out.
     */
    const mean = (of: (w: { name: string; hex: string }) => boolean) => {
      const hit = Object.values(wools()).filter(of);
      return hit.reduce((sum, w) => sum + lum(w.hex), 0) / hit.length;
    };
    const named = (word: string) => (w: { name: string }) =>
      new RegExp(`\\b${word}\\b`, "i").test(w.name);
    expect(mean(named("white"))).toBeGreaterThan(200);
    expect(mean(named("black"))).toBeLessThan(90);
  });
});

describe("what the sweaters are knitted in", () => {
  sweaters.forEach((sweater) => {
    it(`${sweater.id} quotes the library correctly`, () => {
      sweater.colourways.forEach((colourway) => {
        colourway.shades.forEach((shade) => {
          const where = `${sweater.id} · ${colourway.id} · ${shade.slot}`;
          if (!shade.wool) {
            // A shade the library cannot reach stays an explicit approximation.
            expect(shade.source, where).toBe("approximate");
            return;
          }
          const wool = woolById(shade.wool);
          if (!wool) throw new Error(`${where}: no such wool ${shade.wool}`);
          expect(shade.name, where).toBe(wool.name);
          expect(shade.code, where).toBe(wool.code);
          expect(shade.hex, where).toBe(wool.hex);
          expect(shade.source, where).toBe("library");
          // And from the range the colourway says it is knitted in.
          if (colourway.wool) expect(wool.rangeId, where).toBe(colourway.wool);
        });
      });
    });

    it(`${sweater.id} gives every slot a shade in every colourway`, () => {
      sweater.colourways.forEach((colourway) => {
        expect(colourway.shades.map((shade) => shade.slot).sort(), colourway.id).toEqual(
          [...sweater.slots].sort(),
        );
      });
    });
  });
});
