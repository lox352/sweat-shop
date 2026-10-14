import { useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { isFabric } from "../types/Stitch";
import { sweaterById } from "../data/sweaters";
import { sweaterStitches } from "../knitting/useSweater";
import { Palette, rgbOf, yarnFor } from "../knitting/palette";
import { pose } from "../physics/pose";
import { extremesOf } from "./framing";
import FrameModel, { OrbitLike } from "./FrameModel";
import StitchInstances from "./StitchInstances";

export interface SweaterStageProps {
  sweaterId: string;
  sizeId: string;
  palette: Palette;
  /** Id of the last stitch worked; earlier stitches are shown in their wool. */
  progress: number;
  reducedMotion: boolean;
}

/**
 * The sweater in three dimensions: three.js, and nothing else.
 *
 * Loaded on demand, behind its own boundary, so nothing of it is fetched by a
 * page that never shows it, and a phone without WebGL still has every
 * instruction on the page.
 *
 * It draws the sweater blocked, as physics/pose.ts lays it out. Settling it
 * under gravity is done offline and committed, as the hat site does it, and
 * nothing here will ever import the physics that does it.
 */
export default function SweaterStage({ sweaterId, sizeId, palette, progress, reducedMotion }: SweaterStageProps) {
  const controls = useRef<OrbitLike | null>(null);
  const built = useMemo(() => sweaterStitches(sweaterById(sweaterId)!, sizeId), [sweaterId, sizeId]);
  const { positions } = useMemo(() => pose(built), [built]);
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
      <FrameModel extremes={extremes} controls={controls} />
      <OrbitControls
        ref={controls as never}
        enableDamping={!reducedMotion}
        dampingFactor={0.08}
        rotateSpeed={0.65}
        zoomSpeed={0.7}
        makeDefault
      />
      <StitchInstances
        stitches={built.stitches}
        rounds={built.rounds}
        positions={positions}
        roundHeight={built.roundHeight}
        colours={colours}
        worked={worked}
        reducedMotion={reducedMotion}
      />
    </Canvas>
  );
}
