import { afterEach, describe, expect, it, vi } from "vitest";
import { sweaterById as designById } from "../compiler/designs";
import type { SweaterPattern } from "../compiler/designs/types";
import { buildSweater } from "../compiler/engine/engine";
import { currentEdition, editionUrl, forgetEditions } from "../library/editions";
import { updateFor } from "../library/editions/difference";
import { type EditionFile, decodeEdition, encodeEdition } from "../library/editions/format";
import { asEdition } from "../library/editions/own";
import type { FitAnswer, FitQuestion } from "../library/fit";
import type { SweaterStitches } from "../pattern/knitted";
import { type Linked, linkOf, readLink } from "./link";
import { type Made, type Project, startProject } from "./projects";
import { NotRemade, remake } from "./remake";

const design = "hamefarin";
const size = "m";
const current = currentEdition(design, size)!;
const hamefarin = designById(design)!;
/** Hamefarin with two of its bands redrawn: what its size's knitting "moved on" to, for an edition before it to be joined to. */
const redrawn: SweaterPattern = {
  ...hamefarin,
  charts: hamefarin.charts.map((chart) =>
    ["border", "oxo"].includes(chart.id) ? { ...chart, rows: chart.rows.map(([first, ...rest]) => [{ ...first, slot: first.slot === "G" ? "A" : "G" }, ...rest]) } : chart,
  ),
};
/** Two editions the site has published: the one a knitter began on, and the one it was joined to. */
const [began, moved] = ["aaaaaaaaaaaa", "bbbbbbbbbbbb"];
const files: Record<string, EditionFile> = {
  [began]: encodeEdition(buildSweater(hamefarin, size), design, size, began),
  [moved]: encodeEdition(buildSweater(redrawn, size), design, size, moved),
  [current]: encodeEdition(buildSweater(hamefarin, size), design, size, current),
};
const [mine, theirs] = [decodeEdition(files[began]), decodeEdition(files[moved])];
const endOf = (knitted: SweaterStitches, round: number) => knitted.rounds[round - 1][knitted.rounds[round - 1].length - 1];
/** The last round of the band between the two redrawn, part way round which the knitter is. */
const between = mine.roundLabels.map((label, at) => label.startsWith("Peerie seeds, row") && mine.roundPieces[at] === "yoke").lastIndexOf(true) + 1;

/** The site as it serves editions: those it has, and nothing else. */
const serving = (how: "all" | "none" | "a page for everything" | "down" | "failing" = "all") =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (how === "down") throw new TypeError("Failed to fetch");
      if (how === "failing") return new Response("", { status: 503 });
      const edition = Object.keys(files).find((name) => how === "all" && url === editionUrl(design, size, name));
      if (edition) return new Response(JSON.stringify(files[edition]));
      // A host that has no such file says so, or answers with its page all the same.
      return how === "a page for everything" ? new Response("<!doctype html><title>Sweat Shop</title>") : new Response("", { status: 404 });
    }),
  );

/** A jumper as a link says it, with this much of a project said. */
const linked = (project: Partial<Project>): Linked => readLink(linkOf({ ...startProject(design, size, hamefarin.colourways[0].id), ...project }))!;

/** The worker that plans, standing in: what it is asked, and what it answers. See compiler/fit.worker. */
const planning = (answer: (question: FitQuestion) => FitAnswer[]) => {
  const asked: FitQuestion[] = [];
  const stopped = vi.fn();
  class Planner {
    onmessage: ((event: { data: FitAnswer }) => void) | null = null;
    onerror: (() => void) | null = null;
    terminate = stopped;
    postMessage(question: FitQuestion) {
      asked.push(question);
      queueMicrotask(() => answer(question).forEach((data) => this.onmessage?.({ data })));
    }
  }
  vi.stubGlobal("Worker", Planner);
  return { asked, stopped };
};

afterEach(() => {
  vi.unstubAllGlobals();
  forgetEditions();
  localStorage.clear();
});

