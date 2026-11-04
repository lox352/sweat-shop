import { afterEach, describe, expect, it, vi } from "vitest";

/** The modes as the module reads them on loading, with this address and this remembered. */
const load = async (search: string, saved?: object) => {
  vi.resetModules();
  window.history.replaceState(null, "", `/sweat-shop/${search}`);
  localStorage.clear();
  if (saved) localStorage.setItem("sweat-shop-scroll-modes", JSON.stringify(saved));
  return import("./scroll-modes");
};

describe("the ways the chart scrolls, to compare", () => {
  afterEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("is as #81 left it unless told otherwise", async () => {
    const { scrollModes } = await load("");
    expect({ ...scrollModes }).toEqual({ glide: "absorb", scroll: "pivot", keep: "moving" });
  });

  it("takes the address over what was remembered, and what was remembered over the defaults", async () => {
    const { scrollModes } = await load("#/project/1/chart?knitting=1&glide=hold", { glide: "universal", keep: "off" });
    expect({ ...scrollModes }).toEqual({ glide: "hold", scroll: "pivot", keep: "off" });
  });

  it("leaves alone what it doesn't know", async () => {
    const { scrollModes } = await load("?glide=sideways&scroll=universal", { keep: "sometimes" });
    expect({ ...scrollModes }).toEqual({ glide: "absorb", scroll: "universal", keep: "moving" });
  });

  it("remembers a change and tells whatever listens", async () => {
    const { scrollModes, setScrollMode, onScrollModes } = await load("");
    const told = vi.fn();
    onScrollModes(told);
    setScrollMode("glide", "ahead");
    expect(scrollModes.glide).toBe("ahead");
    expect(told).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem("sweat-shop-scroll-modes")!).glide).toBe("ahead");
  });
});
