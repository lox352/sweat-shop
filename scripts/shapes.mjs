import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";

/**
 * Shapes: where each knitting's fabric comes to rest, settled once and kept.
 *
 * A shape depends on the fabric alone - each stitch's kind, what it is linked
 * to and how wide and tall it is, and the rounds from each piece's seam (see
 * physics/topology) - and on the physics that settles it. So it is named by
 * a hash of the two, and `public/shapes/<name>.json` is the settled sweater of
 * every edition of every size with that fabric: a design recoloured is a new
 * edition of the same shape, and nothing is settled again. Not the colours,
 * then, nor the steps, which are no part of the fabric.
 *
 * `shapes.json` says which shape each edition has, once it has been settled:
 * a size's edition now, and each it has moved on from, for the projects
 * still knitting those. An edition not in it is drawn as posed until it is.
 */
export const shapesDir = "public/shapes";
export const shapesFile = "src/library/settled/shapes.json";

/**
 * Everything the settling runs on, named one by one and hashed by what each
 * holds, so that moving a file changes no shape's name. The bench's measuring
 * tape (physics/gauge) changes nothing the settling does, and nor does how
 * the fabric is told apart (physics/topology), which is hashed itself, nor
 * how a shape is named and settled on a knitter's device (physics/naming,
 * settling, settle.worker), which only call what is hashed here. The
 * words the physics is written in (pattern/) are not among them: what they
 * say of a fabric is in its topology already.
 */
export const physicsFiles = [
  "src/constants.ts",
  "src/physics/pose.ts",
  "src/physics/ropes.ts",
  "src/physics/solver.ts",
  "src/physics/tuning.ts",
  "src/physics/vector.ts",
];

export const physicsNow = () => {
  const hash = createHash("sha256");
  // Where a file imports from is no part of what it does: left out, so that moving another file changes no name either.
  for (const path of physicsFiles) hash.update(readFileSync(path, "utf8").replace(/from "[^"]*"/g, 'from ""')).update("\n");
  return hash.digest("hex");
};

/** What names the shape of a knitting, built or decoded from an edition: see above. */
export const shapeNamer = async (load) => {
  const { topologyOf } = await load("/src/physics/topology.ts");
  const physics = physicsNow();
  return (knitting) => createHash("sha256").update(physics).update(JSON.stringify(topologyOf(knitting))).digest("hex").slice(0, 12);
};

/** A name from what is named: twelve hex digits of its hash. An edition's, from its knitting (see editions.mjs). */
export const nameOf = (named) => createHash("sha256").update(named).digest("hex").slice(0, 12);

export const shapePath = (name) => `${shapesDir}/${name}.json`;
export const editionKey = (design, size, edition) => `${design}--${size}--${edition}`;

export const readShapes = () => (existsSync(shapesFile) ? JSON.parse(readFileSync(shapesFile, "utf8")) : {});
export const writeShapes = (shapes) =>
  writeFileSync(shapesFile, `${JSON.stringify(Object.fromEntries(Object.keys(shapes).sort().map((key) => [key, shapes[key]])), null, 1)}\n`);

/** Shapes no edition has: left by a change to the physics, once every size is settled again. Returns those removed. */
export const pruneShapes = (shapes) => {
  if (!existsSync(shapesDir)) return [];
  const kept = new Set(Object.values(shapes));
  const gone = readdirSync(shapesDir).filter((file) => file.endsWith(".json") && !kept.has(file.replace(/\.json$/, "")));
  for (const file of gone) rmSync(`${shapesDir}/${file}`);
  return gone;
};