describe("a published edition", () => {
  it("is fetched: the one the link names, or the size's now where it names none", async () => {
    serving();
    expect(await remake(linked({ edition: began })).done).toEqual({ edition: began, last: mine.stitches.length - 1 });
    const { edition, ...unnamed } = startProject(design, size, hamefarin.colourways[0].id);
    void edition;
    expect((await remake(readLink(linkOf(unnamed))!).done).edition).toBe(current);
  });

  it("that can't be reached is asked for again; one the site has not got was a jumper's own, and can't be made", async () => {
    serving("down");
    const down = await remake(linked({ edition: began })).done.catch((error: unknown) => error);
    expect(down).toBeInstanceOf(NotRemade);
    expect(down).toMatchObject({ changed: false, message: expect.stringContaining("could not be fetched") });
    serving("failing");
    forgetEditions();
    expect(await remake(linked({ edition: began })).done.catch((error: unknown) => error)).toMatchObject({ changed: false });
    // However the site says it has no such edition: that there is none, with its page in its place, or with another edition than the one asked for.
    for (const how of ["none", "a page for everything"] as const) {
      serving(how);
      forgetEditions();
      const gone = await remake(linked({ edition: began })).done.catch((error: unknown) => error);
      expect(gone, how).toMatchObject({ changed: true, message: expect.stringContaining("made before a link said how") });
    }
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(files[moved]))));
    forgetEditions();
    expect(await remake(linked({ edition: began })).done.catch((error: unknown) => error)).toMatchObject({ changed: true });
  });
});

describe("knitting joined to an update", () => {
  const update = updateFor(mine, theirs, endOf(mine, between) - 40);
  if (update.kind !== "joined") throw new Error("not joined");
  const made: Made = { from: began, steps: [{ join: moved, round: update.round }] };

  it("is joined again at the round it was joined at, and is the same knitting by name and by stitch", async () => {
    serving();
    const was = await asEdition(update.knitting, design, size);
    const remade = await remake(linked({ edition: was.edition, made })).done;
    expect(remade.edition).toBe(was.edition);
    expect(remade.file).toEqual(was);
    expect(remade.last).toBe(update.knitting.stitches.length - 1);
    // Nothing of it was fitted.
    expect(remade.fit).toBeUndefined();
  });

  it("is not given for another pattern than the one the link names", async () => {
    serving();
    const other = await remake(linked({ edition: "0123456789ab", made })).done.catch((error: unknown) => error);
    expect(other).toMatchObject({ changed: true, message: expect.stringContaining("can't be made again exactly as it was") });
  });

  it("says so where the two no longer join at that round, or one of them is not to be had", async () => {
    serving();
    const apart = await remake(linked({ edition: "0123456789ab", made: { from: began, steps: [{ join: moved, round: mine.roundPieces.indexOf("body") + 1 }] } })).done.catch((error: unknown) => error);
    expect(apart).toMatchObject({ changed: true, message: expect.stringContaining("no longer joins there") });
    const lost = await remake(linked({ edition: "0123456789ab", made: { from: began, steps: [{ join: "cccccccccccc", round: update.round }] } })).done.catch((error: unknown) => error);
    expect(lost).toMatchObject({ changed: true });
  });
});

