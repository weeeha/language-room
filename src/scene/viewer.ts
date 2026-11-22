// The scene viewer: three.js plus Spark in a container, with look-around only.
import type * as ThreeNs from "three";
import type { Scene, Vec3 } from "../scenario/validate";
import { createFpsMeter, type FpsMeter } from "./fps";
import { applyDrag, applyKey, anglesFromSpawn, type Angles } from "./lookaround";
import { classifyLoadError, loadScene, SceneLoadError, type LoadedScene } from "./loader";
import { toScreen, type ScreenPoint } from "./screen";

export type ViewerState = "loading" | "ready" | "failed";

export interface ViewerOptions {
  scene: Scene;
  url: string;
  onProgress?: (fraction: number | null) => void;
  onState?: (state: ViewerState, err?: SceneLoadError) => void;
  timeoutMs?: number;
}

export interface SceneViewer {
  ready: Promise<void>;
  /** Screen position inside the container, in CSS pixels, for overlays. */
  project(position: Vec3): ScreenPoint;
  /** A point on the ray through the pointer, at a fixed distance. Null until the scene is ready. */
  pick(clientX: number, clientY: number): Vec3 | null;
  /** Where the camera is and the point it looks at, for choosing a spawn. Null until the scene is ready. */
  pose(): { position: Vec3; lookAt: Vec3 } | null;
  onFrame(fn: () => void): () => void;
  pause(): void;
  resume(): void;
  dispose(): void;
}

