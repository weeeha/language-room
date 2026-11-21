// Fills the scene area of the conversation page: the viewer, the loading state and the
// small-screen "Show scene / Hide scene" header. It never touches the conversation.
import type { Scenario } from "../scenario/validate";
import { h, icon } from "../ui/dom";
import { percent, resolveSceneUrl, type SceneLoadError } from "./loader";
import { createHotspots } from "./hotspots";
import { createNameTag } from "./nametag";
import type { OverlayGroup } from "./overlay";
import { createPlacePanel, type PlacePanel, type WorkingPlace } from "./place";
import { createSignage } from "./signage";
import { createSceneViewer, type SceneViewer } from "./viewer";

export const SAMPLE_SCENE_URL = "https://storage.googleapis.com/forge-dev-public/painted_bedroom.spz";
export const SAMPLE_LABEL = "Sample room, not the café";
export const LOADING_TEXT = "Loading the scene.";
export const FAILED_TEXT = "Scene unavailable, continuing without it";

export interface MountOptions {
  /** Development only: load the sample room in place of the scenario's file. */
  sample?: boolean;
  /** Development only: show the panel that prints coordinates picked by clicking. */
  place?: boolean;
}

export interface MountedScene {
  dispose(): void;
}

export function loadingText(fraction: number | null): string {
  const p = percent(fraction);
  return p === null ? LOADING_TEXT : `Loading the scene, ${p} percent`;
}

export function mountScene(root: HTMLElement, scenario: Scenario, opts: MountOptions = {}): MountedScene {
  const scene = scenario.place.scene;
  root.hidden = false;
  const host = h("div", { class: "scene-canvas-host" });
  const surface = h("div", { class: "scene-surface", id: "scene-surface" }, host);
  const toggle = h(
    "button",
    { class: "btn scene-toggle", type: "button", "aria-expanded": "false", "aria-controls": "scene-surface" },
    "Show scene",
  );
  toggle.addEventListener("click", () => {
    const open = root.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.textContent = open ? "Hide scene" : "Show scene";
  });
  // Authored words. They show in a stacked layout until a scene is ready to place them.
  const code = scenario.language.code;
  const work: WorkingPlace = {
    hotspots: structuredClone(scenario.place.hotspots ?? []),
    signage: structuredClone(scenario.place.signage ?? []),
    anchor: scenario.character.anchor,
  };
  const nameTag = createNameTag({ text: scenario.character.name, lang: code }, () => work.anchor);
  const hotspots = createHotspots(work.hotspots, code);
  const signage = createSignage(work.signage, code);
  const groups: OverlayGroup[] = [nameTag, hotspots, signage];
  const extras = h("div", { class: "scene-extras" }, ...hotspots.elements, ...signage.elements);
  surface.append(...nameTag.elements, extras);
  root.replaceChildren(surface, toggle);
  const disposeGroups = (): void => groups.forEach((g) => g.dispose?.());
  if (!scene) return { dispose: disposeGroups };

  const bar = h("span", {});
  const progress = h("div", { class: "progress", role: "progressbar", "aria-label": "Loading the scene", "aria-valuemin": "0", "aria-valuemax": "100" }, bar);
  const status = h("p", { class: "status", role: "status" }, LOADING_TEXT);
  const loading = h("div", { class: "overlay scene-status" }, progress, status);
  surface.append(loading);
  if (opts.sample) surface.append(h("p", { class: "overlay sample-label" }, SAMPLE_LABEL));

  function stack(): void {
    surface.classList.remove("is-placed");
    groups.forEach((g) => g.update(null));
  }

  function showFailed(err?: SceneLoadError): void {
    stack();
    if (err) console.info("scene failed", err.reason, err.message);
    loading.replaceChildren(icon("info"), h("p", {}, FAILED_TEXT));
    loading.className = "overlay scene-status scene-failed";
  }

  let viewer: SceneViewer | undefined;
  let placePanel: PlacePanel | undefined;
  let offFrame: (() => void) | undefined;
  const url = opts.sample ? SAMPLE_SCENE_URL : resolveSceneUrl(scene.file);
  viewer = createSceneViewer(host, {
    scene,
    url,
    onProgress(f) {
      const p = percent(f);
      if (p === null) {
        progress.removeAttribute("aria-valuenow");
        bar.style.width = "0";
      } else {
        progress.setAttribute("aria-valuenow", String(p));
        bar.style.width = `${p}%`;
      }
      status.textContent = loadingText(f);
    },
    onState(state, err) {
      if (state === "ready" && viewer) {
        loading.hidden = true;
        const v = viewer;
        surface.classList.add("is-placed");
        offFrame = v.onFrame(() => groups.forEach((g) => g.update(v)));
        if (opts.place) {
          placePanel = createPlacePanel(work, v, surface);
          surface.append(placePanel.element);
        }
      } else if (state === "failed") if (state === "failed") showFailed(err);
    },
  });

  return {
    dispose() {
      offFrame?.();
      placePanel?.dispose();
      viewer?.dispose();
      viewer = undefined;
      disposeGroups();
    },
  };
}