describe("knitting recalculated", () => {
  const tension = { stitchesPer10cm: 24, roundsPer10cm: 28 };
  const finished = hamefarin.sizes.find((one) => one.id === size)!.finished;
  /** What the planner would answer: here, the edition the knitter began on under another name, as what it planned. */
  const planned = (edition: string): EditionFile => ({ ...files[began], edition });
  const fitted = (question: FitQuestion, edition: string): FitAnswer[] => [
    { progress: 0.5 },
    {
      fitted: {
        file: planned(edition),
        ...(question.round === undefined ? {} : { round: question.round }),
        tension: question.tension,
        finished,
        notes: [],
        written: "",
        ...(question.option ? { option: question.option } : {}),
        placement: { places: { a: 0.5 } },
      },
    },
    { done: true },
  ];

  it("asks the planner what it was asked then - the knitting so far, the round, the tension, the one way - a step at a time, and says how far it has got", async () => {
    serving();
    const { asked } = planning((question) => fitted(question, asked.length === 1 ? "111111111111" : "222222222222"));
    const made: Made = { from: began, steps: [{ fit: tension, round: 30, option: "every" }, { fit: { stitchesPer10cm: 22, roundsPer10cm: 26 }, round: 44 }] };
    const told: number[] = [];
    const remade = await remake(linked({ edition: "222222222222", made }), (fraction) => told.push(fraction)).done;
    expect(asked).toHaveLength(2);
    // The first, from the published edition it began as.
    expect(asked[0]).toMatchObject({ design, sizeId: size, round: 30, tension, option: "every" });
    expect(asked[0].knitted?.stitches).toEqual(mine.stitches);
    expect(asked[0].progress).toBeUndefined();
    // The second, from what the first came to; and with no way named, as none was.
    expect(asked[1]).toMatchObject({ round: 44, tension: { stitchesPer10cm: 22, roundsPer10cm: 26 } });
    expect(asked[1].knitted?.stitches).toEqual(decodeEdition(planned("111111111111")).stitches);
    expect("option" in asked[1]).toBe(false);
    expect(told).toEqual([0.25, 0.5, 0.75, 1]);
    // What it comes to is the last of them, with its fit: the published edition the first left is the one to go back to.
    expect(remade).toEqual({
      edition: "222222222222",
      file: planned("222222222222"),
      last: mine.stitches.length - 1,
      fit: { tension: { stitchesPer10cm: 22, roundsPer10cm: 26 }, finished, round: 44, from: began, placement: { places: { a: 0.5 } } },
    });
  });

  it("from the cast-on begins as nothing: no knitting is fetched or handed over, and there is no edition to go back to", async () => {
    const fetching = vi.fn();
    vi.stubGlobal("fetch", fetching);
    const { asked } = planning((question) => fitted(question, "333333333333"));
    const remade = await remake(linked({ edition: "333333333333", made: { steps: [{ fit: tension, option: "fewer" }] } })).done;
    expect(fetching).not.toHaveBeenCalled();
    expect(asked).toEqual([{ design, sizeId: size, tension, option: "fewer" }]);
    expect(remade.fit).toEqual({ tension, finished, option: "fewer", placement: { places: { a: 0.5 } } });
  });

  it("is not given where the planner now answers another pattern, or can't plan it at all", async () => {
    serving();
    const made: Made = { from: began, steps: [{ fit: tension, round: 30 }] };
    planning((question) => fitted(question, "444444444444"));
    const changed = await remake(linked({ edition: "555555555555", made })).done.catch((error: unknown) => error);
    expect(changed).toMatchObject({ changed: true, message: expect.stringContaining("pattern-making has changed") });
    planning(() => [{ cannot: "The rest of this pattern can't be worked out again from where you are." }]);
    const cannot = await remake(linked({ edition: "555555555555", made })).done.catch((error: unknown) => error);
    expect(cannot).toBeInstanceOf(NotRemade);
    expect(cannot).toMatchObject({ changed: true, message: "The rest of this pattern can't be worked out again from where you are." });
    // A link that says its knitting was planned from a round, and not what it began as, has nothing to plan from.
    const baseless = await remake(linked({ edition: "555555555555", made: { steps: [{ fit: tension, round: 30 }] } })).done.catch((error: unknown) => error);
    expect(baseless).toMatchObject({ changed: true, message: expect.stringContaining("does not say what it began as") });
  });

  it("stops the planner where it is no longer wanted", async () => {
    serving();
    const { asked, stopped } = planning(() => []);
    const request = remake(linked({ edition: "555555555555", made: { from: began, steps: [{ fit: tension, round: 30 }] } }));
    await vi.waitFor(() => expect(asked).toHaveLength(1));
    request.cancel();
    expect(stopped).toHaveBeenCalled();
  });
});
