import { afterEach, describe, expect, it, vi } from "vitest";
import { type Project, dropUnknitted, fitKnittedInto, fitLeaves, fitLeft, fitTaken, getStorageNotice, listProjects, readProject, retrySaving, startProject, writeProject } from "./projects";
import { keepEdition, ownEdition } from "../library/editions/own";
import type { EditionFile } from "../library/editions/format";

afterEach(() => { vi.restoreAllMocks(); retrySaving(); localStorage.clear(); });

it("retains failed saves for recovery and retries them", () => {
  const fail = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
  const project = startProject("hat", "size", "colour");
  expect(getStorageNotice()).toContain("not being saved");
  expect(readProject(project.id)).toEqual(project);
  expect(listProjects()).toContainEqual(project);
  fail.mockRestore();
  retrySaving();
  expect(getStorageNotice()).toBe("");
  expect(JSON.parse(localStorage.getItem(project.id)!)).toEqual(project);
});

it("never collides when starting projects in the same millisecond", () => {
  expect(startProject("h", "s", "c").id).not.toBe(startProject("h", "s", "c").id);
});

it("ignores malformed storage entries without breaking the project list", () => {
  const good = startProject("h", "s", "c");
  for (const bad of [{ updatedAt: 123 }, { progress: -1 }, { progress: 1.5 }, { shades: { A: { name: 7 } } }]) {
    localStorage.setItem("project-bad", JSON.stringify({ ...good, ...bad }));
    expect(listProjects()).toEqual([good]);
  }
});

it("rejects stale progress instead of overwriting a newer saved version", () => {
  const old = startProject("h", "s", "c");
  const newer = writeProject({ ...old, progress: 10 });
  expect(writeProject({ ...old, progress: 1 })).toEqual(newer);
  expect(readProject(old.id)?.progress).toBe(10);
  expect(getStorageNotice()).toContain("another tab");
});

it("recovers failed saves as copies when another tab changed the persisted project", () => {
  const original = startProject("h", "s", "c");
  const fail = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
  writeProject({ ...original, progress: 5 });
  fail.mockRestore();
  const otherTab = { ...original, progress: 20, updatedAt: new Date(Date.now() + 5000).toISOString() };
  localStorage.setItem(original.id, JSON.stringify(otherTab));
  retrySaving();
  expect(readProject(original.id)?.progress).toBe(20);
  expect(listProjects().find(p => p.id !== original.id)?.progress).toBe(5);
  expect(getStorageNotice()).toContain("recovered copy");
});

it("records the edition of the knitting a project is started on, and keeps it", () => {
  const project = startProject("hamefarin", "m", "c");
  expect(project.edition).toMatch(/^[0-9a-f]{12}$/);
  expect(readProject(project.id)?.edition).toBe(project.edition);
  // One saved before editions has none, and is left without: it knits the first (see library/editions).
  const { edition: _edition, ...before } = project;
  void _edition;
  localStorage.setItem(project.id, JSON.stringify(before));
  expect(readProject(project.id)?.edition).toBeUndefined();
  localStorage.setItem(project.id, JSON.stringify({ ...project, edition: 7 }));
  expect(readProject(project.id)).toBeUndefined();
});

it("does not take a project whose making does not read, and takes one whose does", () => {
  const good = startProject("h", "s", "c");
  const tension = { stitchesPer10cm: 24, roundsPer10cm: 30 };
  for (const bad of [{ steps: [] }, { steps: [{}] }, { steps: [{ fit: tension, round: -1 }] }, { steps: [{ join: "zz", round: 3 }] }, { from: 7, steps: [{ fit: tension }] }, []]) {
    localStorage.setItem("project-bad", JSON.stringify({ ...good, made: bad }));
    expect(listProjects(), JSON.stringify(bad)).toEqual([good]);
  }
  localStorage.setItem("project-bad", JSON.stringify({ ...good, id: "project-bad", made: { from: "0123456789ab", steps: [{ join: "ba9876543210", round: 3 }, { fit: tension, round: 9, option: "every" }, { fit: tension }] } }));
  expect(listProjects()).toHaveLength(2);
});

