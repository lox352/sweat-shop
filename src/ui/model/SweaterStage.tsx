import React, { useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import type * as THREE from "three";
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
  /** The stages it turns with: see TurnedTogether. */
  together?: TurnedTogether;
}

/** Stages that turn as one: the one being turned tells the others where it is looked at from, and they follow. */
export interface TurnedTogether {
  stages: Set<(from: object, position: THREE.Vector3, target: THREE.Vector3) => void>;
  /** The stage last taken hold of: the only one that tells the others, so that their following is never told back. */
  turning?: object;
}

type Listening = OrbitLike & {
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

/** Turns this stage with the others it is shown with, and them with it. */
const Together: React.FC<{ together: TurnedTogether; controls: React.MutableRefObject<OrbitLike | null> }> = ({ together, controls }) => {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const self = {};
    const follow = (from: object, position: THREE.Vector3, target: THREE.Vector3) => {
      const orbit = controls.current;
      if (from === self || !orbit) return;
      camera.position.copy(position);
      orbit.target.copy(target);
      orbit.update();
      invalidate();
    };
    together.stages.add(follow);
    const orbit: Listening | null = controls.current;
    const held = () => {
      together.turning = self;
    };
    // As it is turned, and as it glides to a stop after: but only the one taken hold of.
    const turned = () => {
      if (together.turning !== self || !controls.current) return;
      for (const stage of together.stages) stage(self, camera.position, controls.current.target);
    };
    orbit?.addEventListener?.("start", held);
    orbit?.addEventListener?.("change", turned);
    return () => {
      together.stages.delete(follow);
      orbit?.removeEventListener?.("start", held);
      orbit?.removeEventListener?.("change", turned);
    };
  }, [together, controls, camera, invalidate]);
  return null;
};

export default function SweaterStage({ knitting: built, palette, progress, reducedMotion, settled, posed, frame, together }: SweaterStageProps) {
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
        makeDefault
      />
      {together && <Together together={together} controls={controls} />}
      <StitchInstances
        stitches={built.stitches}
        rounds={built.knitting.rounds}
        positions={positions}
        roundHeight={built.roundHeight}
        colours={colours}
        worked={worked}
        reducedMotion={reducedMotion}
      />
    </Canvas>
  );
}
