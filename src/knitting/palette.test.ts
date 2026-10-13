import { describe, expect, it } from "vitest";
import { ballsOf, colourwayLabel, ownBalls, paletteOf, yarnFor } from "./palette";
import { sweaterById } from "../data/sweaters";

const sweater = sweaterById("hamefarin")!;
const colourwayOf = (id: string) => sweater.colourways.find((one) => one.id === id)!;
const metres = { A: 1000, B: 50, C: 40, D: 40, E: 100, F: 80, G: 30, H: 25 };

describe("the wool a colourway is knitted in", () => {
  it("gives a ball of its own to every yarn that has one, and counts it from its metres", () => {
    const colourway = colourwayOf("simmer-dim");
    const balls = ballsOf(colourway, metres);
    expect(balls).toHaveLength(8);
    expect(balls.every((ball) => ball.slots.length === 1)).toBe(true);
    // Spindrift is 105m a ball: 1000m is ten balls rounded up, 25m still one.
    expect(balls[0]).toMatchObject({ slots: ["A"], balls: 10 });
    expect(balls[7]).toMatchObject({ slots: ["H"], balls: 1 });
  });

  it("counts one wool once, however many yarns it does, with all their metres together", () => {
    const colourway = colourwayOf("simmer-dim");
    const chosen = { wool: "jamieson-s-of-shetland-spindrift-293", name: "Port Wine", code: "293", hex: "#382229" };
    const overrides = { B: chosen, G: chosen };
    const balls = ballsOf(colourway, metres, overrides);
    expect(balls).toHaveLength(7);
    const port = balls.find((ball) => ball.yarn.name === "Port Wine")!;
    expect(port.slots).toEqual(["B", "G"]);
    expect(port.metres).toBe(80);
    expect(port.yarn.approximate).toBe(false);
    expect(ownBalls(colourway, overrides)).toBe(1);
    // And the rest of the colourway is untouched.
    expect(yarnFor(paletteOf(colourway, overrides), "C").name).toBe("Mermaid");
  });

  it("says when a colourway has become your own", () => {
    const colourway = colourwayOf("moorit");
    expect(colourwayLabel(colourway, undefined)).toBe("Moorit");
    expect(colourwayLabel(colourway, { A: { hex: "#000000" } })).toBe("Your own, from Moorit");
  });
});
