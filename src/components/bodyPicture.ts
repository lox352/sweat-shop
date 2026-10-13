import { useMemo } from "react";
import type { SlotId } from "../data/sweaters/types";
import type { Stitch } from "../types/Stitch";
import { yarnFor, type Palette } from "../knitting/palette";

/**
 * The rounds a picture of a sweater is of: its yoke's colourwork, from the
 * first band to the last, plain rounds between them and all.
 *
 * Not the ribbing, which is two colours too but is a knit-and-purl texture
 * rather than a pattern - so the picture starts at the first round of two
 * colours with no purl in it, and stops at the last.
 */
export const bodyRounds = (rounds: number[][], stitches: Stitch[]) => {
  const patterned = (round: number[]) => {
    const slots = new Set<string>();
    for (const id of round) {
      const stitch = stitches[id];
      if (!stitch) continue;
      if (stitch.type === "p1") return false;
      slots.add(stitch.slot);
    }
    return slots.size > 1;
  };
  const first = rounds.findIndex(patterned);
  if (first < 0) return rounds;
  let last = rounds.length - 1;
  while (last > first && !patterned(rounds[last])) last--;
  return rounds.slice(first, last + 1);
};

/**
 * Whole screen pixels a stitch, as near as they come to a strip `height`
 * screen pixels tall; until that is measured, a pixel a stitch for the
 * browser to scale.
 */
export const stitchScale = (height: number, rows: number) => Math.max(1, Math.round(height / Math.max(1, rows)));

/**
 * The yoke painted `scale` screen pixels a stitch, once per change of wool,
 * to use as a background, the way it is worn: the neck's end at the top.
 *
 * Every round is drawn as wide as the widest, its own stitches over and over
 * - a round goes all the way round the yoke, so more of it is simply the
 * next repeat - which keeps every band at the same stitch scale however many
 * stitches its round has. The picture is repeated sideways for the same
 * reason. Undefined where there is no canvas (a test environment).
 */
export const usePainting = (body: number[][], stitches: Stitch[], palette: Palette, scale: number, highlight?: SlotId[]) =>
  useMemo(() => {
    if (body.length === 0 || typeof document === "undefined") return undefined;
    const element = document.createElement("canvas");
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = element.getContext("2d");
    } catch {
      // No canvas here: the plain ground shows instead.
    }
    if (!ctx) return undefined;
    const width = Math.max(...body.map((round) => round.length));
    element.width = width * scale;
    element.height = body.length * scale;
    const lit = highlight && new Set(highlight.map((slot) => palette[slot]));
    body.forEach((round, y) => {
      for (let x = 0; x < width; x++) {
        const yarn = yarnFor(palette, stitches[round[x % round.length]]?.slot ?? "");
        ctx.globalAlpha = lit && !lit.has(yarn) ? 0.14 : 1;
        ctx.fillStyle = yarn.hex;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    });
    return { url: element.toDataURL(), width: element.width, height: element.height };
  }, [body, stitches, palette, highlight, scale]);
