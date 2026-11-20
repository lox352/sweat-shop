import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import App from "../App";
import { bareIdFor, getStorageNotice, readProject, renameProject, startProject } from "../../projects/projects";
import { actionsOf, readLog, writeLog } from "../../projects/timing/log";

vi.mock("./SweaterModel", () => ({ default: () => null }));
vi.mock("../chart/Chart", () => ({ default: () => null }));
afterEach(() => { vi.useRealTimers(); localStorage.clear(); window.location.hash = ""; vi.restoreAllMocks(); });

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

it("opens the time spent over the chart, from the bar under it, once there is time to show", async () => {
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
    await act(async () => button("Time")!.click());
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
    expect([...host.querySelectorAll("button")].some(b => b.textContent?.trim() === "Time")).toBe(false);
  } finally { await act(async () => root.unmount()); host.remove(); }
});

it("keeps its link in its address, and never writes it over an address changed from outside the page", async () => {
  const project = startProject("hamefarin", "xs", "simmer-dim");
  const chart = `#/project/${bareIdFor(project.id)}/chart`;
  window.location.hash = chart;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const button = (label: string) => [...host.querySelectorAll("button")].find(b => b.textContent?.trim() === label);
  try {
    await act(async () => root.render(<App />));
    // Its link is in its address from the first.
    expect(window.location.hash).toMatch(/\/chart\?jumper=[\w-]+$/);
    const first = window.location.hash;
    // The jumper changes: its link is another, written once it has stopped changing.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await act(async () => renameProject(project.id, "Dad's"));
    expect(window.location.hash).toBe(first);
    /*
     * And in that moment the address is changed from outside - typed, gone
     * back to. The browser has it at once, and the page only when it is
     * told, a moment after: the link's turn comes between the two.
     */
    window.history.replaceState(null, "", `${chart}?knitting=1`);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    // It is not written over where the knitter was going.
    expect(window.location.hash).toBe(`${chart}?knitting=1`);
    vi.useRealTimers();
    // The page is told.
    await act(async () => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    // The page has caught up, on the knitting that was asked for, and the link is written there.
    expect(button("End of round")).toBeDefined();
    expect(window.location.hash).toMatch(/\/chart\?knitting=1&jumper=[\w-]+$/);
    expect(window.location.hash).not.toContain(first.split("jumper=")[1]);

    // Put away - the phone locked - a change is written at once, straight into the address; and one after it, when the page is back, as before.
    await act(async () => renameProject(project.id, "Mam's"));
    const before = window.location.hash;
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    Reflect.deleteProperty(document, "visibilityState");
    const putAway = window.location.hash;
    expect(putAway).not.toBe(before);
    expect(putAway).toMatch(/\/chart\?knitting=1&jumper=[\w-]+$/);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await act(async () => renameProject(project.id, "Nobody's"));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(window.location.hash).not.toBe(putAway);
    expect(window.location.hash).toMatch(/\/chart\?knitting=1&jumper=[\w-]+$/);
  } finally { await act(async () => root.unmount()); host.remove(); }
});
