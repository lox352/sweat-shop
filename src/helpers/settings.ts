import { useSyncExternalStore } from "react";

/**
 * Preferences that apply across every project, kept in this browser.
 *
 * Deliberately few. Anything here is something most knitters will never want,
 * which is exactly why it is tucked away rather than sitting beside the chart.
 */
export interface Settings {
  /** Draw the chart in white with each yarn numbered, instead of in colour. */
  highContrast: boolean;
  /** Offer the chart as written instructions, a round at a time. */
  writtenRounds: boolean;
  /** Don't time the knitting, and don't show how long hats have taken or have left. */
  noStatistics: boolean;
}

const defaults: Settings = { highContrast: false, writtenRounds: false, noStatistics: false };
const key = "settings";
const changed = "settingsChanged";

let cached: Settings | undefined;

export const readSettings = (): Settings => {
  if (cached) return cached;
  let stored: Partial<Settings> = {};
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "{}");
    if (parsed && typeof parsed === "object") stored = parsed;
  } catch {
    // Unreadable or unavailable storage: fall back to the defaults.
  }
  cached = Object.fromEntries(
    Object.entries(defaults).map(([name, fallback]) => [
      name,
      typeof stored[name as keyof Settings] === typeof fallback
        ? stored[name as keyof Settings]
        : fallback,
    ]),
  ) as unknown as Settings;
  return cached;
};

export const updateSettings = (change: Partial<Settings>) => {
  cached = { ...readSettings(), ...change };
  try {
    localStorage.setItem(key, JSON.stringify(cached));
  } catch {
    // Still applies for this visit; it just will not be remembered.
  }
  window.dispatchEvent(new Event(changed));
};

const subscribe = (notify: () => void) => {
  const fromOtherTab = (event: StorageEvent) => {
    if (event.key === key || event.key === null) {
      cached = undefined;
      notify();
    }
  };
  window.addEventListener(changed, notify);
  window.addEventListener("storage", fromOtherTab);
  return () => {
    window.removeEventListener(changed, notify);
    window.removeEventListener("storage", fromOtherTab);
  };
};

export const useSettings = (): Settings =>
  useSyncExternalStore(subscribe, readSettings, () => defaults);
