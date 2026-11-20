import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { sweaterById } from "../../compiler/designs";
import { buildSweater } from "../../compiler/engine/engine";
import { colourwayLabel, type Overrides } from "../../reading/palette";
import { ColourwayGrid } from "./ColourwayChoice";
import { useColourwayChoice } from "../useColourwayChoice";

const sweater = sweaterById("hamefarin")!;
const { stitches, rounds } = buildSweater(sweater, "xs");
const [vintage, kaleyard] = sweater.colourways;

beforeAll(() => {
  // jsdom has the dialog element but not its modal methods.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true; };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; };
});
afterEach(() => { document.body.innerHTML = ""; });

/** The choice as a page of a jumper's colours lays it out: a group's tiles, and the asking that goes with choosing one. */
const Choice = ({ overrides, onStartFrom }: { overrides: Overrides; onStartFrom: (id: string) => void }) => {
  const { groups, choose, confirm } = useColourwayChoice({ colourways: sweater.colourways, colourway: vintage, overrides, onStartFrom });
  return (
    <>
      <ColourwayGrid options={groups[0][1]} chosen={vintage.id} body={{ stitches, rounds }} onChoose={choose} />
      {confirm}
    </>
  );
};

const show = async (overrides: Overrides) => {
  const onStartFrom = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  await act(async () => createRoot(host).render(
    <Choice overrides={overrides} onStartFrom={onStartFrom} />,
  ));
  const tile = (name: string) => [...host.querySelectorAll(".colourway-grid button")].find(b => b.querySelector("strong")?.textContent === name) as HTMLButtonElement;
  return { host, onStartFrom, tile };
};

it("starts straight from another colourway while none of the wool is your own", async () => {
  const { host, onStartFrom, tile } = await show({});
  // The base in use is the one marked.
  expect([...host.querySelectorAll(".colourway-grid .is-chosen strong")].map((one) => one.textContent)).toEqual([vintage.name]);
  // The one you're on stays offered, and choosing it again changes nothing.
  await act(async () => tile(vintage.name).click());
  expect(onStartFrom).not.toHaveBeenCalled();
  await act(async () => tile(kaleyard.name).click());
  expect(onStartFrom).toHaveBeenCalledWith(kaleyard.id);
});

it("asks before starting again over wool of your own", async () => {
  const { host, onStartFrom, tile } = await show({ D: { name: "Poppy", hex: "#c8323a" } });
  await act(async () => tile(kaleyard.name).click());
  expect(onStartFrom).not.toHaveBeenCalled();
  const dialog = host.querySelector("dialog")!;
  expect(dialog.open).toBe(true);
  expect(dialog.textContent).toContain(`Every yarn changes to ${kaleyard.name}'s, including the one of your own.`);
  await act(async () => (dialog.querySelector('button[type="submit"]') as HTMLButtonElement).click());
  expect(onStartFrom).toHaveBeenCalledWith(kaleyard.id);
});

it("names a colourway as your own once any of its wool is changed", () => {
  expect(colourwayLabel(vintage, undefined)).toBe(vintage.name);
  expect(colourwayLabel(vintage, { D: { name: "Poppy", hex: "#c8323a" } })).toBe(`Your own, from ${vintage.name}`);
});
