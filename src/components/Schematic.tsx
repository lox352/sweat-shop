import React from "react";
import { Size } from "../data/sweaters/types";
import "./Schematic.css";

/**
 * A size's finished measurements as a pattern's schematic draws them: the
 * sweater laid flat with its arms out, as it is blocked, each measurement on
 * the line it is taken along.
 *
 * Drawn to scale in centimetres, so a bigger size is a bigger sweater and
 * the proportions between sizes are the real ones - a 4XL's yoke is not just
 * a medium's made larger. Round measurements - the neck, the chest, the upper
 * arm and the cuff - are given round, as a knitter measures them, across a
 * flat width of half of them.
 */
const armAngle = (45 * Math.PI) / 180;

export const Schematic: React.FC<{ size: Size }> = ({ size }) => {
  const { finished } = size;
  const halfChest = finished.chestCm / 4;
  const neck = finished.neckCm / 3.2;
  const yoke = finished.yokeDepthCm;
  const body = finished.bodyLengthCm;
  const arm = finished.upperArmCm / 2;
  const cuff = finished.cuffCm / 2;
  const sleeve = finished.sleeveLengthCm;

  // The wearer's left, drawn on the right; the other side is its mirror.
  const down = [Math.sin(armAngle), Math.cos(armAngle)] as const;
  const out = [Math.cos(armAngle), -Math.sin(armAngle)] as const;
  const underarm = [halfChest, 0] as const;
  const shoulder = [underarm[0] + arm * out[0], underarm[1] + arm * out[1]] as const;
  const axisTop = [(underarm[0] + shoulder[0]) / 2, (underarm[1] + shoulder[1]) / 2] as const;
  const axisEnd = [axisTop[0] + sleeve * down[0], axisTop[1] + sleeve * down[1]] as const;
  const cuffOuter = [axisEnd[0] + (cuff / 2) * out[0], axisEnd[1] + (cuff / 2) * out[1]] as const;
  const cuffInner = [axisEnd[0] - (cuff / 2) * out[0], axisEnd[1] - (cuff / 2) * out[1]] as const;
  const neckEdge = [neck / 2, -yoke] as const;

  const p = (x: number, y: number) => `${x.toFixed(2)} ${y.toFixed(2)}`;
  const dip = neck * 0.22;
  // Neck, round the right shoulder and arm, down the body, and back round the left.
  const outline = [
    `M${p(...neckEdge)}`,
    `Q${p(shoulder[0] * 0.55, -yoke * 0.95)} ${p(...shoulder)}`,
    `L${p(...cuffOuter)}L${p(...cuffInner)}L${p(...underarm)}`,
    `L${p(halfChest, body)}L${p(-halfChest, body)}`,
    `L${p(-underarm[0], underarm[1])}L${p(-cuffInner[0], cuffInner[1])}`,
    `L${p(-cuffOuter[0], cuffOuter[1])}L${p(-shoulder[0], shoulder[1])}`,
    `Q${p(-shoulder[0] * 0.55, -yoke * 0.95)} ${p(-neckEdge[0], neckEdge[1])}`,
    `Q0 ${(-yoke + 2 * dip).toFixed(2)} ${p(...neckEdge)}Z`,
  ].join("");
  // The yoke's bands, as arcs round the neck, for the picture's sake.
  const bands = [0.35, 0.5, 0.62, 0.78].map((share) => {
    const y = -yoke + yoke * share;
    const reach = neck / 2 + (shoulder[0] - neck / 2) * share * 1.05;
    return `M${p(-reach, y)}Q0 ${(y + yoke * 0.12).toFixed(2)} ${p(reach, y)}`;
  });

  const left = -(cuffOuter[0] + 8);
  const right = cuffOuter[0] + 22;
  const top = -yoke - 9;
  const bottom = Math.max(body, cuffInner[1], cuffOuter[1]) + 10;
  // Its size is the stylesheet's: larger on a phone, where the drawing is smaller.
  const label = (x: number, y: number, words: string, anchor: "start" | "middle" | "end" = "middle") => (
    <text x={x} y={y} textAnchor={anchor}>
      {words}
    </text>
  );
  const dimension = (from: readonly [number, number], to: readonly [number, number]) => (
    <path className="schematic-dimension" d={`M${p(...from)}L${p(...to)}`} markerStart="url(#tick)" markerEnd="url(#tick)" />
  );
  // Clear of the left sleeve's lower edge, on the body's side of it.
  const away = [out[0] * 2.5, -out[1] * 2.5] as const;

  return (
    <figure className="schematic">
      <svg
        viewBox={`${left} ${top} ${right - left} ${bottom - top}`}
        role="img"
        aria-label={
          `Size ${size.label} laid flat: ${finished.neckCm}cm round the neck, a ${yoke}cm yoke, ` +
          `${finished.chestCm}cm round the chest, ${body}cm from underarm to hem, ` +
          `sleeves ${sleeve}cm long, ${finished.upperArmCm}cm round the upper arm and ${finished.cuffCm}cm round the cuff.`
        }
      >
        <defs>
          <marker id="tick" viewBox="-1 -1 2 2" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0 -1V1" className="schematic-tick" />
          </marker>
        </defs>
        <path className="schematic-outline" d={outline} />
        {bands.map((d) => (
          <path key={d} className="schematic-band" d={d} />
        ))}

        {label(0, -yoke - 3.2, `neck ${finished.neckCm}cm round`)}

        {dimension([0, -yoke + dip + 0.8], [0, 0])}
        {label(1.5, -yoke / 2 + dip / 2 + 1, `yoke ${yoke}cm`, "start")}

        {dimension([-halfChest + 1, 4], [halfChest - 1, 4])}
        {label(0, 9.5, `chest ${finished.chestCm}cm round`)}

        {dimension([halfChest - 3, 12], [halfChest - 3, body])}
        {label(halfChest - 4.5, (12 + body) / 2 + 1, `body ${body}cm`, "end")}

        {dimension(
          [-underarm[0] + away[0], underarm[1] + away[1]],
          [-cuffInner[0] + away[0], cuffInner[1] + away[1]],
        )}
        {label(-cuffInner[0] + 3, cuffInner[1] + 7, `sleeve ${sleeve}cm`, "start")}

        {label(shoulder[0] + 4, shoulder[1] + 1, `upper arm ${finished.upperArmCm}cm`, "start")}
        {label(cuffOuter[0] + 2, cuffOuter[1] + 6, `cuff ${finished.cuffCm}cm`, "start")}
      </svg>
      <figcaption className="quiet">Size {size.label}, laid flat, to scale.</figcaption>
    </figure>
  );
};
