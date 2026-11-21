// Loads a splat file. The 3D code is imported here, on demand, so the conversation
// page never waits for it. Every failure ends as a SceneLoadError with a reason.
import type * as ThreeNs from "three";
import type * as SparkNs from "@sparkjsdev/spark";

export type SceneLoadReason = "not-found" | "timeout" | "webgl" | "network" | "aborted" | "unknown";

export class SceneLoadError extends Error {
  readonly reason: SceneLoadReason;
  constructor(reason: SceneLoadReason, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SceneLoadError";
    this.reason = reason;
  }
}

export const DEFAULT_TIMEOUT_MS = 20000;

/** Turns the scenario's file path into a URL the browser can fetch. */
export function resolveSceneUrl(file: string): string {
  const f = file.trim();
  if (/^https?:\/\//i.test(f)) return f;
  return `/${f.replace(/^(\.\/|\/)+/, "")}`;
}

/** The share of the file received, or null when the total is unknown. */
export function progressFraction(loaded: number, total: number | null): number | null {
  if (total === null || !Number.isFinite(total) || total <= 0) return null;
  return Math.min(1, Math.max(0, loaded / total));
}

export function percent(fraction: number | null): number | null {
  return fraction === null ? null : Math.round(fraction * 100);
}

/** SPZ files are gzip streams. PLY files start with the word ply. An HTML page is neither. */
export function looksLikeSplat(head: Uint8Array): boolean {
  if (head.length >= 2 && head[0] === 0x1f && head[1] === 0x8b) return true;
  return head.length >= 3 && head[0] === 0x70 && head[1] === 0x6c && head[2] === 0x79;
}

/** Maps anything thrown while loading to a typed error. */
export function classifyLoadError(e: unknown, hint?: { timedOut?: boolean }): SceneLoadError {
  if (e instanceof SceneLoadError) return e;
  if (hint?.timedOut) return new SceneLoadError("timeout", "The scene took too long to load", { cause: e });
  const name = e instanceof Error ? e.name : "";
  const message = e instanceof Error ? e.message : String(e);
  if (name === "AbortError") return new SceneLoadError("aborted", "The scene load was cancelled", { cause: e });
  if (/webgl|gl context/i.test(message)) return new SceneLoadError("webgl", "WebGL is not available", { cause: e });
  if (/dynamically imported module|importing a module script|failed to fetch|networkerror|load failed/i.test(message)) {
    return new SceneLoadError("network", "A scene file could not be fetched", { cause: e });
  }
  return new SceneLoadError("unknown", message || "The scene could not be loaded", { cause: e });
}

export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export interface LoadedScene {
  THREE: typeof ThreeNs;
  Spark: typeof SparkNs;
  splat: SparkNs.SplatMesh;
  bytes: number;
  loadMs: number;
}

export interface LoadOptions {
  url: string;
  onProgress?: (fraction: number | null) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
}

async function download(url: string, signal: AbortSignal, onProgress?: (f: number | null) => void): Promise<Uint8Array> {
  const res = await fetch(url, { signal });
  if (res.status === 404 || res.status === 403 || res.status === 410) {
    throw new SceneLoadError("not-found", `No scene file at ${url}`);
  }
  if (!res.ok) throw new SceneLoadError("network", `The scene server answered ${res.status}`);
  if (/text\/html/i.test(res.headers.get("content-type") ?? "")) {
    throw new SceneLoadError("not-found", `${url} is a web page, not a scene file`);
  }
  const total = Number(res.headers.get("content-length")) || null;
  onProgress?.(total === null ? null : 0);
  if (!res.body) {
    const all = new Uint8Array(await res.arrayBuffer());
    if (!looksLikeSplat(all)) throw new SceneLoadError("not-found", `${url} is not a scene file`);
    return all;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (chunks.length === 0 && !looksLikeSplat(value)) {
      void reader.cancel();
      throw new SceneLoadError("not-found", `${url} is not a scene file`);
    }
    chunks.push(value);
    loaded += value.length;
    onProgress?.(progressFraction(loaded, total));
  }
  const out = new Uint8Array(loaded);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  if (!looksLikeSplat(out)) throw new SceneLoadError("not-found", `${url} is not a scene file`);
  return out;
}

/** Resolves when the splat is initialized. Rejects with a SceneLoadError. */
export async function loadScene(opts: LoadOptions): Promise<LoadedScene> {
  const started = performance.now();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!hasWebGL()) throw new SceneLoadError("webgl", "WebGL is not available");

  const ctl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctl.abort();
  }, timeoutMs);
  const onAbort = (): void => ctl.abort();
  if (opts.signal?.aborted) ctl.abort();
  else opts.signal?.addEventListener("abort", onAbort, { once: true });

  const aborted = new Promise<never>((_, reject) => {
    const fail = (): void => reject(classifyLoadError(new DOMException("aborted", "AbortError"), { timedOut }));
    if (ctl.signal.aborted) fail();
    else ctl.signal.addEventListener("abort", fail, { once: true });
  });
  aborted.catch(() => undefined);

  let splat: SparkNs.SplatMesh | undefined;
  try {
    const work = (async () => {
      const [THREE, Spark, bytes] = await Promise.all([
        import("three"),
        import("@sparkjsdev/spark"),
        download(opts.url, ctl.signal, opts.onProgress),
      ]);
      const name = opts.url.split("?")[0]?.split("/").pop() || "scene.spz";
      splat = new Spark.SplatMesh({ fileBytes: bytes, fileName: name });
      // Marble uses OpenCV axes (y down, z forward). A half turn about x gives three.js axes.
      splat.quaternion.set(1, 0, 0, 0);
      await splat.initialized;
      opts.onProgress?.(1);
      return { THREE, Spark, splat, bytes: bytes.length, loadMs: Math.round(performance.now() - started) };
    })();
    work.catch(() => undefined);
    return await Promise.race([work, aborted]);
  } catch (e) {
    splat?.dispose();
    throw classifyLoadError(e, { timedOut });
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}
