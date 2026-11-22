// Screen position and visibility of a projected point. Pure.
export interface ScreenPoint {
  x: number;
  y: number;
  visible: boolean;
}

/**
 * ndc is the point after the camera projection. viewZ is its z in camera space,
 * where the camera looks down -z, so a point behind the camera has viewZ of zero or more.
 * A point is visible only in front of the camera, inside the depth range and inside the frame.
 */
export function toScreen(ndc: { x: number; y: number; z: number }, viewZ: number, width: number, height: number): ScreenPoint {
  const inFront = viewZ < 0;
  const inFrame = Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z >= -1 && ndc.z <= 1;
  return {
    x: ((ndc.x + 1) / 2) * width,
    y: ((1 - ndc.y) / 2) * height,
    visible: inFront && inFrame && Number.isFinite(ndc.x) && Number.isFinite(ndc.y),
  };
}
