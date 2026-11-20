import { afterEach, describe, expect, it } from "vitest";
import { sweaterById } from "../library/catalogue";
import { currentEdition } from "../library/editions";
import { keepEdition } from "../library/editions/own";
import type { EditionFile } from "../library/editions/format";
import { addressOf, linkOf, linkParam, pathIn, readLink } from "./link";
import { type Project, bareIdFor, madeOf, madeWith, startProject, writeProject } from "./projects";
import { asWritten, projectOf } from "./remake";

afterEach(() => localStorage.clear());

const hamefarin = sweaterById("hamefarin")!;
const [size, colourway] = [hamefarin.sizes[1], hamefarin.colourways[0]];
const loose = { stitchesPer10cm: 24.5, roundsPer10cm: 28 };
const published = currentEdition("hamefarin", size.id)!;

/** A jumper with everything a link carries: named, in wool of its knitter's own, part knitted, and its pattern recalculated part way. */
const whole = (): Project =>
  writeProject({
    ...startProject("hamefarin", size.id, colourway.id, { [hamefarin.slots[0]]: { name: "Flùgga", code: "FC34", hex: "#aabbcc" } }, "trim-wool"),
    name: "Dad's, for Yule ❄",
    progress: 4321,
    edition: "0123456789ab",
    tension: loose,
    made: { from: published, steps: [{ join: "ba9876543210", round: 12 }, { fit: loose, round: 30, option: "every" }] },
    upTo: published,
  });

describe("a jumper's link", () => {
  it("says everything that makes the jumper, and reads back as it", () => {
    const project = whole();
    const linked = readLink(linkOf(project))!;
    expect(linked).toEqual({
      id: project.id,
      name: project.name,
      sweater: hamefarin,
      sizeId: size.id,
      colourwayId: colourway.id,
      trim: "trim-wool",
      shades: project.shades,
      edition: "0123456789ab",
      progress: 4321,
      tension: loose,
      made: project.made,
      upTo: published,
      // To the second.
      startedAt: new Date(Math.round(Date.parse(project.startedAt) / 1000) * 1000).toISOString(),
    });
    // And is an address's worth: a few hundred characters, of the kind an address is made of.
    expect(linkOf(project)).toMatch(/^[0-9A-Za-z_-]{100,700}$/);
  });

  it("of a jumper just started on the pattern as published is its design, size, wool and edition", () => {
    const project = startProject("hamefarin", size.id, colourway.id);
    expect(readLink(linkOf(project))).toEqual({
      id: project.id,
      sweater: hamefarin,
      sizeId: size.id,
      colourwayId: colourway.id,
      edition: published,
      progress: 0,
      startedAt: expect.any(String),
    });
  });

  it("is refused where it is not one, or names what the site has not got", () => {
    const written = (change: Record<string, unknown>) =>
      btoa(JSON.stringify({ v: 1, i: "abc", d: "hamefarin", s: size.id, c: colourway.id, ...change })).replace(/=+$/, "");
    expect(readLink(written({}))).toBeDefined();
    for (const bad of [
      { v: 2 },
      { d: "no-such-design" },
      { s: "no-such-size" },
      { c: "no-such-colourway" },
      { i: "../etc" },
      { p: -1 },
      { p: 1.5 },
      { e: "not hex" },
      { g: [1, 30] },
      { g: "tight" },
      { w: { ZZ: { hex: "#000000" } } },
      { w: { [hamefarin.slots[0]]: { hex: "red" } } },
      { n: "x".repeat(201) },
      { m: { s: [] }, e: "0123456789ab" },
      { m: { s: [["f", 24, 28, 0]] } },
      { m: { s: [["x", 1, 2]] }, e: "0123456789ab" },
      { m: { f: "nope", s: [["f", 24, 28, 3]] }, e: "0123456789ab" },
      { m: { s: [["j", "0123456789ab", 0]] }, e: "0123456789ab" },
    ]) {
      expect(readLink(written(bad)), JSON.stringify(bad)).toBeUndefined();
    }
    for (const junk of ["", "%%%", "e30", btoa("[]"), btoa("null"), "A".repeat(9000)]) expect(readLink(junk)).toBeUndefined();
    expect(readLink(null)).toBeUndefined();
  });

  it("is found in what is pasted, where that is a jumper's address", () => {
    const project = startProject("hamefarin", size.id, colourway.id);
    const path = `/project/${bareIdFor(project.id)}?${linkParam}=${linkOf(project)}`;
    expect(addressOf(project)).toBe(`${window.location.origin}${window.location.pathname}#${path}`);
    expect(pathIn(addressOf(project))).toBe(path);
    expect(pathIn(`  Here it is: ${addressOf(project)}\n`)).toBe(path);
    // The chart's address, with what else it says, is the jumper's all the same.
    expect(pathIn(`https://example.org/sweat-shop/#/project/${bareIdFor(project.id)}/chart?knitting=1&${linkParam}=${linkOf(project)}`)).toBe(path);
    expect(pathIn("https://example.org/sweat-shop/#/sweater/hamefarin")).toBeUndefined();
    expect(pathIn(`#/project/another-id?${linkParam}=${linkOf(project)}`)).toBeUndefined();
    expect(pathIn(`#/project/${bareIdFor(project.id)}?${linkParam}=junk`)).toBeUndefined();
  });
});

