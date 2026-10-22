import { afterEach, expect, it } from "vitest";
import { sweaters } from "../data/sweaters";
import { backupText, parseBackup, restoreBackup } from "./backups";
import { deleteProject, listProjects, startProject } from "./projects";
import { readLog, writeLog } from "../knitting/timing/log";
afterEach(() => localStorage.clear());

const s = sweaters[0];

it("round trips without overwriting existing projects", () => {
  const p = startProject(s.id, s.sizes[0].id, s.colourways[0].id);
  const copies = parseBackup(backupText());
  expect(copies[0].id).not.toBe(p.id);
  restoreBackup(copies);
  expect(listProjects()).toHaveLength(2);
});

it("rejects malformed and future-version backups without writes", () => {
  expect(() => parseBackup('{"format":"sweat-shop-projects","version":2,"projects":[]}')).toThrow();
  expect(() => parseBackup('{"format":"sweat-shop-projects","version":1,"projects":[{}]}')).toThrow();
  // A hat site's backup is not one of these.
  expect(() => parseBackup('{"format":"wool-week-projects","version":1,"projects":[]}')).toThrow();
  expect(listProjects()).toHaveLength(0);
});

it("rejects progress past the end of the size's knitting", () => {
  const p = startProject(s.id, s.sizes[0].id, s.colourways[0].id);
  const text = JSON.parse(backupText());
  text.projects[0].progress = 10_000_000;
  expect(() => parseBackup(JSON.stringify(text))).toThrow("invalid progress");
  expect(listProjects()).toEqual([p]);
});

it("carries each project's knitting times with it, and refuses a broken log", () => {
  const p = startProject(s.id, s.sizes[0].id, s.colourways[0].id);
  writeLog(p.id, [[1_790_000_000, 0, 10], [40, 12]]);
  const [copy] = restoreBackup(parseBackup(backupText()));
  expect(readLog(copy.id)).toEqual([[1_790_000_000, 0, 10], [40, 12]]);
  expect(JSON.parse(localStorage.getItem(copy.id)!).timeLog).toBeUndefined();
  const broken = JSON.parse(backupText());
  broken.projects[0].timeLog = [[1, 0, 99]];
  expect(() => parseBackup(JSON.stringify(broken))).toThrow("knitting times");
});

it("forgets a project's knitting times when the project is deleted", () => {
  const p = startProject(s.id, s.sizes[0].id, s.colourways[0].id);
  writeLog(p.id, [[1_790_000_000, 12]]);
  deleteProject(p.id);
  expect(readLog(p.id)).toEqual([]);
});

it("carries a project's trim with it, and refuses one that is not a string", () => {
  const sampler = sweaters.find((x) => x.trim)!;
  startProject(sampler.id, "m", sampler.colourways[0].id, {}, "jamieson-s-of-shetland-spindrift-104");
  const [copy] = restoreBackup(parseBackup(backupText()));
  expect(copy.trim).toBe("jamieson-s-of-shetland-spindrift-104");
  const broken = JSON.parse(backupText());
  broken.projects[0].trim = 104;
  expect(() => parseBackup(JSON.stringify(broken))).toThrow();
});
