// Look-around math for the scene camera. Pure: no three.js, so it runs in Node tests.
import type { Vec3 } from "../scenario/validate";

export interface Angles {
  /** Turn about the vertical axis in radians. Zero looks down -z. Positive turns left. */
  yaw: number;
  /** Tilt in radians. Positive looks up. */
  pitch: number;
}

/** About 83 degrees. Looking straight up or down would flip the camera. */
export const PITCH_LIMIT = 1.45;
/** Radians per pixel of drag. */
export const DRAG_SENSITIVITY = 0.004;
/** Radians per arrow key press. */
export const KEY_STEP = 0.06;

export function clampPitch(pitch: number): number {
  return Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, pitch));
}

/** Keeps yaw in the range from minus pi up to pi. */
export function wrapYaw(yaw: number): number {
  const turn = Math.PI * 2;
  let y = yaw % turn;
  if (y > Math.PI) y -= turn;
  if (y <= -Math.PI) y += turn;
  return y;
}

/** The angles that look from a camera along a direction. A zero direction keeps the default view. */
export function anglesFromDirection(dir: Vec3): Angles {
  const [x, y, z] = dir;
  const len = Math.hypot(x, y, z);
  if (len === 0) return { yaw: 0, pitch: 0 };
  // Adding zero turns a negative zero into a plain zero.
  return { yaw: wrapYaw(Math.atan2(-x, -z)) + 0, pitch: clampPitch(Math.asin(y / len)) + 0 };
}

export function anglesFromSpawn(position: Vec3, lookAt: Vec3): Angles {
  return anglesFromDirection([lookAt[0] - position[0], lookAt[1] - position[1], lookAt[2] - position[2]]);
}

/** Dragging right moves the picture right, so the camera turns left. Dragging down looks up. */
export function applyDrag(from: Angles, dxPx: number, dyPx: number, sensitivity = DRAG_SENSITIVITY): Angles {
  return { yaw: wrapYaw(from.yaw + dxPx * sensitivity), pitch: clampPitch(from.pitch + dyPx * sensitivity) };
}

export function applyKey(from: Angles, key: string, step = KEY_STEP): Angles | null {
  switch (key) {
    case "ArrowLeft":
      return { yaw: wrapYaw(from.yaw + step), pitch: from.pitch };
    case "ArrowRight":
      return { yaw: wrapYaw(from.yaw - step), pitch: from.pitch };
    case "ArrowUp":
      return { yaw: from.yaw, pitch: clampPitch(from.pitch + step) };
    case "ArrowDown":
      return { yaw: from.yaw, pitch: clampPitch(from.pitch - step) };
    default:
      return null;
  }
}
