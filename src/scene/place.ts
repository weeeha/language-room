// Development tool: place hotspots, signs and the name tag by clicking in the scene.
// It changes nothing on disk. The panel prints a JSON fragment to copy into the scenario file.
import type { Hotspot, Signage, Vec3 } from "../scenario/validate";
import { h } from "../ui/dom";
import type { SceneViewer } from "./viewer";

export type PlaceTarget = { kind: "hotspot"; id: string } | { kind: "signage"; id: string } | { kind: "nametag" };

export interface WorkingPlace {
  hotspots: Hotspot[];
  signage: Signage[];
  anchor?: Vec3;
}

export function targetKey(t: PlaceTarget): string {
  return t.kind === "nametag" ? "nametag" : `${t.kind}:${t.id}`;
}

/** Sets the position of the chosen item in the working copy. Returns false for an unknown id. */
export function applyPlacement(work: WorkingPlace, target: PlaceTarget, position: Vec3): boolean {
  if (target.kind === "nametag") {
    work.anchor = position;
    return true;
  }
  if (target.kind === "hotspot") {
    const item = work.hotspots.find((x) => x.id === target.id);
    if (!item) return false;
    item.position = position;
    return true;
  }
  const item = work.signage.find((x) => x.id === target.id);
  if (!item) return false;
  item.anchor = position;
  return true;
}

/** The JSON to paste into the scenario file for the chosen item. */
export function placementFragment(work: WorkingPlace, target: PlaceTarget): { where: string; json: string } | null {
  if (target.kind === "nametag") {
    if (!work.anchor) return null;
    return { where: "character", json: `"anchor": ${JSON.stringify(work.anchor)}` };
  }
  if (target.kind === "hotspot") {
    const item = work.hotspots.find((x) => x.id === target.id);
    return item ? { where: "place.hotspots", json: JSON.stringify(item) } : null;
  }
  const item = work.signage.find((x) => x.id === target.id);
  return item ? { where: "place.signage", json: JSON.stringify(item) } : null;
}

/**
 * Calls onPick with the scene position under a click. A drag looks around and does not pick.
 * Presses inside an element that matches ignore (a control panel) are skipped.
 * Returns a function that removes the listeners.
 */
export function bindPick(
  surface: HTMLElement,
  viewer: Pick<SceneViewer, "pick">,
  onPick: (position: Vec3) => void,
  ignore = ".place-panel",
): () => void {
  let down: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent): void => {
    down = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: PointerEvent): void => {
    if (!down || (e.target as Element | null)?.closest(ignore)) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 4) return; // a drag looks around, it does not place
    const pos = viewer.pick(e.clientX, e.clientY);
    if (pos) onPick(pos);
  };
  surface.addEventListener("pointerdown", onDown);
  surface.addEventListener("pointerup", onUp);
  return () => {
    surface.removeEventListener("pointerdown", onDown);
    surface.removeEventListener("pointerup", onUp);
  };
}

export interface PlacePanel {
  element: HTMLElement;
  dispose(): void;
}

/** Click in the scene to set the chosen item's position, then copy the printed fragment. */
export function createPlacePanel(work: WorkingPlace, viewer: SceneViewer, surface: HTMLElement): PlacePanel {
  const targets: { target: PlaceTarget; label: string }[] = [
    ...work.hotspots.map((x) => ({ target: { kind: "hotspot", id: x.id } as PlaceTarget, label: `Hotspot: ${x.id}` })),
    ...work.signage.map((x) => ({ target: { kind: "signage", id: x.id } as PlaceTarget, label: `Sign: ${x.id}` })),
    { target: { kind: "nametag" }, label: "Name tag" },
  ];
  const select = h("select", { id: "place-target" });
  targets.forEach((t, i) => select.append(h("option", { value: String(i) }, t.label)));
  const out = h("pre", { class: "place-out" }, "Click in the scene to place the chosen item.");
  const copy = h("button", { class: "btn btn-small", type: "button" }, "Copy");
  const panel = h(
    "div",
    { class: "overlay place-panel" },
    h("p", {}, "Placing mode (development only). Nothing is saved."),
    h("label", { for: "place-target" }, "Item"),
    select,
    out,
    copy,
  );
  const current = (): PlaceTarget => (targets[Number(select.value)] as { target: PlaceTarget }).target;
  function show(): void {
    const frag = placementFragment(work, current());
    out.textContent = frag ? `${frag.where}:\n${frag.json}` : "Click in the scene to place the chosen item.";
  }
  select.addEventListener("change", show);
  copy.addEventListener("click", () => {
    const frag = placementFragment(work, current());
    if (frag) void navigator.clipboard?.writeText(frag.json);
  });

  const unbind = bindPick(surface, viewer, (pos) => {
    if (applyPlacement(work, current(), pos)) show();
  });

  return {
    element: panel,
    dispose() {
      unbind();
    },
  };
}
