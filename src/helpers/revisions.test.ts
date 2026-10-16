import { afterEach, expect, it } from "vitest";
import paulKlee from "../data/sweaters/paul-klee";
import { sweaterStitches } from "../knitting/useSweater";
import { actionsOf, logKeyFor, readLog } from "../knitting/timing/log";
import type { Stitch } from "../types/Stitch";
import { currentVersion, readProject, startProject } from "./projects";
import { currentRevision, movedLog, movedOn } from "./revisions";

afterEach(() => localStorage.clear());

const stitch = (id: number, type: Stitch["type"]): Stitch => ({ id, links: [], type, slot: "A", piece: "yoke" });

it("finds each stitch of the knitting as it was among the same stitches with steps added", () => {
  // Stitches 2 and 4 are markers added since: the knitting as it was is 0, 1, 3, 5.
  const stitches = [stitch(0, "castOn"), stitch(1, "k1"), stitch(2, "marker"), stitch(3, "k1"), stitch(4, "marker"), stitch(5, "k1")];
  const moved = movedOn(stitches, new Set(["marker"]));
  expect([0, 1, 2, 3].map(moved)).toEqual([0, 1, 3, 5]);
});

it("moves a knitting-time log on with it, its taps, undoes and the page's comings and goings", () => {
  const moved = (id: number) => (id < 2 ? id : id + 1);
  // A tap to 1, a tap on to 3, an undo back to 2, and the page hidden.
  const rows = [[1000, 1], [5, 2], [3, -1, 1], [4, 0, 13]];
  expect(movedLog(rows, moved)).toEqual([[1000, 1], [5, 3], [3, -1, 1], [4, 0, 13]]);
  expect(actionsOf(movedLog(rows, moved)).map(({ from, to }) => [from, to])).toEqual([[0, 1], [1, 4], [4, 3]]);
});

it("starts a project counting in every revision of its design", () => {
  expect(currentRevision("paul-klee")).toBe(paulKlee.revisions!.length);
  expect(startProject("paul-klee", "m1", "klee").revision).toBe(currentRevision("paul-klee"));
  expect(startProject("hamefarin", "m", "simmer-dim")).not.toHaveProperty("revision");
});

it("moves a Paul Klee project saved before its markers on past every one before its stitch, once, and its time with it", () => {
  const { stitches } = sweaterStitches(paulKlee, "m1");
  // Knitted up to the raglan's set-up round, just before its first marker: past the band's markers, placed and taken off.
  const next = stitches.find((one) => one.type === "marker" && one.marker === "the right back raglan line")!;
  const before = stitches.filter((one) => one.type === "marker" && one.id < next.id).length;
  expect(before).toBeGreaterThan(0);
  const saved = next.id - 1 - before;
  const id = "project-1760000000000";
  const now = new Date().toISOString();
  localStorage.setItem(id, JSON.stringify({
    version: currentVersion, id, sweaterId: "paul-klee", sizeId: "m1", colourwayId: "klee", progress: saved, startedAt: now, updatedAt: now,
  }));
  // Two taps: to the first stitch, then on to where it was saved.
  localStorage.setItem(logKeyFor(id), JSON.stringify([[1_760_000_000, 1], [60, saved - 1]]));

  const project = readProject(id)!;
  expect(project.progress).toBe(next.id - 1);
  expect(project.revision).toBe(currentRevision("paul-klee"));
  expect(project.updatedAt).toBe(now);
  expect(actionsOf(readLog(id)).map(({ from, to }) => [from, to])).toEqual([[0, 1], [1, next.id - 1]]);
  // Saved so: read again, it stays where it is.
  expect(readProject(id)!.progress).toBe(next.id - 1);
  expect(JSON.parse(localStorage.getItem(id)!).progress).toBe(next.id - 1);
  expect(actionsOf(readLog(id)).at(-1)!.to).toBe(next.id - 1);
});

it("leaves a project already counting in every revision where it is", () => {
  const project = startProject("paul-klee", "m1", "klee");
  localStorage.setItem(project.id, JSON.stringify({ ...project, progress: 13000 }));
  expect(readProject(project.id)!.progress).toBe(13000);
});
