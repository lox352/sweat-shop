import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

/** The bit of OrbitControls this needs, without depending on drei's types. */
export interface OrbitLike {
  target: THREE.Vector3;
  update: () => void;
}

interface FrameModelProps {
  /** The stitches at the edges of the silhouette: see framing.ts. */
  extremes: [number, number, number][];
  controls: React.MutableRefObject<OrbitLike | null>;
}

const centre = new THREE.Vector3();
const projected = new THREE.Vector3();
/** From the front, a little above and to one side, so the yoke reads as a cone. */
const direction = new THREE.Vector3(-0.3, 0.28, 0.91).normalize();

/**
 * How much of the frame the silhouette should fill, measured from its middle,
 * where 1 reaches the edge.
 */
const fillFraction = 0.9;

/**
 * Places the camera once, from where the sweater's extremes are, and then
 * leaves it alone - the hat site learned that a camera that reframes itself
 * fights whoever is turning the model. Nothing moves it afterwards except the
 * person using it.
 *
 * The fit is iterated rather than calculated: the camera looks down at the
 * sweater a little, and in perspective the nearer parts are larger, so
 * aiming at the middle of the extremes does not put them in the middle of
 * the frame, and their size there depends on where it is aimed. Each pass
 * steps back or in by how far the silhouette over- or under-fills the frame,
 * and moves the aim by how far off centre it lands.
 */
const FrameModel: React.FC<FrameModelProps> = ({ extremes, controls }) => {
  const camera = useThree((state) => state.camera);
  const viewport = useThree((state) => state.size);
  const framed = useRef("");

  useEffect(() => {
    if (extremes.length === 0) return;
    const key = `${extremes.map((point) => point.map((value) => value.toFixed(1)).join(",")).join(";")}:${viewport.width}x${viewport.height}`;
    if (framed.current === key) return;
    framed.current = key;

    const perspective = camera as THREE.PerspectiveCamera;
    const points = extremes.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const box = new THREE.Box3().setFromPoints(points);
    const aim = box.getCenter(new THREE.Vector3());

    /** Aims at `aim` from `distance` away; reports how far the silhouette reaches, and where its middle lands. */
    const placeAt = (distance: number) => {
      centre.copy(aim);
      perspective.position.copy(centre).addScaledVector(direction, distance);
      perspective.lookAt(centre);
      perspective.near = Math.max(distance / 100, 0.1);
      perspective.far = distance * 8;
      perspective.updateProjectionMatrix();
      perspective.updateMatrixWorld();
      let [top, bottom, left, right] = [-Infinity, Infinity, Infinity, -Infinity];
      for (const point of points) {
        projected.copy(point).project(perspective);
        top = Math.max(top, projected.y);
        bottom = Math.min(bottom, projected.y);
        left = Math.min(left, projected.x);
        right = Math.max(right, projected.x);
      }
      return {
        reach: Math.max((top - bottom) / 2, (right - left) / 2),
        middle: [(left + right) / 2, (top + bottom) / 2] as const,
      };
    };

    const fov = (perspective.fov * Math.PI) / 180;
    const radius = box.getSize(new THREE.Vector3()).length() / 2;
    let distance = radius / Math.sin(fov / 2);
    const right = new THREE.Vector3();
    const upward = new THREE.Vector3();
    for (let pass = 0; pass < 8; pass++) {
      const { reach, middle } = placeAt(distance);
      if (reach <= 0) break;
      if (Math.abs(reach - fillFraction) < 0.01 && Math.hypot(...middle) < 0.01) break;
      // Clip space is two units across; at the aim point that is this far in the world.
      const halfHeight = distance * Math.tan(fov / 2);
      right.setFromMatrixColumn(perspective.matrixWorld, 0);
      upward.setFromMatrixColumn(perspective.matrixWorld, 1);
      aim.addScaledVector(right, middle[0] * halfHeight * perspective.aspect);
      aim.addScaledVector(upward, middle[1] * halfHeight);
      distance *= reach / fillFraction;
    }
    placeAt(distance);

    const orbit = controls.current;
    if (orbit) {
      orbit.target.copy(centre);
      orbit.update();
    }
  }, [extremes, camera, controls, viewport.width, viewport.height]);

  return null;
};

export default FrameModel;
