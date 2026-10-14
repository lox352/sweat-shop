import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Stitch } from "../types/Stitch";
import { adjacentStitchDistance } from "../constants";
import { neighboursOf } from "./neighbours";
import { createStitchGeometry, createStitchMaterial } from "./stitch-quad";

interface StitchInstancesProps {
  stitches: Stitch[];
  rounds: number[][];
  /** Where every stitch is: three numbers a stitch, by id. */
  positions: Float32Array;
  /** How tall a round is, for a stitch with nothing to measure its height by. */
  roundHeight: number;
  /** Target colours, three floats per drawn stitch, in the order drawn. */
  colours: Float32Array | null;
  /** 1 where a stitch has been worked, 0 where it has not. */
  worked: Float32Array | null;
  reducedMotion: boolean;
}

/** Wool not yet knitted: the pale ghost of the pattern ahead of you. */
const unworked = new THREE.Color("#d8d2cb");

/*
 * Scratch objects, reused for every stitch. With a hundred thousand of them,
 * allocating per stitch is what makes a loop like this crawl.
 */
const position = new THREE.Vector3();
const from = new THREE.Vector3();
const to = new THREE.Vector3();
const across = new THREE.Vector3();
const up = new THREE.Vector3();
const normal = new THREE.Vector3();
const basis = new THREE.Matrix4();
const quaternion = new THREE.Quaternion();
const size = new THREE.Vector3();
const matrix = new THREE.Matrix4();
const colour = new THREE.Color();

/** How fast a stitch fades in once it has been worked, per second. */
const fadeRate = 3.5;

/** How many stitches to place in one frame. See placedUpTo. */
const placeChunk = 20000;

/**
 * Draws every stitch as one instanced mesh: one draw call, two triangles a
 * stitch. See stitch-quad.ts for what each looks like.
 *
 * Each stitch is turned square to the fabric around it from its own
 * neighbours - across to the stitch before it, up from the stitch below -
 * and sized to them, so that it fills the space between them whether the
 * fabric there is eased out or bunched up. See neighbours.ts for the
 * stitches that lack one or the other.
 *
 * Worked stitches ease into their wool rather than snapping, so ticking off a
 * run of stitches reads as colour spreading round the sweater.
 */
