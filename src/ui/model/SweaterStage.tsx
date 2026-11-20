import { useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { isFabric } from "../../pattern/Stitch";
import type { SweaterStitches } from "../../pattern/knitted";
import { Palette, rgbOf, yarnFor } from "../../reading/palette";
import { pose } from "../../physics/pose";
import { allPositions, settledLength } from "../../library/settled/format";
import { extremesOf } from "./framing";
import FrameModel, { OrbitLike } from "./FrameModel";
import StitchInstances from "./StitchInstances";

export interface SweaterStageProps {
  /** The knitting to draw: whose it is, and where it came from, is no business of the stage's. */
  knitting: SweaterStitches;
  palette: Palette;
  /** Id of the last stitch worked; earlier stitches are shown in their wool. */
  progress: number;
  reducedMotion: boolean;
  /** Where its fabric came to rest, when that is known: see library/settled. */
  settled?: Float32Array;
  /** Where it is laid out, where whoever shows it has laid it out already: see physics/pose. */
  posed?: Float32Array;
  /** What the camera is placed for, where that is more than this sweater: several, drawn to one scale. */
  frame?: [number, number, number][];
  /** How big it is drawn, for one drawn beside others whose stitches are another size: see SweaterComparison. What it is framed for (`frame`) is already at this scale. */
  scale?: number;
  /** What it is turned, moved and zoomed from, where that is not its own canvas: one surface over several stages, each doing the same with what happens on it. See SweaterComparison. */
  surface?: HTMLElement;
}

export default function SweaterStage({ knitting: built, palette, progress, reducedMotion, settled, posed, frame, scale = 1, surface }: SweaterStageProps) {
  const controls = useRef<OrbitLike | null>(null);
  // Settled positions only fit the knitting if it is still the shape that was settled.
  const positions = useMemo(
    () =>
      settled && settled.length === settledLength(built.stitches)
        ? allPositions(built.stitches, settled)
        : (posed ?? pose(built.knitting).positions),
    [built, settled, posed],
  );
  // In the order StitchInstances draws them, which the colours have to match.
  const drawn = useMemo(() => built.stitches.filter(isFabric), [built]);
  const extremes = useMemo(
    () => extremesOf(positions, drawn.map((stitch) => stitch.id)),
    [positions, drawn],
  );

  const colours = useMemo(() => {
    const out = new Float32Array(drawn.length * 3);
    drawn.forEach((stitch, index) => {
      const [r, g, b] = rgbOf(yarnFor(palette, stitch.slot).hex);
      out.set([r / 255, g / 255, b / 255], index * 3);
    });
    return out;
  }, [drawn, palette]);

  const worked = useMemo(
    () => new Float32Array(drawn.map((stitch) => (stitch.id <= progress ? 1 : 0))),
    [drawn, progress],
  );

  return (
    /*
     * Drawn on demand rather than sixty times a second: nothing here moves on
     * its own, so a frame is only worth drawing when someone turns it, when
     * the wool changes, or while a newly worked stitch fades in.
     */
    <Canvas
      frameloop="demand"
      camera={{ fov: 34, near: 0.5, far: 6000 }}
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 2]}
    >
      {/* Framed for the shape it is drawn in: once laid out, and once more when it comes to rest. */}
      <FrameModel subject={positions} extremes={frame ?? extremes} controls={controls} />
      <OrbitControls
        ref={controls as never}
        enableDamping={!reducedMotion}
        dampingFactor={0.08}
        rotateSpeed={0.65}
        zoomSpeed={0.7}
        domElement={surface}
        makeDefault
      />
      <group scale={scale}>
        <StitchInstances
          stitches={built.stitches}
          rounds={built.knitting.rounds}
          positions={positions}
          roundHeight={built.roundHeight}
          colours={colours}
          worked={worked}
          reducedMotion={reducedMotion}
        />
      </group>
    </Canvas>
  );
}
