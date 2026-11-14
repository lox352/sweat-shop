import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { keepSettled, keptSettledPath, noteSettled, settledForPath } from "./keep";

const repo = () => {
  const root = mkdtempSync(join(tmpdir(), "settled-"));
  mkdirSync(join(root, "src/data/sweaters/settled"), { recursive: true });
  mkdirSync(join(root, "scripts"), { recursive: true });
  return root;
};
const settled = (root: string) => join(root, "src/data/sweaters/settled/jumper--m.json");

describe("a size's settled sweater", () => {
  it("is kept under the edition it was settled for before it is settled as another", () => {
    const root = repo();
    writeFileSync(settled(root), "the first settling");
    // Nothing says which edition it is for yet: there is nothing to keep it as.
    expect(keepSettled("jumper", "m", "aaaa", root)).toBeUndefined();
    noteSettled("jumper", "m", "aaaa", root);
    // Settled again as the same edition - the physics changed, say - it is simply written over.
    expect(keepSettled("jumper", "m", "aaaa", root)).toBeUndefined();
    expect(existsSync(join(root, "public"))).toBe(false);

    const kept = keepSettled("jumper", "m", "bbbb", root);
    expect(kept).toBe(join(root, keptSettledPath("jumper", "m", "aaaa")));
    expect(readFileSync(kept!, "utf8")).toBe("the first settling");
    writeFileSync(settled(root), "the second settling");
    noteSettled("jumper", "m", "bbbb", root);
    expect(JSON.parse(readFileSync(join(root, settledForPath), "utf8"))).toEqual({ "jumper--m": "bbbb" });

    // And again: each edition's is kept, and one already kept is never written over.
    keepSettled("jumper", "m", "cccc", root);
    writeFileSync(settled(root), "a third, before its edition was noted");
    keepSettled("jumper", "m", "cccc", root);
    expect(readdirSync(join(root, "public/editions")).sort()).toEqual(["jumper--m--aaaa.settled.json", "jumper--m--bbbb.settled.json"]);
    expect(readFileSync(join(root, keptSettledPath("jumper", "m", "bbbb")), "utf8")).toBe("the second settling");
  });

  it("with no settled file has nothing to keep", () => {
    const root = repo();
    noteSettled("jumper", "m", "aaaa", root);
    expect(keepSettled("jumper", "m", "bbbb", root)).toBeUndefined();
  });
});

describe("the record of which edition each settled file is for", () => {
  it("names an edition the site has a frozen copy of, for every settled size", () => {
    const record = JSON.parse(readFileSync(settledForPath, "utf8")) as Record<string, string>;
    const settledSizes = readdirSync("src/data/sweaters/settled").filter((name) => name.endsWith(".json")).map((name) => name.replace(/\.json$/, ""));
    expect(Object.keys(record).sort()).toEqual(settledSizes.sort());
    for (const [key, edition] of Object.entries(record)) expect(existsSync(`public/editions/${key}--${edition}.json`), key).toBe(true);
  });
});
