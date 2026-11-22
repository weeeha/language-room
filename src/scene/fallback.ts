// Scene fallback and performance (docs/spec.md sections 5.3 and 6, criterion 3).
// The scene never gates the lesson: every failure ends as the notice below and the
// conversation carries on. This file holds the decisions and the page model. No DOM.
import type { Scenario, Scene } from "../scenario/validate";
import { SceneLoadError, type SceneLoadReason } from "./loader";

export const SCENE_FAILED_NOTICE = "Scene unavailable, continuing without it";

export type SceneAction = "load" | "load-low" | "skip";

export interface ActionInput {
  hasScene: boolean;
  webgl: boolean;
  saveData?: boolean;
  effectiveType?: string;
}

const SLOW_TYPES = new Set(["slow-2g", "2g", "3g"]);

export function isSlowNetwork(input: Pick<ActionInput, "saveData" | "effectiveType">): boolean {
  return input.saveData === true || (input.effectiveType !== undefined && SLOW_TYPES.has(input.effectiveType));
}

/** No scene or no WebGL means skip. A slow network means the low tier, when there is one. */
export function decideSceneAction(input: ActionInput): SceneAction {
  if (!input.hasScene || !input.webgl) return "skip";
  return isSlowNetwork(input) ? "load-low" : "load";
}

/** The file to fetch. load-low picks tiers.low and falls back to the normal file. */
export function pickSceneFile(scene: Scene, action: SceneAction): string {
  if (action === "load-low" && scene.tiers?.low) return scene.tiers.low;
  return scene.tiers?.default ?? scene.file;
}

/** Network hints from the browser, when it has them. */
export function readConnection(nav: { connection?: { saveData?: boolean; effectiveType?: string } } | undefined): Pick<ActionInput, "saveData" | "effectiveType"> {
  const c = nav?.connection;
  return { saveData: c?.saveData, effectiveType: c?.effectiveType };
}

/** Rendering runs only while the tab is visible and the phone header is open. */
export function shouldRender(state: { hidden: boolean; collapsed: boolean }): boolean {
  return !state.hidden && !state.collapsed;
}

export type SceneStatus = "none" | "loading" | "ready" | "failed";

export interface SceneModel {
  status: SceneStatus;
  /** Share loaded from 0 to 1, or null when the size is unknown. */
  progress: number | null;
  reason?: SceneLoadReason;
  /** The words for the scene area when the scene failed. */
  notice: string | null;
}

/** What the controller needs from a viewer. createSceneViewer fits it. */
export interface SceneHandle {
  ready: Promise<void>;
  pause(): void;
  resume(): void;
  dispose(): void;
}

export interface MountArgs {
  url: string;
  scene: Scene;
  onProgress(fraction: number | null): void;
  onState(state: "loading" | "ready" | "failed", err?: SceneLoadError): void;
}

export interface SceneController {
  readonly model: SceneModel;
  subscribe(fn: (m: SceneModel) => void): () => void;
  /** Decides, then loads. Never throws. */
  start(): void;
  setHidden(hidden: boolean): void;
  setCollapsed(collapsed: boolean): void;
  dispose(): void;
}

export interface ControllerOptions {
  scenario: Scenario;
  env: Pick<ActionInput, "webgl" | "saveData" | "effectiveType">;
  /** Replaces the scene file, for the development sample room. */
  urlOverride?: string;
  resolveUrl(file: string): string;
  mount(args: MountArgs): SceneHandle;
}

export function createSceneController(opts: ControllerOptions): SceneController {
  const scene = opts.scenario.place.scene;
  const listeners = new Set<(m: SceneModel) => void>();
  let model: SceneModel = { status: "none", progress: null, notice: null };
  let handle: SceneHandle | undefined;
  let hidden = false;
  let collapsed = false;
  let disposed = false;

  function set(next: Partial<SceneModel>): void {
    if (disposed) return;
    model = { ...model, ...next };
    for (const fn of [...listeners]) {
      try {
        fn(model);
      } catch {
        // A failing listener must not break the page.
      }
    }
  }

  function fail(err: unknown): void {
    if (model.status === "failed") return;
    const reason = err instanceof SceneLoadError ? err.reason : "unknown";
    if (reason !== "aborted") console.info("scene failed", reason, err instanceof Error ? err.message : "");
    set({ status: "failed", reason, notice: SCENE_FAILED_NOTICE });
  }

  function applyPause(): void {
    if (!handle) return;
    if (shouldRender({ hidden, collapsed })) handle.resume();
    else handle.pause();
  }

  return {
    get model() {
      return model;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    start() {
      if (disposed || model.status !== "none") return;
      const action = decideSceneAction({ hasScene: Boolean(scene), ...opts.env });
      if (!scene) return;
      if (action === "skip") {
        // The scenario has a scene but this browser cannot draw it.
        fail(new SceneLoadError("webgl", "WebGL is not available"));
        return;
      }
      const url = opts.urlOverride ?? opts.resolveUrl(pickSceneFile(scene, action));
      set({ status: "loading", progress: null });
      try {
        handle = opts.mount({
          url,
          scene,
          onProgress: (f) => set({ progress: f }),
          onState(state, err) {
            if (state === "ready") set({ status: "ready", progress: 1 });
            else if (state === "failed") fail(err);
          },
        });
      } catch (e) {
        fail(e);
        return;
      }
      applyPause();
      handle.ready.then(
        () => undefined,
        (e: unknown) => fail(e),
      );
    },
    setHidden(value) {
      hidden = value;
      applyPause();
    },
    setCollapsed(value) {
      collapsed = value;
      applyPause();
    },
    dispose() {
      if (disposed) return;
      handle?.dispose();
      handle = undefined;
      disposed = true;
      listeners.clear();
    },
  };
}

/**
 * The page starts the conversation first and the scene second.
 * A scene that throws here cannot reach the conversation.
 */
export function startConversationThenScene(startConversation: () => void, startScene: () => void): void {
  startConversation();
  try {
    startScene();
  } catch (e) {
    console.warn("scene start failed", e);
  }
}
