import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { sweaterById } from "../../compiler/designs";
import { buildSweater } from "../../compiler/engine/engine";
import { yokeRounds } from "../../reading/counted";
import { paletteOf, yarnFor } from "../../reading/palette";
import App from "../App";
import { stitchAt, stitchScale, yokePicture } from "./bodyPicture";
import { ColourwayGrid } from "./ColourwayChoice";

vi.mock("./SweaterModel", () => ({ default: () => null }));
vi.mock("../chart/Chart", () => ({ default: () => null }));

/*
 * A strip is a canvas's picture, which there is none of here: so a canvas
 * that keeps what is painted on it, and a strip that has a size.
 */
interface Fill {
  colour: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
let fills: Fill[] = [];
const WIDTH = 180;
let height = 130;

beforeEach(() => {
  fills = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => ({ width: WIDTH, height, top: 0, left: 0, right: WIDTH, bottom: height, x: 0, y: 0, toJSON() {} }) as DOMRect,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ({
    fillStyle: "",
    fillRect(this: { fillStyle: string }, x: number, y: number, w: number, h: number) {
      fills.push({ colour: this.fillStyle, x, y, w, h });
    },
  })) as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => "data:image/png;base64,AAAA");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  window.location.hash = "";
  localStorage.clear();
});

it.each([
  ["centred up and down where it is the shorter", 130, 5],
  ["from the top where it is the taller", 100, 0],
])("paints a raglan's tile its yoke placed, left to right about the middle of the front, %s", async (_, tall, top) => {
  height = tall;
  const sweater = sweaterById("feline-raglan")!;
  const built = buildSweater(sweater, "xs");
  const front = yokePicture(built)!;
  const colourway = sweater.colourways[0];
  const palette = paletteOf(colourway);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <ColourwayGrid options={[colourway]} chosen={colourway.id} body={{ stitches: built.stitches, rounds: yokeRounds(built), front }} onChoose={() => {}} />,
    ),
  );
  // Sixty rounds, two pixels a stitch in either strip.
  const scale = stitchScale(height, front.rows.length);
  expect(scale).toBe(2);
  const half = Math.ceil(WIDTH / scale / 2);
  const ground = yarnFor(palette, front.ground).hex;
  // What should be on the canvas, cell by cell: the ground, and every stitch over it.
  const grid = front.rows.map((row) =>
    Array.from({ length: 2 * half }, (_, x) => {
      const id = stitchAt(row, x - half);
      return id < 0 ? ground : yarnFor(palette, built.stitches[id]?.slot ?? "").hex;
    }),
  );
  const cells = fills.filter((fill) => fill.w === scale && fill.h === scale);
  const got = front.rows.map(() => Array.from({ length: 2 * half }, () => ground));
  for (const cell of cells) got[cell.y / scale][cell.x / scale] = cell.colour;
  expect(got).toEqual(grid);
  // Every round of the yoke, and not a picture that reads the same mirrored.
  expect(new Set(cells.map((cell) => cell.y)).size).toBe(front.rows.length);
  expect(grid.some((row) => row.join() !== [...row].reverse().join())).toBe(true);
  const motif = host.querySelector<HTMLElement>(".colourway-motif")!;
  expect(motif.style.backgroundRepeat).toBe("no-repeat");
  expect(motif.style.backgroundPosition).toBe(`${Math.round((WIDTH - 2 * half * scale) / 2)}px ${top}px`);
  await act(async () => root.unmount());
});

it("gives the tiles on a raglan's page its yoke placed, and another design's their strip", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  for (const [id, placed] of [
    ["feline-raglan", true],
    ["hamefarin", false],
  ] as const) {
    window.location.hash = `#/sweater/${id}?tab=colours`;
    await act(async () => root.render(<App key={id} />));
    await act(async () => {
      await new Promise((done) => setTimeout(done, 50));
    });
    const motifs = [...host.querySelectorAll<HTMLElement>(".colourway-motif")];
    expect(motifs.length).toBeGreaterThan(0);
    for (const motif of motifs) expect(motif.style.backgroundRepeat === "no-repeat").toBe(placed);
  }
  await act(async () => root.unmount());
}, 120000);
