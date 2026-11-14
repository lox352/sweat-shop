import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import PreviewBoundary from "./PreviewBoundary";

it("isolates a failed renderer without losing sibling instructions", async () => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const host = document.createElement("div");
  const root = createRoot(host);
  function Broken(): never { throw new Error("WebGL unavailable"); }
  try {
    await act(async () => root.render(<><p>Knitting instructions</p><PreviewBoundary><Broken /></PreviewBoundary></>));
    expect(host.textContent).toContain("Knitting instructions");
    expect(host.textContent).toContain("3D preview is unavailable");
    expect(host.querySelector("button")?.textContent).toBe("Retry preview");
  } finally {
    await act(async () => root.unmount());
    spy.mockRestore();
  }
});
