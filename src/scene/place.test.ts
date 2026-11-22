import { describe, expect, it } from "vitest";
import { applyPlacement, placementFragment, targetKey, type WorkingPlace } from "./place";

function work(): WorkingPlace {
  return {
    hotspots: [{ id: "pastel-de-nata", position: [0.4, 1, -0.8], word: "o pastel de nata", gloss: "custard tart" }],
    signage: [{ id: "menu", anchor: [1.2, 1.8, -1.5], text: "Café 1,00 | Galão 1,60" }],
  };
}

describe("placement", () => {
  it("prints the hotspot fragment with the new position and the other fields intact", () => {
    const w = work();
    expect(applyPlacement(w, { kind: "hotspot", id: "pastel-de-nata" }, [0.5, 1.1, -3])).toBe(true);
    const frag = placementFragment(w, { kind: "hotspot", id: "pastel-de-nata" });
    expect(frag?.where).toBe("place.hotspots");
    expect(JSON.parse(frag?.json ?? "")).toEqual({
      id: "pastel-de-nata",
      position: [0.5, 1.1, -3],
      word: "o pastel de nata",
      gloss: "custard tart",
    });
  });

  it("prints the sign fragment with the new anchor", () => {
    const w = work();
    applyPlacement(w, { kind: "signage", id: "menu" }, [2, 2, -2]);
    const frag = placementFragment(w, { kind: "signage", id: "menu" });
    expect(JSON.parse(frag?.json ?? "")).toEqual({ id: "menu", anchor: [2, 2, -2], text: "Café 1,00 | Galão 1,60" });
  });

  it("prints the name tag anchor once one is set", () => {
    const w = work();
    expect(placementFragment(w, { kind: "nametag" })).toBeNull();
    applyPlacement(w, { kind: "nametag" }, [0, 1.5, -2]);
    expect(placementFragment(w, { kind: "nametag" })).toEqual({ where: "character", json: '"anchor": [0,1.5,-2]' });
  });

  it("ignores an unknown id and writes nothing", () => {
    const w = work();
    expect(applyPlacement(w, { kind: "hotspot", id: "nope" }, [1, 1, 1])).toBe(false);
    expect(placementFragment(w, { kind: "signage", id: "nope" })).toBeNull();
    expect(w.hotspots[0]?.position).toEqual([0.4, 1, -0.8]);
  });

  it("names targets uniquely", () => {
    expect(targetKey({ kind: "hotspot", id: "a" })).not.toBe(targetKey({ kind: "signage", id: "a" }));
    expect(targetKey({ kind: "nametag" })).toBe("nametag");
  });
});
