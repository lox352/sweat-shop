// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("keeps secondary text readable on both paper backgrounds", () => {
  const css = readFileSync("src/index.css", "utf8");
  const luminance = (token: string) => {
    const hex = css.match(new RegExp(`--${token}: #([0-9a-f]{6})`))![1];
    return hex.match(/../g)!.map(v => parseInt(v, 16) / 255)
      .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
      .reduce((n, v, i) => n + v * [.2126, .7152, .0722][i], 0);
  };
  for (const background of ["paper", "paper-raised"]) {
    expect((luminance(background) + .05) / (luminance("ink-faint") + .05)).toBeGreaterThanOrEqual(4.5);
  }
});
