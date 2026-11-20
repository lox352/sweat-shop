import { afterEach, describe, expect, it, vi } from "vitest";
import { safariTab } from "./keeping";

/** A browser as it says of itself: whether its page stands alone, what it is, and how many fingers its screen takes. */
const browser = (standalone: boolean | undefined, userAgent: string, maxTouchPoints = 0) =>
  vi.stubGlobal("navigator", { standalone, userAgent, maxTouchPoints });

const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const oldIpad = "Mozilla/5.0 (iPad; CPU OS 12_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1";
const chrome = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

afterEach(() => vi.unstubAllGlobals());

describe("where Safari's week applies", () => {
  it("is a page in Safari, by the device it is on: a Mac is not a phone, and an iPad that says it is a Mac is told by its touch screen", () => {
    browser(false, iphone, 5);
    expect(safariTab()).toBe("iphone");
    browser(false, mac);
    expect(safariTab()).toBe("mac");
    browser(false, mac, 5);
    expect(safariTab()).toBe("ipad");
    browser(false, oldIpad, 5);
    expect(safariTab()).toBe("ipad");
  });

  it("is not the site as an app of its own, on a Home Screen or in a Dock", () => {
    browser(true, iphone, 5);
    expect(safariTab()).toBeUndefined();
    browser(true, mac);
    expect(safariTab()).toBeUndefined();
  });

  it("is no other browser: only Apple's say whether a page stands alone", () => {
    browser(undefined, chrome);
    expect(safariTab()).toBeUndefined();
  });
});
