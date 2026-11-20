/**
 * Asking the browser to keep what the site stores.
 *
 * A project is kept in the browser and nowhere else, and a browser may clear
 * what a site keeps: when the device runs short of room, and - Safari - once
 * a week of its use has gone by without the site being opened. A browser
 * asked to keep it marks the site's storage as not to be cleared for room,
 * and says whether it will: most decide by how much the site is used, and by
 * whether it is on the Home Screen, where it is an app of its own that
 * Safari's week does not apply to (see the manifest, in public).
 *
 * Asked when a jumper is on screen, which is when there is something to
 * keep, and once a visit. What the browser answers changes nothing here: a
 * jumper's address is how it is made again where it was not kept (see
 * link.ts).
 */
let asked = false;

export const askToKeep = () => {
  if (asked) return;
  asked = true;
  try {
    void navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    // A browser that can't be asked keeps what it keeps.
  }
};

/**
 * Whether this is a page in Safari on an iPhone or iPad, and not the site
 * opened from the Home Screen: where Safari's week applies, and adding it to
 * the Home Screen is the way out of it. Only Apple's browsers say, either way.
 */
export const inSafariTab = (): boolean => (navigator as Navigator & { standalone?: boolean }).standalone === false;
