/**
 * The ways the chart has scrolled, kept side by side to compare on a phone,
 * and a panel to change between them as it scrolls: `debug` in the address
 * shows it. Each is also set from the address - `glide=`, `scroll=`, `keep=`
 * - and the panel's choices are remembered on the device.
 *
 * - How the box glides to the stitch being worked as the knitting goes on:
 *   - `hold`, as it was before any of this (#78): the stitch held still on
 *     the tiles however far out of sight, the box sent to where it was drawn
 *     as it set off. Going on to the next round from part way along one, the
 *     columns opening between the box and the stitch pushed everything in
 *     the box 448 pixels in a frame.
 *   - `ahead` (#80): held still only each way it is in the box, and the box
 *     sent to where it will be, worked out ahead, the sheet kept its size.
 *   - `absorb` (#81): as `ahead`, and what is held taken into the scroll each
 *     frame of the glide, so that the view depends on the scroll and the
 *     lines alone as the box glides.
 *   - `universal`: carried about the chart opened out, the point the stitch
 *     goes to the pivot until the stitch is in the box, and then the stitch.
 * - How a scroll by hand puts the box on the chart:
 *   - `pivot`: about a pivot measured along the lines as they were (along).
 *   - `universal`: a place on the chart opened out, the part of the way along
 *     the room the scroll is: stands still over what is closed up, and goes
 *     back against the finger now and then.
 * - Whether the tiles near the box are kept ready for Safari (#78):
 *   `moving`, as the box moves; `always`; `off`, as before #78.
 */

export type GlideMode = "hold" | "ahead" | "absorb" | "universal";
export type ScrollMode = "pivot" | "universal";
export type KeepMode = "moving" | "always" | "off";

interface Modes {
  glide: GlideMode;
  scroll: ScrollMode;
  keep: KeepMode;
}

const choices: { [K in keyof Modes]: { value: Modes[K]; label: string }[] } = {
  glide: [
    { value: "hold", label: "Before (#78): hold the stitch" },
    { value: "ahead", label: "#80: aim ahead" },
    { value: "absorb", label: "#81: aim ahead, absorb" },
    { value: "universal", label: "Universal glide" },
  ],
  scroll: [
    { value: "pivot", label: "Pivot (as ever)" },
    { value: "universal", label: "Universal" },
  ],
  keep: [
    { value: "moving", label: "Kept ready while moving" },
    { value: "always", label: "Kept ready always" },
    { value: "off", label: "Not kept (before #78)" },
  ],
};

const defaults: Modes = { glide: "absorb", scroll: "pivot", keep: "moving" };
const stored = "sweat-shop-scroll-modes";

const address = () => (typeof window === "undefined" ? "" : window.location.href);

/** What is set: the address over what the panel last chose over the defaults. */
const initial = (): Modes => {
  let saved: Partial<Modes> = {};
  try {
    saved = JSON.parse(window.localStorage.getItem(stored) ?? "{}") as Partial<Modes>;
  } catch {
    // Storage may be blocked or empty: the defaults then.
  }
  const modes = { ...defaults };
  for (const key of Object.keys(choices) as (keyof Modes)[]) {
    const allowed = choices[key].map((c) => c.value as string);
    const fromAddress = new RegExp(`[?&]${key}=(\\w+)`).exec(address())?.[1];
    const value = fromAddress && allowed.includes(fromAddress) ? fromAddress : saved[key] && allowed.includes(saved[key] as string) ? saved[key] : undefined;
    if (value) (modes as Record<string, string>)[key] = value;
  }
  return modes;
};

const modes: Modes = typeof window === "undefined" ? { ...defaults } : initial();
const listeners = new Set<() => void>();

/** The ways set now. */
export const scrollModes: Readonly<Modes> = modes;

/** Set one, as the panel does: remembered on the device, and told to whatever listens. */
export const setScrollMode = <K extends keyof Modes>(key: K, value: Modes[K]) => {
  modes[key] = value;
  try {
    window.localStorage.setItem(stored, JSON.stringify(modes));
  } catch {
    // Not remembered, then: still set for now.
  }
  for (const listener of listeners) listener();
};

/** Told whenever one is changed. */
export const onScrollModes = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

let panel: HTMLElement | undefined;

/**
 * The panel, once, if `debug` is in the address: a choice for each, over
 * the page's top right, out of the way of the chart's own top left corner
 * where the hud is.
 */
export const showScrollPanel = () => {
  if (panel || typeof document === "undefined" || !/[?&]debug\b/.test(address())) return;
  panel = document.createElement("div");
  panel.style.cssText =
    "position:fixed;right:4px;top:calc(env(safe-area-inset-top,0px) + 4px);z-index:2147483647;" +
    "font:12px/1.3 system-ui,sans-serif;color:#fff;background:rgba(0,0,0,.8);padding:6px 8px;border-radius:6px;display:grid;gap:4px;max-width:60vw";
  const title = document.createElement("div");
  title.textContent = "Scrolling";
  title.style.fontWeight = "600";
  panel.appendChild(title);
  const names: { [K in keyof Modes]: string } = { glide: "Following", scroll: "By hand", keep: "Tiles" };
  for (const key of Object.keys(choices) as (keyof Modes)[]) {
    const row = document.createElement("label");
    row.style.cssText = "display:grid;gap:2px";
    const name = document.createElement("span");
    name.textContent = names[key];
    name.style.opacity = "0.75";
    const select = document.createElement("select");
    select.id = `scroll-mode-${key}`;
    select.style.cssText = "font:inherit;max-width:100%";
    for (const choice of choices[key]) {
      const option = document.createElement("option");
      option.value = choice.value;
      option.textContent = choice.label;
      select.appendChild(option);
    }
    select.value = modes[key];
    select.addEventListener("change", () => setScrollMode(key, select.value as Modes[typeof key]));
    row.append(name, select);
    panel.appendChild(row);
  }
  document.body.appendChild(panel);
};
