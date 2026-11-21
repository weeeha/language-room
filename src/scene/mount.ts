// Fills the scene area of the conversation page: the viewer, the loading state and the
// small-screen "Show scene / Hide scene" header. It never touches the conversation.
import type { Scenario } from "../scenario/validate";
import { h, icon } from "../ui/dom";
import { createSceneController, readConnection, type SceneModel } from "./fallback";
import { hasWebGL, percent, resolveSceneUrl } from "./loader";
import { createHotspots } from "./hotspots";
import { createNameTag } from "./nametag";
import type { OverlayGroup } from "./overlay";
import { createPlacePanel, type PlacePanel, type WorkingPlace } from "./place";
import { createSignage } from "./signage";
import { createSceneViewer, type SceneViewer } from "./viewer";

export const SAMPLE_SCENE_URL = "https://storage.googleapis.com/forge-dev-public/painted_bedroom.spz";
export const SAMPLE_LABEL = "Sample room, not the café";
export const LOADING_TEXT = "Loading the scene.";

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
  // A polite live region that stays in the page, so the notice is read out without moving focus.
  const noticeSlot = h("div", { class: "scene-notice", role: "status", "aria-live": "polite" });
  surface.append(loading, noticeSlot);
  if (opts.sample) surface.append(h("p", { class: "overlay sample-label" }, SAMPLE_LABEL));

  let viewer: SceneViewer | undefined;
  let placePanel: PlacePanel | undefined;
  let offFrame: (() => void) | undefined;

  const controller = createSceneController({
    scenario,
    env: { webgl: hasWebGL(), ...readConnection(navigator as Parameters<typeof readConnection>[0]) },
    urlOverride: opts.sample ? SAMPLE_SCENE_URL : undefined,
    resolveUrl: resolveSceneUrl,
    mount(args) {
      const v = createSceneViewer(host, args);
      viewer = v;
      return v;
    },
  });

  function render(m: SceneModel): void {
    if (m.status === "loading") {
      const p = percent(m.progress);
      if (p === null) {
        progress.removeAttribute("aria-valuenow");
        bar.style.width = "0";
      } else {
        progress.setAttribute("aria-valuenow", String(p));
        bar.style.width = `${p}%`;
      }
      status.textContent = loadingText(m.progress);
      loading.hidden = false;
    } else {
      loading.hidden = true;
    }
    if (m.status === "ready" && viewer) {
      const v = viewer;
      surface.classList.add("is-placed");
      offFrame ??= v.onFrame(() => groups.forEach((g) => g.update(v)));
      if (opts.place && !placePanel) {
        placePanel = createPlacePanel(work, v, surface);
        surface.append(placePanel.element);
      }
    }
    if (m.status === "failed") {
      offFrame?.();
      offFrame = undefined;
      surface.classList.remove("is-placed");
      groups.forEach((g) => g.update(null));
      if (m.notice && noticeSlot.childElementCount === 0) {
        noticeSlot.append(h("div", { class: "overlay scene-failed" }, icon("info"), h("p", {}, m.notice)));
      }
    }
  }
  controller.subscribe(render);

  // Rendering pauses while the tab is hidden and while the small-screen header is closed.
  const wide = window.matchMedia("(min-width: 1280px)");
  const syncCollapsed = (): void => controller.setCollapsed(!wide.matches && !root.classList.contains("is-open"));
  const onVisibility = (): void => controller.setHidden(document.hidden);
  toggle.addEventListener("click", syncCollapsed);
  wide.addEventListener("change", syncCollapsed);
  document.addEventListener("visibilitychange", onVisibility);

  controller.start();
  syncCollapsed();
  onVisibility();

  return {
    dispose() {
      document.removeEventListener("visibilitychange", onVisibility);
      wide.removeEventListener("change", syncCollapsed);
      offFrame?.();
      placePanel?.dispose();
      controller.dispose();
      viewer = undefined;
      disposeGroups();
    },
  };
}
