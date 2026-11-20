import type { Measurements } from "../../pattern/design";

/** What a sweater measures, a row each: round it first, then down it. */
export const measured: { key: keyof Measurements; label: string }[] = [
  { key: "chestCm", label: "Chest" },
  { key: "upperArmCm", label: "Upper arm" },
  { key: "neckCm", label: "Neck" },
  { key: "cuffCm", label: "Cuff" },
  { key: "yokeDepthCm", label: "Yoke depth" },
  { key: "bodyLengthCm", label: "Body length" },
  { key: "sleeveLengthCm", label: "Sleeve length" },
];