describe("how a project's knitting was made", () => {
  const fitStep = { fit: loose, round: 30 };

  it("begins at the published edition it left, and is added to", () => {
    const project = startProject("hamefarin", size.id, colourway.id);
    const once = madeWith(project, fitStep);
    expect(once).toEqual({ from: published, steps: [fitStep] });
    expect(madeWith({ ...project, made: once }, { fit: loose, round: 44 })).toEqual({ from: published, steps: [fitStep, { fit: loose, round: 44 }] });
  });

  it("begins as nothing, for a whole sweater from the cast-on", () => {
    const project = { ...startProject("hamefarin", size.id, colourway.id), made: { from: published, steps: [fitStep] } };
    expect(madeWith(project, { fit: loose })).toEqual({ steps: [{ fit: loose }] });
  });

  it("is taken from the last fit of a project fitted before it was kept", () => {
    const finished = size.finished;
    const project = { ...startProject("hamefarin", size.id, colourway.id), edition: "0123456789ab", fit: { tension: loose, finished, round: 30, from: published, option: "every" } };
    expect(madeOf(project)).toEqual({ from: published, steps: [{ fit: loose, round: 30, option: "every" }] });
    expect(madeOf({ ...project, fit: { tension: loose, finished, from: published } })).toEqual({ steps: [{ fit: loose }] });
  });

  it("is not known for knitting made its own some other way before it was kept", () => {
    const project = { ...startProject("hamefarin", size.id, colourway.id), edition: "0123456789ab" };
    keepEdition({ design: "hamefarin", size: size.id, edition: "0123456789ab" } as EditionFile);
    expect(madeWith(project, fitStep)).toBeUndefined();
  });
});

describe("a linked jumper made again", () => {
  it("is the jumper itself where it is carried on: its id, name and place, held to the knitting it has", () => {
    const project = whole();
    const linked = readLink(linkOf(project))!;
    const remade = { edition: "0123456789ab", file: {} as EditionFile, last: 4000, fit: { tension: loose, finished: size.finished, round: 30 } };
    expect(projectOf(linked, remade, true)).toMatchObject({ id: project.id, name: project.name, progress: 4000, edition: "0123456789ab", made: project.made, fit: remade.fit, tension: loose, shades: project.shades });
    expect(projectOf(linked, remade, true).startedAt.slice(0, 19)).toBe(new Date(Math.round(Date.parse(project.startedAt) / 1000) * 1000).toISOString().slice(0, 19));
  });

  it("is one like it where it is begun: an id of its own, no name, the cast-on", () => {
    const project = whole();
    const begun = projectOf(readLink(linkOf(project))!, { edition: "0123456789ab", file: {} as EditionFile, last: 4000 }, false);
    expect(begun.id).not.toBe(project.id);
    expect(begun).toMatchObject({ progress: 0, edition: "0123456789ab", made: project.made, colourwayId: colourway.id });
    expect(begun.name).toBeUndefined();
  });

  it("can be begun on the pattern as written where its own can't be had, its wool and tension kept", () => {
    const written = asWritten(readLink(linkOf(whole()))!);
    expect(written).toMatchObject({ progress: 0, edition: published, tension: loose, trim: "trim-wool" });
    expect(written.made).toBeUndefined();
    expect(written.fit).toBeUndefined();
  });
});
