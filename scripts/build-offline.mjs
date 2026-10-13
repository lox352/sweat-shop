import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const path = join(dir, entry.name);
  return entry.isDirectory() ? files(path) : [path];
});
// Live settlement is an online developer diagnostic, never part of knitting.
// Do not download its large physics engine just to prepare a phone for offline use.
const assets = files("dist").filter(path => !path.endsWith("/sw.js") &&
  !/\/ChainModel-[^/]+\.js$/.test(path)).sort();
const hash = createHash("sha256");
for (const path of assets) hash.update(path).update(readFileSync(path));
const template = readFileSync("scripts/service-worker.js", "utf8");
hash.update(template);
writeFileSync("dist/sw.js", template
  .replace("__VERSION__", JSON.stringify(hash.digest("hex").slice(0, 16)))
  .replace("__ASSETS__", JSON.stringify(assets.map(path => path.slice(5)))));
console.log(`Offline cache includes ${assets.length} application files.`);