/**
 * The rest worked out for another tension and none of it knitted, then asked
 * for at the tension it was: the knitter has the pattern they had, exactly -
 * what the fit left is gone back to, never planned again.
 */
describe("a fit not knitted into, gone back from", () => {
  const measures = { chestCm: 100, neckCm: 45, yokeDepthCm: 22, bodyLengthCm: 40, upperArmCm: 32, sleeveLengthCm: 45, cuffCm: 20 };
  const written = { stitchesPer10cm: 32, roundsPer10cm: 38 };
  const loose = { stitchesPer10cm: 26, roundsPer10cm: 26 };
  const looser = { stitchesPer10cm: 24, roundsPer10cm: 25 };
  const published = (): Project => ({ ...startProject("h", "s", "c"), edition: "aaaaaaaaaaaa", progress: 4000 });
  const fitted = (edition: string, tension: typeof written, round: number) => ({ edition, tension, finished: measures, round, option: "every" });

  it("from a published edition: the project is as it was", () => {
    const before = published();
    const away = fitTaken(before, fitted("bbbbbbbbbbbb", loose, 64), "aaaaaaaaaaaa");
    expect(away.edition).toBe("bbbbbbbbbbbb");
    expect(away.fit).toMatchObject({ tension: loose, round: 64, from: "aaaaaaaaaaaa" });
    expect(away.made).toEqual({ from: "aaaaaaaaaaaa", steps: [{ fit: loose, round: 64, option: "every" }] });
    expect(fitLeaves(away)).toEqual({ edition: "aaaaaaaaaaaa", own: false });
    expect(fitLeft(away)).toEqual(before);
  });

  it("on another fit not knitted into: it takes that one's place, and going back is still to the pattern as written", () => {
    const before = published();
    const away = fitTaken(before, fitted("bbbbbbbbbbbb", loose, 64), "aaaaaaaaaaaa");
    const further = fitTaken(away, fitted("cccccccccccc", looser, 64), "aaaaaaaaaaaa");
    expect(further.fit).toMatchObject({ tension: looser, round: 64, from: "aaaaaaaaaaaa" });
    // Made as the first was, from the same round of the same edition: one step, not two.
    expect(further.made).toEqual({ from: "aaaaaaaaaaaa", steps: [{ fit: looser, round: 64, option: "every" }] });
    expect(fitLeft(further)).toEqual(before);
  });

  it("on a fit not knitted into, worked out from what that one left and from a round before it: it takes that one's place too", () => {
    // The rest was planned from the end of a band, round 64; the knitter, at round 60, has it planned from where they are (see Refit).
    const before = published();
    const away = fitTaken(before, fitted("bbbbbbbbbbbb", loose, 64), "aaaaaaaaaaaa");
    const sooner = fitTaken(away, { ...fitted("cccccccccccc", loose, 60), instead: true }, "aaaaaaaaaaaa");
    expect(sooner.fit).toMatchObject({ tension: loose, round: 60, from: "aaaaaaaaaaaa" });
    expect(sooner.made).toEqual({ from: "aaaaaaaaaaaa", steps: [{ fit: loose, round: 60, option: "every" }] });
    expect(fitLeft(sooner)).toEqual(before);
    // Worked out from the rest in hand, it is one more thing done to it: said so, even from the same round.
    const on = fitTaken(away, { ...fitted("dddddddddddd", looser, 64), instead: false }, "aaaaaaaaaaaa");
    expect(on.made!.steps).toEqual([{ fit: loose, round: 64, option: "every" }, { fit: looser, round: 64, option: "every" }]);
    expect(fitLeaves(on)).toEqual({ edition: "bbbbbbbbbbbb", own: true, tension: loose });
  });

  it("from knitting of its own, a fit knitted on from: the project is as it was, its fit and its making with it", () => {
    // Fitted at the end of one year and knitted on to the end of the next.
    const first = { ...fitKnittedInto(fitTaken(published(), fitted("bbbbbbbbbbbb", loose, 44), "aaaaaaaaaaaa")), progress: 9000 };
    const own = { ...first, fit: { tension: first.fit!.tension, finished: first.fit!.finished, round: 44, option: "every" } } satisfies Project;
    const away = fitTaken(own, fitted("cccccccccccc", looser, 64), "aaaaaaaaaaaa");
    expect(away.edition).toBe("cccccccccccc");
    // Nothing published is what it left: the pattern as written is knitted past.
    expect(away.fit!.from).toBeUndefined();
    expect(fitLeaves(away)).toEqual({ edition: "bbbbbbbbbbbb", own: true, tension: loose });
    expect(away.made!.steps).toEqual([{ fit: loose, round: 44, option: "every" }, { fit: looser, round: 64, option: "every" }]);
    expect(fitLeft(away)).toEqual(own);
    // And through a third tension, not knitted into either.
    const third = fitTaken(away, fitted("dddddddddddd", written, 64), "aaaaaaaaaaaa");
    expect(third.made!.steps).toEqual([{ fit: loose, round: 44, option: "every" }, { fit: written, round: 64, option: "every" }]);
    expect(fitLeft(third)).toEqual(own);
  });

  it("the knitting it left is kept on the device while it can be gone back to, and let go once the fit is knitted into", () => {
    const file = (edition: string) => ({ design: "h", size: "s", edition }) as unknown as EditionFile;
    for (const edition of ["bbbbbbbbbbbb", "cccccccccccc"]) expect(keepEdition(file(edition))).toBe(true);
    const own = { ...fitTaken(published(), fitted("bbbbbbbbbbbb", loose, 44), "aaaaaaaaaaaa"), progress: 9000 };
    const away = writeProject(fitTaken({ ...own, fit: { tension: loose, finished: measures, round: 44 } }, fitted("cccccccccccc", looser, 64), "aaaaaaaaaaaa"));
    dropUnknitted();
    expect(ownEdition("h", "s", "bbbbbbbbbbbb")).toBeDefined();
    expect(ownEdition("h", "s", "cccccccccccc")).toBeDefined();
    const past = writeProject(fitKnittedInto(readProject(away.id)!));
    expect(past.fit!.before).toBeUndefined();
    expect(fitLeaves(past)).toBeUndefined();
    expect(fitLeft(past)).toEqual(past);
    dropUnknitted();
    expect(ownEdition("h", "s", "bbbbbbbbbbbb")).toBeUndefined();
    expect(ownEdition("h", "s", "cccccccccccc")).toBeDefined();
  });

  it("a project whose fit says what it left reads back, and one that says it badly does not", () => {
    const good = published();
    const before = { edition: "bbbbbbbbbbbb", fit: { tension: loose, finished: measures, round: 44 }, made: { from: "aaaaaaaaaaaa", steps: [{ fit: loose, round: 44 }] }, upTo: "aaaaaaaaaaaa" };
    const fit = { tension: looser, finished: measures, round: 64 };
    writeProject({ ...good, edition: "cccccccccccc", fit: { ...fit, before } });
    expect(readProject(good.id)?.fit?.before).toEqual(before);
    for (const bad of [{ edition: 7 }, { ...before, fit: { ...before.fit, from: "aaaaaaaaaaaa" } }, { ...before, made: { steps: [] } }, { ...before, upTo: "zz" }]) {
      localStorage.setItem(good.id, JSON.stringify({ ...good, edition: "cccccccccccc", fit: { ...fit, before: bad } }));
      expect(readProject(good.id), JSON.stringify(bad)).toBeUndefined();
    }
  });
});