/** How far along the ray pick() reports, in scene units. */
export const PICK_DISTANCE = 3;
const FPS_WINDOW_MS = 5000;

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function createSceneViewer(container: HTMLElement, opts: ViewerOptions): SceneViewer {
  const frameListeners = new Set<() => void>();
  const abort = new AbortController();
  let disposed = false;
  let paused = false;
  let angles: Angles = anglesFromSpawn(opts.scene.spawn.position, opts.scene.spawn.lookAt);
  let loaded: LoadedScene | undefined;
  let renderer: ThreeNs.WebGLRenderer | undefined;
  let camera: ThreeNs.PerspectiveCamera | undefined;
  let three: ThreeNs.Scene | undefined;
  let canvas: HTMLCanvasElement | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let meter: FpsMeter | undefined;
  const cleanups: (() => void)[] = [];

  function setState(state: ViewerState, err?: SceneLoadError): void {
    if (!disposed) opts.onState?.(state, err);
  }

  function size(): { w: number; h: number } {
    const r = container.getBoundingClientRect();
    return { w: Math.max(1, r.width), h: Math.max(1, r.height) };
  }

  function aim(): void {
    if (!camera) return;
    camera.rotation.set(angles.pitch, angles.yaw, 0, "YXZ");
  }

  function renderOnce(): void {
    if (!renderer || !three || !camera || disposed) return;
    camera.updateMatrixWorld();
    renderer.render(three, camera);
    meter?.frame();
    for (const fn of [...frameListeners]) fn();
  }

  // Spark sorts splats after a frame is drawn and then asks for another one. While paused
  // (a closed phone header) that follow-up frame is drawn here, so the header is not black.
  let dirtyQueued = false;
  function onDirty(): void {
    if (!paused || dirtyQueued || disposed) return;
    dirtyQueued = true;
    requestAnimationFrame(() => {
      dirtyQueued = false;
      if (paused) renderOnce();
    });
  }

  function resize(): void {
    if (!renderer || !camera) return;
    const { w, h } = size();
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderOnce();
  }

  function listen<K extends keyof HTMLElementEventMap>(el: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void): void {
    el.addEventListener(type, fn);
    cleanups.push(() => el.removeEventListener(type, fn));
  }

  function bindControls(el: HTMLCanvasElement): void {
    let drag: { id: number; x: number; y: number } | null = null;
    listen(el, "pointerdown", (e) => {
      if (e.button !== 0) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    });
    listen(el, "pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      angles = applyDrag(angles, e.clientX - drag.x, e.clientY - drag.y);
      drag.x = e.clientX;
      drag.y = e.clientY;
      aim();
      if (paused) renderOnce();
    });
    const end = (e: PointerEvent): void => {
      if (drag && e.pointerId === drag.id) drag = null;
    };
    listen(el, "pointerup", end);
    listen(el, "pointercancel", end);
    listen(el, "keydown", (e) => {
      const next = applyKey(angles, e.key);
      if (!next) return;
      e.preventDefault();
      angles = next;
      aim();
      if (paused) renderOnce();
    });
  }

  // Frames count only while the render loop runs. A paused scene draws on demand, which is logged as such.
  function startFpsLog(): void {
    const m = createFpsMeter({ now: () => performance.now(), windowMs: FPS_WINDOW_MS });
    meter = m;
    m.setActive(!paused);
    const timer = setInterval(() => {
      const report = m.sample();
      if (!report) return;
      clearInterval(timer);
      if (report.kind === "continuous") console.info("scene fps", { fps: report.fps, seconds: report.seconds });
      else console.info("scene fps: drawn on demand, no continuous loop", { frames: report.frames, seconds: report.seconds });
    }, 500);
    cleanups.push(() => clearInterval(timer));
  }

  async function init(): Promise<void> {
    setState("loading");
    try {
      loaded = await loadScene({ url: opts.url, onProgress: opts.onProgress, signal: abort.signal, timeoutMs: opts.timeoutMs });
      if (disposed) {
        loaded.splat.dispose();
        return;
      }
      const { THREE, Spark, splat } = loaded;
      try {
        // Spark advises against antialiasing: it costs speed and does not help splats.
        renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
      } catch (e) {
        splat.dispose();
        throw new SceneLoadError("webgl", "WebGL is not available", { cause: e });
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      canvas = renderer.domElement;
      canvas.className = "scene-canvas";
      canvas.tabIndex = 0;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", "Scene view, use arrow keys to look around");
      canvas.style.touchAction = "none";
      container.prepend(canvas);

      three = new THREE.Scene();
      three.add(new Spark.SparkRenderer({ renderer, onDirty }));
      three.add(splat);
      const { w, h } = size();
      camera = new THREE.PerspectiveCamera(60, w / h, 0.01, 1000);
      camera.position.set(...opts.scene.spawn.position);
      aim();
      bindControls(canvas);
      canvas.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        setState("failed", new SceneLoadError("webgl", "The graphics context was lost"));
      });

      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
      resize();

      renderer.setAnimationLoop(() => {
        if (!paused) renderOnce();
      });
      startFpsLog();
      console.info("scene", {
        loadMs: loaded.loadMs,
        bytes: loaded.bytes,
        splats: splat.packedSplats?.numSplats,
      });
      setState("ready");
    } catch (e) {
      const err = classifyLoadError(e);
      disposeGraphics();
      setState("failed", err);
      throw err;
    }
  }

  function disposeGraphics(): void {
    resizeObserver?.disconnect();
    resizeObserver = undefined;
    for (const fn of cleanups.splice(0)) fn();
    renderer?.setAnimationLoop(null);
    loaded?.splat.dispose();
    three?.traverse((o) => {
      const mesh = o as ThreeNs.Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material;
      for (const m of Array.isArray(mat) ? mat : mat ? [mat] : []) {
        for (const v of Object.values(m)) {
          const tex = v as ThreeNs.Texture | undefined;
          if (tex?.isTexture) tex.dispose();
        }
        m.dispose();
      }
    });
    three?.clear();
    renderer?.dispose();
    renderer?.forceContextLoss();
    canvas?.remove();
    renderer = undefined;
    camera = undefined;
    three = undefined;
    canvas = undefined;
    loaded = undefined;
  }

  const ready = init();
  // A rejected ready promise is read by the caller. This keeps it from surfacing unhandled.
  ready.catch(() => undefined);

  return {
    ready,
    project(position) {
      if (!camera || !loaded) return { x: 0, y: 0, visible: false };
      const { THREE } = loaded;
      camera.updateMatrixWorld();
      const view = new THREE.Vector3(...position).applyMatrix4(camera.matrixWorldInverse);
      const ndc = view.clone().applyMatrix4(camera.projectionMatrix);
      const { w, h } = size();
      return toScreen(ndc, view.z, w, h);
    },
    pick(clientX, clientY) {
      if (!camera || !loaded) return null;
      const { THREE } = loaded;
      const r = container.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return null;
      const nx = ((clientX - r.left) / r.width) * 2 - 1;
      const ny = 1 - ((clientY - r.top) / r.height) * 2;
      camera.updateMatrixWorld();
      const far = new THREE.Vector3(nx, ny, 0.5).unproject(camera);
      const dir = far.sub(camera.position).normalize();
      const p = camera.position.clone().addScaledVector(dir, PICK_DISTANCE);
      return [round2(p.x), round2(p.y), round2(p.z)];
    },
    pose() {
      if (!camera || !loaded) return null;
      const { THREE } = loaded;
      camera.updateMatrixWorld();
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const at = camera.position.clone().addScaledVector(dir, PICK_DISTANCE);
      const p = camera.position;
      return { position: [round2(p.x), round2(p.y), round2(p.z)], lookAt: [round2(at.x), round2(at.y), round2(at.z)] };
    },
    onFrame(fn) {
      frameListeners.add(fn);
      return () => void frameListeners.delete(fn);
    },
    pause() {
      paused = true;
      meter?.setActive(false);
    },
    resume() {
      if (!paused) return;
      paused = false;
      meter?.setActive(true);
      renderOnce();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      abort.abort();
      frameListeners.clear();
      disposeGraphics();
    },
  };
}
