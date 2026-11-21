import { describe, expect, it } from "vitest";
import { parseRoute, paths } from "./routes";

describe("parseRoute", () => {
  it("reads the four screens", () => {
    expect(parseRoute("/")).toEqual({ name: "library" });
    expect(parseRoute("/s/lisbon-cafe-pt")).toEqual({ name: "brief", id: "lisbon-cafe-pt" });
    expect(parseRoute("/s/lisbon-cafe-pt/play")).toEqual({ name: "play", id: "lisbon-cafe-pt" });
    expect(parseRoute("/s/lisbon-cafe-pt/recap/abc-1")).toEqual({ name: "recap", id: "lisbon-cafe-pt", sessionId: "abc-1" });
  });
  it("ignores a trailing slash", () => {
    expect(parseRoute("/s/x/")).toEqual({ name: "brief", id: "x" });
    expect(parseRoute("/s/x/play/")).toEqual({ name: "play", id: "x" });
  });
  it("sends everything else to not-found", () => {
    for (const p of ["/nope", "/s", "/s/", "/s/x/other", "/s/x/recap", "/s/x/recap/a/b", "/s/x/play/extra", "/author/a/b", "/s/%E0%A4%A"]) {
      expect(parseRoute(p)).toEqual({ name: "not-found" });
    }
  });
  it("builds paths that parse back", () => {
    expect(parseRoute(paths.brief("a b"))).toEqual({ name: "brief", id: "a b" });
    expect(parseRoute(paths.recap("a", "s/1"))).toEqual({ name: "recap", id: "a", sessionId: "s/1" });
    expect(paths.play("lisbon-cafe-pt")).toBe("/s/lisbon-cafe-pt/play");
  });

  it("reads the authoring and import routes", () => {
    expect(parseRoute("/author")).toEqual({ name: "author" });
    expect(parseRoute("/author/")).toEqual({ name: "author" });
    expect(parseRoute("/author/new")).toEqual({ name: "author-edit", id: "new" });
    expect(parseRoute("/author/my-id")).toEqual({ name: "author-edit", id: "my-id" });
    expect(parseRoute("/author/a/b")).toEqual({ name: "not-found" });
    expect(parseRoute("/s/import")).toEqual({ name: "import" });
    expect(parseRoute("/s/import/play")).toEqual({ name: "play", id: "import" });
  });
});
