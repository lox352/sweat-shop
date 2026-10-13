import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { sweaterById } from "../data/sweaters";
import { buildSweater } from "../knitting/engine";
import { colourwayLabel, paletteOf, type Overrides } from "../knitting/palette";
import ColourwayChoice from "./ColourwayChoice";

const sweater = sweaterById("hamefarin")!;
const { stitches, rounds } = buildSweater(sweater, "xs");
const [vintage, kaleyard] = sweater.colourways;

beforeAll(() => {
  // jsdom has the dialog element but not its modal methods.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true; };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; };
});
afterEach(() => { document.body.innerHTML = ""; });

const show = async (overrides: Overrides) => {
  const onStartFrom = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  await act(async () => createRoot(host).render(
    <ColourwayChoice colourways={sweater.colourways} colourway={vintage} overrides={overrides}
      palette={paletteOf(vintage, overrides)} body={{ stitches, rounds }} onStartFrom={onStartFrom} />,
  ));
  const tile = (name: string) => [...host.querySelectorAll(".colourway-starts button")].find(b => b.querySelector("strong")?.textContent === name) as HTMLButtonElement;
  return { host, onStartFrom, tile };
};

it("starts straight from another colourway while none of the wool is your own", async () => {
  const { host, onStartFrom, tile } = await show({});
  expect(host.querySelector(".your-colourway")?.textContent).toContain(`${vintage.name}, as the design gives it`);
  // None of the pattern's is marked as chosen: they are starting points.
  expect(host.querySelectorAll(".colourway-starts .is-chosen")).toHaveLength(0);
  // The one you're on stays offered, and choosing it again changes nothing.
  await act(async () => tile(vintage.name).click());
  expect(onStartFrom).not.toHaveBeenCalled();
  await act(async () => tile(kaleyard.name).click());
  expect(onStartFrom).toHaveBeenCalledWith(kaleyard.id);
});

it("asks before starting again over wool of your own", async () => {
  const { host, onStartFrom, tile } = await show({ D: { name: "Poppy", hex: "#c8323a" } });
  expect(host.querySelector(".your-colourway")?.textContent).toContain(`Started from ${vintage.name}, with 1 yarn of your own`);
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
