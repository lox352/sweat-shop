import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sweaterById } from "../index";
import { sweaterStitches } from "../../../knitting/useSweater";
import { currentEdition, editionMissing, editionOf, editionUrl, forgetEditions, frozenEdition, isSuperseded, loadEdition } from "./index";

const here = dirname(fileURLToPath(import.meta.url));
const design = "hamefarin";
const size = "m";
const current = currentEdition(design, size)!;
/** An edition the size has "moved on from": its knitting now, under another name, with one yarn changed so the two can be told apart. */
const older = "0123456789ab";
const olderFile = () => {
  const file = JSON.parse(readFileSync(join(here, `../../../../public/editions/${design}--${size}--${current}.json`), "utf8"));
  file.edition = older;
  file.stitches.slots = file.stitches.slots.map((slot: string) => `${slot}-old`);
  return file;
};
const answering = (reply: () => Response | Promise<Response>) => {
  const fetching = vi.fn(async (...args: unknown[]) => {
    void args;
    return reply();
  });
  vi.stubGlobal("fetch", fetching);
  return fetching;
};

afterEach(() => {
  vi.unstubAllGlobals();
  forgetEditions();
});

describe("which edition a project knits", () => {
  it("is the one it was started on, or the first the site named for one saved before editions", () => {
    expect(editionOf({ sweaterId: design, sizeId: size })).toBe(current);
    expect(editionOf({ sweaterId: design, sizeId: size, edition: older })).toBe(older);
    expect(editionOf({ sweaterId: "no-such", sizeId: size })).toBeUndefined();
  });

  it("is superseded only when it is another than its size's knitting now", () => {
    expect(isSuperseded(design, size, current)).toBe(false);
    expect(isSuperseded(design, size, undefined)).toBe(false);
    expect(isSuperseded(design, size, older)).toBe(true);
    // Not a name an edition could have, and never an address to fetch.
    expect(isSuperseded(design, size, "../../index")).toBe(false);
    expect(isSuperseded("no-such", size, older)).toBe(false);
  });
});

describe("a superseded edition", () => {
  it("is fetched once from the address its name gives, and is then the project's knitting", async () => {
    const fetching = answering(() => new Response(JSON.stringify(olderFile())));
    expect(frozenEdition(design, size, older)).toBeUndefined();
    const [first, again] = await Promise.all([loadEdition(design, size, older), loadEdition(design, size, older)]);
    expect(fetching).toHaveBeenCalledTimes(1);
    expect(fetching.mock.calls[0][0]).toBe(editionUrl(design, size, older));
    expect(editionUrl(design, size, older)).toMatch(/editions\/hamefarin--m--0123456789ab\.json$/);
    expect(again).toBe(first);
    expect(frozenEdition(design, size, older)).toBe(first);
    await loadEdition(design, size, older);
    expect(fetching).toHaveBeenCalledTimes(1);

    const pattern = sweaterById(design)!;
    const now = sweaterStitches(pattern, size);
    const frozen = sweaterStitches(pattern, size, older);
    expect(frozen).toBe(first);
    expect(frozen.stitches.length).toBe(now.stitches.length);
    expect(frozen.stitches[1].slot).toBe(`${now.stitches[1].slot}-old`);
    // The size's own edition, and no edition at all, are its knitting as built.
    expect(sweaterStitches(pattern, size, current)).toBe(now);
  });

  it("the site has no copy of is knitted as the size is now", async () => {
    answering(() => new Response("Not found", { status: 404 }));
    expect(await loadEdition(design, size, older)).toBe("missing");
    expect(editionMissing(design, size, older)).toBe(true);
    expect(frozenEdition(design, size, older)).toBeUndefined();
    const pattern = sweaterById(design)!;
    expect(sweaterStitches(pattern, size, older)).toBe(sweaterStitches(pattern, size));
  });

  it("that cannot be reached is not taken for missing, and is asked for again", async () => {
    const fetching = vi.fn(async (...args: unknown[]): Promise<Response> => {
      void args;
      throw new TypeError("Failed to fetch");
    });
    vi.stubGlobal("fetch", fetching);
    await expect(loadEdition(design, size, older)).rejects.toThrow();
    expect(editionMissing(design, size, older)).toBe(false);
    fetching.mockImplementation(async () => new Response(JSON.stringify(olderFile())));
    expect(await loadEdition(design, size, older)).not.toBe("missing");
    expect(fetching).toHaveBeenCalledTimes(2);
  });

  it("is refused if the file is some other edition's, or cannot be read", async () => {
    answering(() => new Response(JSON.stringify({ ...olderFile(), edition: "ffffffffffff" })));
    await expect(loadEdition(design, size, older)).rejects.toThrow();
    answering(() => new Response("<!doctype html>"));
    await expect(loadEdition(design, size, older)).rejects.toThrow();
    answering(() => new Response("Server error", { status: 500 }));
    await expect(loadEdition(design, size, older)).rejects.toThrow();
    expect(frozenEdition(design, size, older)).toBeUndefined();
  });
});
