import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import App from "../App";
import { bareIdFor, getStorageNotice, readProject, startProject } from "../helpers/projects";
import { actionsOf, readLog, writeLog } from "../knitting/timing/log";

vi.mock("./SweaterModel", () => ({ default: () => null }));
vi.mock("../knitting/Chart", () => ({ default: () => null }));
afterEach(() => { localStorage.clear(); window.location.hash = ""; vi.restoreAllMocks(); });

it("saves once per action under StrictMode and undoes more than one step", async () => {
  const project = startProject("hamefarin", "xs", "simmer-dim");
  window.location.hash = `#/project/${bareIdFor(project.id)}?knitting=1`;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const writes = vi.spyOn(Storage.prototype, "setItem");
  // The project itself; the knitting-time log beside it is written separately.
  const saves = { get calls() { return writes.mock.calls.filter(([key]) => key.startsWith("project-")); } };
  const click = async (label: string) => {
    const button = [...host.querySelectorAll("button")].find(b => b.textContent?.trim() === label);
    expect(button, label).toBeDefined();
    await act(async () => button!.click());
  };
  try {
    await act(async () => root.render(<StrictMode><App /></StrictMode>));
    const summary = document.createElement("summary");
    host.append(summary);
    await act(async () => summary.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true })));
    expect(saves.calls).toHaveLength(0);
    summary.remove();
    // The cast-on: 124 stitches.
    await click("End of round");
    expect(saves.calls).toHaveLength(1);
    expect(readProject(project.id)?.progress).toBe(124);
    expect(getStorageNotice()).toBe("");
    // Joined in the round, a step of its own.
    await click("Joined: carry on");
    expect(saves.calls).toHaveLength(2);
    expect(readProject(project.id)?.progress).toBe(125);
    await click("End of round");
    expect(saves.calls).toHaveLength(3);
    expect(readProject(project.id)?.progress).toBe(249);
    await click("Undo");
    expect(saves.calls).toHaveLength(4);
    expect(readProject(project.id)?.progress).toBe(125);
    await click("Undo");
    expect(readProject(project.id)?.progress).toBe(124);
    // Every change went into the knitting-time log once, the undos marked,
    // after one opening (by link, since the app was loaded before the address
    // was set): StrictMode's double mount writes nothing extra.
    const rows = readLog(project.id);
    expect(rows.filter(row => row[2] !== undefined && row[2] >= 10).map(row => row[2])).toEqual([10]);
    expect(actionsOf(rows).map(({ from, to, undo }) => [from, to, !!undo])).toEqual([
      [0, 124, false], [124, 125, false], [125, 249, false], [249, 125, true], [125, 124, true],
    ]);
  } finally { await act(async () => root.unmount()); host.remove(); }
});

it("opens Explore statistics from the progress card once there is time to explore", async () => {
  const project = startProject("hamefarin", "xs", "simmer-dim");
  // Two evenings of a run of eight every 25 seconds.
  const rows: number[][] = [[1_790_000_000, 0, 10]];
  for (let i = 0; i < 160; i++) rows.push([i === 80 ? 20 * 3600 : 25, 8]);
  writeLog(project.id, rows);
  localStorage.setItem(project.id, JSON.stringify({ ...readProject(project.id), progress: 1280 }));
  window.location.hash = `#/project/${bareIdFor(project.id)}/chart`;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const button = (label: string) => [...host.querySelectorAll("button")].find(b => b.textContent?.trim() === label);
  try {
    await act(async () => root.render(<App />));
    expect(host.textContent).toContain("knitted");
    await act(async () => button("Statistics")!.click());
    expect(window.location.hash).toContain("stats=1");
    const panel = host.querySelector(".stats-panel")!;
    expect(panel.textContent).toMatch(/2\s*sittings/);
    const radios = [...host.querySelectorAll('[role="radio"]')].map(r => [r.textContent, r.getAttribute("aria-checked")]);
    expect(radios).toEqual([["Pattern", "false"], ["Pace", "true"], ["Sittings", "false"]]);
    await act(async () => button("Sittings")!.click());
    expect(panel.textContent).toContain("Each colour a sitting");
    await act(async () => button("Your speeds")!.click());
    const sheet = host.querySelector(".stats-speeds")!;
    expect(sheet.textContent).toContain("You knit a stitch in about");
    expect(sheet.textContent).toContain("Knit");
    await act(async () => button("Done")!.click());
    expect(host.querySelector(".stats-panel")).toBeNull();
    expect(window.location.hash).not.toContain("stats=1");
  } finally { await act(async () => root.unmount()); host.remove(); }
});

it("offers no statistics while nothing has been timed", async () => {
  const project = startProject("hamefarin", "xs", "simmer-dim");
  window.location.hash = `#/project/${bareIdFor(project.id)}/chart?stats=1`;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<App />));
    expect(host.querySelector(".stats-panel")).toBeNull();
    expect([...host.querySelectorAll("button")].some(b => b.textContent?.trim() === "Statistics")).toBe(false);
  } finally { await act(async () => root.unmount()); host.remove(); }
});
