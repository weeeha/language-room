import { describe, expect, it } from "vitest";
import { classifyLoadError, looksLikeSplat, percent, progressFraction, resolveSceneUrl, SceneLoadError } from "./loader";
import { loadingText } from "./mount";

describe("resolveSceneUrl", () => {
  it("serves a scenario path from the site root", () => {
    expect(resolveSceneUrl("media/lisbon-cafe/scene-500k.spz")).toBe("/media/lisbon-cafe/scene-500k.spz");
  });
  it("accepts leading dots and slashes", () => {
    expect(resolveSceneUrl("./media/a.spz")).toBe("/media/a.spz");
    expect(resolveSceneUrl("/media/a.spz")).toBe("/media/a.spz");
  });
  it("keeps full URLs", () => {
    expect(resolveSceneUrl("https://example.com/a.spz")).toBe("https://example.com/a.spz");
  });
});

describe("progress math", () => {
  it("is a fraction when the length is known", () => {
    expect(progressFraction(50, 200)).toBe(0.25);
    expect(percent(progressFraction(60, 100))).toBe(60);
  });
  it("is null when the length is unknown", () => {
    expect(progressFraction(50, null)).toBeNull();
    expect(progressFraction(50, 0)).toBeNull();
    expect(percent(null)).toBeNull();
  });
  it("never leaves the range", () => {
    expect(progressFraction(300, 200)).toBe(1);
    expect(progressFraction(-5, 200)).toBe(0);
  });
  it("words the loading text as the draft does", () => {
    expect(loadingText(0.6)).toBe("Loading the scene, 60 percent");
    expect(loadingText(null)).toBe("Loading the scene.");
  });
});

describe("looksLikeSplat", () => {
  it("accepts gzip (spz) and ply, rejects html", () => {
    expect(looksLikeSplat(new Uint8Array([0x1f, 0x8b, 8]))).toBe(true);
    expect(looksLikeSplat(new TextEncoder().encode("ply\nformat"))).toBe(true);
    expect(looksLikeSplat(new TextEncoder().encode("<!doctype html>"))).toBe(false);
    expect(looksLikeSplat(new Uint8Array([]))).toBe(false);
  });
});

describe("classifyLoadError", () => {
  it("keeps a typed error", () => {
    const e = new SceneLoadError("not-found", "x");
    expect(classifyLoadError(e)).toBe(e);
  });
  it("maps a timeout hint to timeout", () => {
    expect(classifyLoadError(new DOMException("aborted", "AbortError"), { timedOut: true }).reason).toBe("timeout");
  });
  it("maps an abort to aborted", () => {
    expect(classifyLoadError(new DOMException("aborted", "AbortError")).reason).toBe("aborted");
  });
  it("maps fetch and import failures to network", () => {
    expect(classifyLoadError(new TypeError("Failed to fetch")).reason).toBe("network");
    expect(classifyLoadError(new TypeError("Failed to fetch dynamically imported module: /x.js")).reason).toBe("network");
  });
  it("maps a WebGL message to webgl", () => {
    expect(classifyLoadError(new Error("Error creating WebGL context.")).reason).toBe("webgl");
  });
  it("falls back to unknown", () => {
    const e = classifyLoadError(new Error("bad splat header"));
    expect(e.reason).toBe("unknown");
    expect(e.message).toBe("bad splat header");
  });
});
