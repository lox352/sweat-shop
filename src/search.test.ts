import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * The site is for its owner's own knitting and keeps out of search engines:
 * every page it serves asks not to be indexed or followed. Its robots.txt
 * says so too, but a crawler reads robots.txt only at the root of a host,
 * and the site lives in a folder of lox352.github.io - so it is the pages'
 * own word that keeps them out of search results, and these hold them to it.
 */
describe("the site's pages", () => {
  it.each(["index.html", "public/404.html"])("%s asks search engines to leave it out", (path) => {
    expect(readFileSync(path, "utf8")).toMatch(/<meta name="robots" content="noindex, nofollow" \/>/);
  });
});
