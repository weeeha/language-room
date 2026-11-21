// Shared bits of the scene overlays: a group interface and the per-frame placement.
import type { Vec3 } from "../scenario/validate";
import type { ScreenPoint } from "./screen";

/** The part of the viewer that overlays need. */
export interface Projector {
  project(position: Vec3): ScreenPoint;
}

export interface OverlayGroup {
  /** Elements to add to the scene area. */
  elements: HTMLElement[];
  /** Positions every item from the projector. With null, items go back to the stacked layout. */
  update(projector: Projector | null): void;
  /** Removes listeners that live outside the group's elements. */
  dispose?(): void;
}

/** Moves an element to a screen point, or hides it when the point is not visible. */
export function placeElement(el: HTMLElement, p: ScreenPoint): void {
  if (!p.visible) {
    if (!el.classList.contains("is-off")) el.classList.add("is-off");
    return;
  }
  el.classList.remove("is-off");
  const transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
  if (el.style.transform !== transform) el.style.transform = transform;
}

/** Puts an element back in the normal flow. */
export function clearPlacement(el: HTMLElement): void {
  el.classList.remove("placed", "is-off");
  el.style.transform = "";
}

export function markPlaced(el: HTMLElement): void {
  el.classList.add("placed");
}