const StitchInstances: React.FC<StitchInstancesProps> = ({
  stitches,
  rounds,
  positions,
  roundHeight,
  colours,
  worked,
  reducedMotion,
}) => {
  const invalidate = useThree((state) => state.invalidate);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => createStitchGeometry(), []);
  const material = useMemo(() => createStitchMaterial(), []);
  const eased = useRef<Float32Array>();
  /**
   * How many stitches have been put where they belong.
   *
   * Placing a hundred thousand of them is a good part of a second of vector
   * arithmetic, which as one frame is a visible lock-up, so it is done some
   * thousands at a time and the mesh only draws as many as are ready. The
   * sweater arrives over a few frames, from the neck down, instead of the
   * page stopping dead for one.
   */
  const placedUpTo = useRef(0);
  /** Every stitch has reached its colour, so there is nothing left to ease. */
  const faded = useRef(false);
  /** The wool changed; every stitch needs its colour written again. */
  const repaint = useRef(true);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  const { drawn, pairs } = useMemo(() => neighboursOf(stitches, rounds), [stitches, rounds]);

  /*
   * Which stitches are purls, for the shader. An attribute of the geometry,
   * one value a stitch, because the instances share it.
   */
  useEffect(() => {
    const purls = new Float32Array(drawn.length);
    drawn.forEach((stitch, index) => (purls[index] = stitch.type === "p1" ? 1 : 0));
    geometry.setAttribute("purl", new THREE.InstancedBufferAttribute(purls, 1));
    invalidate();
  }, [drawn, geometry, invalidate]);

  /*
   * A different sweater, or the same one somewhere else, has to be placed
   * again. The stage only draws when it is asked to, so it asks.
   */
  useEffect(() => {
    placedUpTo.current = 0;
    invalidate();
  }, [drawn, positions, invalidate]);

  /*
   * A stitch newly worked fades into its wool, so that needs frames to do it
   * in; a change of colourway is not something that happened to the knitting
   * and simply arrives, at whatever the stitches have already faded to.
   */
  useEffect(() => {
    faded.current = false;
    invalidate();
  }, [worked, invalidate]);

  useEffect(() => {
    repaint.current = true;
    invalidate();
  }, [colours, invalidate]);

  const read = (id: number, into: THREE.Vector3) =>
    into.set(positions[id * 3], positions[id * 3 + 1], positions[id * 3 + 2]);

  /** The vector from the second of a pair to the first, or false if there is no pair. */
  const between = (at: number, into: THREE.Vector3): boolean => {
    const [a, b] = [pairs[at], pairs[at + 1]];
    if (a < 0 || b < 0) return false;
    read(a, from);
    read(b, to);
    into.subVectors(from, to);
    return into.lengthSq() > 1e-8;
  };

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    if (!eased.current || eased.current.length !== drawn.length) {
      eased.current = new Float32Array(drawn.length);
      // A sweater opened with progress already on it starts there, rather
      // than fading in everything that was knitted weeks ago.
      if (worked) eased.current.set(worked);
    }

    /*
     * The stitches never move once placed, so where they are is worked out
     * once, a chunk a frame, and after that only colours change.
     */
    const placing = placedUpTo.current < drawn.length;
    const colouring = colours !== null && worked !== null && (!faded.current || repaint.current);
    if (!placing && !colouring) return;

    let settling = false;
    const paint = (index: number) => {
      if (!colours || !worked) {
        mesh.setColorAt(index, unworked);
        return;
      }
      const wanted = worked[index];
      const current = eased.current![index];
      const next = reducedMotion
        ? wanted
        : current + (wanted - current) * Math.min(delta * fadeRate, 1);
      if (Math.abs(next - wanted) > 0.002) settling = true;
      eased.current![index] = next;
      colour
        .setRGB(colours[index * 3], colours[index * 3 + 1], colours[index * 3 + 2], THREE.SRGBColorSpace)
        .lerpColors(unworked, colour, next);
      mesh.setColorAt(index, colour);
    };

    if (placing) {
      const end = Math.min(drawn.length, placedUpTo.current + placeChunk);
      for (let index = placedUpTo.current; index < end; index++) {
        const stitch = drawn[index];
        read(stitch.id, position);
        const width = stitch.width ?? adjacentStitchDistance;
        const height = stitch.rise ?? roundHeight;
        const hasAcross = between(index * 4, across);
        const hasUp = between(index * 4 + 2, up);
        // Each is sized to its neighbours, within reason.
        size.set(
          hasAcross ? THREE.MathUtils.clamp(across.length(), width * 0.4, width * 2.5) : width,
          hasUp ? THREE.MathUtils.clamp(up.length(), height * 0.4, height * 2.5) : height,
          1,
        );
        if (!hasAcross) across.set(1, 0, 0);
        if (!hasUp) up.set(0, -1, 0);
        across.normalize();
        up.normalize();
        /*
         * Across towards the stitch before, up the way the knitting grew:
         * crossed, that faces out of the sweater, everywhere. A round runs
         * left to right seen from outside, and the knitting grows down from
         * the neck - see physics/pose.ts - so at the front, across points to
         * the wearer's right and up points down, and their cross points
         * forward.
         */
        normal.crossVectors(across, up);
        if (normal.lengthSq() < 1e-8) normal.set(0, 0, 1);
        normal.normalize();
        // Square the basis: up need not be quite perpendicular to across.
        up.crossVectors(normal, across).normalize();
        basis.makeBasis(across, up, normal);
        quaternion.setFromRotationMatrix(basis);
        matrix.compose(position, quaternion, size);
        mesh.setMatrixAt(index, matrix);
        paint(index);
      }
      mesh.instanceMatrix.needsUpdate = true;
      placedUpTo.current = end;
      // Draw only what is ready, so the unplaced ones are not all piled at the
      // origin while they wait their turn.
      mesh.count = end;
      if (end < drawn.length) invalidate();
    } else {
      for (let index = 0; index < drawn.length; index++) paint(index);
    }

    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (!placing) {
      faded.current = !settling;
      repaint.current = false;
    }
    // Still easing, so there is another frame's worth of work to do.
    if (settling) invalidate();
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, drawn.length]}
      frustumCulled={false}
    />
  );
};

export default StitchInstances;
