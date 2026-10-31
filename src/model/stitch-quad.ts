import * as THREE from "three";

/**
 * One stitch, drawn: a single flat quad with the stitch painted on it.
 *
 * The hat site built each stitch as a little tube, sixty-four triangles of
 * it, which a hat's ten thousand stitches can afford and a sweater's hundred
 * thousand cannot - that is eight million triangles for the largest size,
 * and no phone draws those. Two triangles a stitch is a quarter of a million.
 *
 * What makes a quad read as knitting is its outline. Each is a chevron, its
 * point dipping towards the stitch it was worked into, so that the stitches
 * of a column nest one into the next exactly as a knitted V sits in the V
 * below it - and exactly is the point: a chevron's lower edge is the upper
 * edge of the one below it, so neighbouring stitches meet edge to edge, with
 * none of the flicker of two quads fighting over the same pixels. The quad
 * itself is a little taller than its stitch, to hold the point, and the
 * fragment shader throws away what lies outside the chevron.
 *
 * Inside it, the two legs of the V are shaded light along their middles and
 * dark at the gap between them and at the stitch's edges. The inside of the
 * sweater, seen through the neck or a cuff, is the same drawn darker, and so
 * is a purl, which is a knit seen from behind: a rib's purls sink between its
 * knits, and the rib reads as ribbed.
 *
 * In the quad's own space x runs across the stitch and y the way the
 * knitting grew, from the stitch below to the one above, both a stitch long;
 * StitchInstances scales each to its own stitch.
 */

/** How far the point of a stitch's V dips into the stitch below, in stitches. */
export const chevronDepth = 0.35;

/**
 * How much bigger than its stitch each is drawn, as a share of it. Stitches
 * are each turned to their own neighbours, so where the fabric curves, or
 * one round is closer to the next than the last, two chevrons meant to meet
 * can leave a hairline between them, and the background shows through it as
 * a glint. A sliver of overlap closes it, and is never seen to flicker:
 * both stitches are at their darkest there.
 */
export const overlap = 0.14;

/** How much darker a stitch seen from behind is drawn: the sweater's inside, and a purl. */
export const insideShade = 0.45;

export const createStitchGeometry = (): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry();
  // u across the stitch, v up it: 0 to 1 over the stitch itself, below 0 for the point.
  const [left, right] = [-overlap / 2, 1 + overlap / 2];
  const [bottom, top] = [-chevronDepth - overlap / 2, 1 + overlap / 2];
  const uvs = [left, bottom, right, bottom, right, top, left, top];
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [0, 1, 2, 3].flatMap((corner) => [uvs[corner * 2] - 0.5, uvs[corner * 2 + 1] - 0.5, 0]),
      3,
    ),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
};

const vertexHead = /* glsl */ `
attribute float purl;
varying float vPurl;
`;

const fragmentHead = /* glsl */ `
varying float vPurl;
`;

const fragmentBody = /* glsl */ `
{
  // Where in the chevron: s from its lower edge to its upper, w from the
  // middle of the stitch out to its sides. Each quad is drawn a little
  // larger than its stitch - see overlap - so the edges are allowed as far.
  float lower = ${(2 * chevronDepth).toFixed(4)} * abs(vUv.x - 0.5) - ${chevronDepth.toFixed(4)};
  float s = vUv.y - lower;
  if (s < ${(-overlap / 2).toFixed(4)} || s > ${(1 + overlap / 2).toFixed(4)}) discard;
  s = clamp(s, 0.0, 1.0);
  float w = clamp(abs(vUv.x - 0.5) * 2.0, 0.0, 1.0);
  float shade = 0.42 + 0.58 * pow(sin(3.14159 * w) * sin(3.14159 * s), 0.55);
  // A stitch a pixel or two across is too small to shade: shading it only
  // shimmers. Fade to its average as it shrinks.
  vec2 footprint = fwidth(vUv);
  float detail = clamp(1.6 - 2.8 * max(footprint.x, footprint.y), 0.0, 1.0);
  shade = mix(0.72, shade, detail);
  // A purl is a knit from behind, and drawn as one: the same V, in shadow,
  // as a rib's purls sink between its knits.
  if (!gl_FrontFacing || vPurl > 0.5) shade *= ${insideShade.toFixed(2)};
  diffuseColor.rgb *= shade;
}
`;

/**
 * The material: three's plain unlit one, its colour from each instance, with
 * the stitch painted on in its fragment shader. Unlit because the colours are
 * the wool's, measured, and a light would only move them away from it.
 */
export const createStitchMaterial = (): THREE.MeshBasicMaterial => {
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
  // The quad's uv, which three only passes on to a material with a texture.
  material.defines = { ...material.defines, USE_UV: "" };
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = vertexHead + shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n  vPurl = purl;",
    );
    shader.fragmentShader = fragmentHead + shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>\n${fragmentBody}`,
    );
  };
  material.customProgramCacheKey = () => "stitch-chevron";
  return material;
};
