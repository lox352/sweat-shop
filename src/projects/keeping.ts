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

/** The devices Safari's week applies on, each with its own way of making the site an app: see safariTab. */
export type SafariDevice = "iphone" | "ipad" | "mac";

/**
 * Which device this is, where it is a page in a browser of Apple's and not
 * the site opened as an app of its own: where Safari's week applies. Nothing,
 * anywhere else - only Apple's browsers say whether a page stands alone,
 * either way.
 *
 * The device decides what a knitter is told to do about it (see Home): a
 * phone and an iPad put the site on the Home Screen, from Share; a Mac puts
 * it in the Dock, from the File menu. An iPad says it is a Mac, and is told
 * from one by its touch screen.
 */
export const safariTab = (): SafariDevice | undefined => {
  if ((navigator as Navigator & { standalone?: boolean }).standalone !== false) return undefined;
  const says = navigator.userAgent;
  if (/iPhone|iPod/.test(says)) return "iphone";
  if (/iPad/.test(says) || (/Macintosh/.test(says) && navigator.maxTouchPoints > 1)) return "ipad";
  return "mac";
};
