import { describe, expect, it } from "vitest";
import { validateScenario } from "../scenario/validate";
import {
  setId,
  addHotspot,
  addSign,
  buildScenario,
  checkForm,
  emptyForm,
  setHotspotText,
  setSignText,
  setStepHint,
  setTitle,
  type FormState,
} from "./form";
import {
  attachScene,
  clearNameTag,
  getPosition,
  isUnplaced,
  marblePrompt,
  nudge,
  placeableTargets,
  removeScene,
  sceneFilePath,
  setCoordinate,
  setPosition,
  setSpawn,
  setSpawnCoordinate,
} from "./placement";

function withText(): FormState {
  let s = setTitle(emptyForm(), "Buying bread");
  s = { ...s, placeName: "Padaria", placePrompt: "A small bakery with a wooden counter", characterName: "Senhor Rui", role: "baker", persona: "Calm.", goalDescription: "Buy rolls." };
  s = setStepHint(s, 0, "Greet the baker.");
  s = { ...s, phrases: ["Bom dia"] };
  s = addHotspot(s);
  s = setHotspotText(s, 0, "word", "o pão");
  s = setHotspotText(s, 0, "gloss", "bread");
  s = addSign(s);
  s = setSignText(s, 0, "Pão fresco");
  return s;
}

describe("scene file path rule", () => {
  it("makes media/<id>/<name> for spz and ply", () => {
    expect(sceneFilePath("cafe", "scene-500k.spz")).toEqual({ ok: true, path: "media/cafe/scene-500k.spz", format: "spz", name: "scene-500k.spz" });
    const ply = sceneFilePath("cafe", "Room.PLY");
    expect(ply.ok && ply.path).toBe("media/cafe/Room.ply");
  });
  it("drops any directory part so a path cannot climb out", () => {
    for (const name of ["../../etc/passwd.spz", "..\\..\\secret.ply", "/abs/path/scene.spz", "a/../b/scene.spz"]) {
      const r = sceneFilePath("cafe", name);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.path.startsWith("media/cafe/")).toBe(true);
        expect(r.path.slice("media/cafe/".length)).not.toMatch(/[\\/]/);
        expect(r.path).not.toContain("..");
      }
    }
  });
  it("keeps only safe characters", () => {
    const r = sceneFilePath("cafe", "Café scene (final) v2!.spz");
    expect(r.ok && r.path).toBe("media/cafe/Cafe-scene-final-v2.spz");
    const dots = sceneFilePath("cafe", "a..b.spz");
    expect(dots.ok && dots.path).toBe("media/cafe/a.b.spz");
  });
  it("rejects other extensions, empty names and a bad id", () => {
    expect(sceneFilePath("cafe", "scene.glb").ok).toBe(false);
    expect(sceneFilePath("cafe", "scene").ok).toBe(false);
    expect(sceneFilePath("cafe", ".spz").ok).toBe(false);
    expect(sceneFilePath("cafe", "???.spz").ok).toBe(false);
    expect(sceneFilePath("", "scene.spz").ok).toBe(false);
    expect(sceneFilePath("Bad Id", "scene.spz").ok).toBe(false);
  });
});

describe("attach and remove a scene", () => {
  it("stores the path, format, source and a spawn, and moves the prompt into the scene", () => {
    const r = attachScene(withText(), "scene-500k.spz");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const built = buildScenario(r.state, 1);
    expect(built.place.scene?.file).toBe("media/buying-bread/scene-500k.spz");
    expect(built.place.scene?.format).toBe("spz");
    expect(built.place.scene?.source).toBe("marble");
    expect(built.place.scene?.prompt).toBe("A small bakery with a wooden counter");
    expect(built.place.prompt).toBeUndefined();
    expect(built.place.scene?.spawn.position).toHaveLength(3);
  });
  it("refuses a bad file and leaves the state alone", () => {
    const r = attachScene(withText(), "scene.glb");
    expect(r.ok).toBe(false);
  });
  it("keeps the spawn when a second file replaces the first", () => {
    const first = attachScene(withText(), "a.spz");
    if (!first.ok) throw new Error("attach failed");
    const moved = setSpawn(first.state, [1, 1.5, 1], [1, 1.5, -2]);
    const second = attachScene(moved, "b.ply");
    expect(second.ok && second.state.scene?.spawn).toEqual({ position: [1, 1.5, 1], lookAt: [1, 1.5, -2] });
    expect(second.ok && second.state.scene?.format).toBe("ply");
  });
  it("removing the scene moves the prompt back to place.prompt", () => {
    const r = attachScene(withText(), "a.spz");
    if (!r.ok) throw new Error("attach failed");
    const built = buildScenario(removeScene(r.state), 1);
    expect(built.place.scene).toBeUndefined();
    expect(built.place.prompt).toBe("A small bakery with a wooden counter");
  });
});

describe("marble prompt", () => {
  it("joins the name and the prompt as sentences", () => {
    expect(marblePrompt({ placeName: "Padaria in Graça", placePrompt: "A small bakery" })).toBe("Padaria in Graça. A small bakery.");
    expect(marblePrompt({ placeName: "Padaria", placePrompt: "" })).toBe("Padaria.");
    expect(marblePrompt({ placeName: "", placePrompt: "" })).toBe("");
  });
});

describe("placement state", () => {
  it("lists the name tag, words and signs", () => {
    const labels = placeableTargets(withText()).map((t) => t.label);
    expect(labels).toEqual(["Name tag: Senhor Rui", "Word: o pão", "Sign: Pão fresco"]);
  });
  it("sets, reads and nudges a position", () => {
    let s = withText();
    const word = { kind: "hotspot", id: "o-pao" } as const;
    expect(isUnplaced(s, word)).toBe(true);
    s = setPosition(s, word, [0.4, 1.001, -0.8]);
    expect(getPosition(s, word)).toEqual([0.4, 1, -0.8]);
    expect(isUnplaced(s, word)).toBe(false);
    s = nudge(s, word, 0, 0.1);
    s = nudge(s, word, 2, -0.25);
    expect(getPosition(s, word)).toEqual([0.5, 1, -1.05]);
    s = setCoordinate(s, word, 1, 1.4);
    expect(getPosition(s, word)).toEqual([0.5, 1.4, -1.05]);
    expect(setCoordinate(s, word, 1, Number.NaN)).toBe(s);
  });
  it("does not change the other items or the original state", () => {
    const s = withText();
    const sign = { kind: "signage", id: "pao-fresco" } as const;
    const after = setPosition(s, sign, [1, 2, 3]);
    expect(getPosition(after, sign)).toEqual([1, 2, 3]);
    expect(getPosition(s, sign)).toEqual([0, 0, 0]);
    expect(after.hotspots[0]?.position).toEqual([0, 0, 0]);
  });
  it("an unknown id changes nothing", () => {
    const s = withText();
    expect(setPosition(s, { kind: "hotspot", id: "nope" }, [1, 1, 1])).toBe(s);
  });
  it("the name tag has no position until one is set, and can be cleared", () => {
    let s = withText();
    const tag = { kind: "nametag" } as const;
    expect(getPosition(s, tag)).toBeUndefined();
    s = setCoordinate(s, tag, 0, 2);
    expect(getPosition(s, tag)).toEqual([2, 0, 0]);
    expect(buildScenario(s, 1).character.anchor).toEqual([2, 0, 0]);
    s = clearNameTag(s);
    expect(buildScenario(s, 1).character.anchor).toBeUndefined();
  });
  it("sets the spawn from a camera pose and edits its numbers", () => {
    const r = attachScene(withText(), "a.spz");
    if (!r.ok) throw new Error("attach failed");
    let s = setSpawn(r.state, [0.123, 1.6, 2], [0, 1.6, -1]);
    expect(s.scene?.spawn.position).toEqual([0.12, 1.6, 2]);
    s = setSpawnCoordinate(s, "lookAt", 2, -4);
    expect(s.scene?.spawn.lookAt).toEqual([0, 1.6, -4]);
    expect(setSpawn(withText(), [0, 0, 0], [0, 0, 1]).scene).toBeNull();
  });
});

describe("a teacher makes a scene without editing JSON", () => {
  it("form and placement actions alone give a valid scenario with a scene, a hotspot and a sign", () => {
    let s = withText();
    const attached = attachScene(s, "scene-500k.spz");
    if (!attached.ok) throw new Error("attach failed");
    s = attached.state;
    s = setSpawn(s, [0, 1.6, 2], [0, 1.5, -1]);
    s = setPosition(s, { kind: "nametag" }, [0, 1.7, -1.5]);
    s = setPosition(s, { kind: "hotspot", id: "o-pao" }, [0.4, 1.0, -0.8]);
    s = nudge(s, { kind: "hotspot", id: "o-pao" }, 1, 0.05);
    s = setPosition(s, { kind: "signage", id: "pao-fresco" }, [1.2, 1.8, -1.5]);
    const check = checkForm(s, 1);
    expect(check.errors).toEqual([]);
    const result = validateScenario(check.scenario);
    expect(result.valid).toBe(true);
    expect(check.scenario.place.scene?.file).toBe("media/buying-bread/scene-500k.spz");
    expect(check.scenario.place.hotspots).toEqual([{ id: "o-pao", position: [0.4, 1.05, -0.8], word: "o pão", gloss: "bread" }]);
    expect(check.scenario.place.signage).toEqual([{ id: "pao-fresco", anchor: [1.2, 1.8, -1.5], text: "Pão fresco" }]);
    expect(check.scenario.character.anchor).toEqual([0, 1.7, -1.5]);
  });
});

describe("scene path follows the id while the scenario is new", () => {
  it("rewrites media/<old>/<file> when the title or id changes", () => {
    const r = attachScene(withText(), "scene-500k.spz");
    if (!r.ok) throw new Error("attach failed");
    const renamed = setTitle(r.state, "Bread and rolls");
    expect(renamed.scene?.file).toBe("media/bread-and-rolls/scene-500k.spz");
    expect(setId(renamed, "my-bakery").scene?.file).toBe("media/my-bakery/scene-500k.spz");
  });
  it("leaves the path alone once the scenario is saved", () => {
    const r = attachScene(withText(), "scene-500k.spz");
    if (!r.ok) throw new Error("attach failed");
    const saved = { ...r.state, isNew: false };
    expect(setTitle(saved, "Other").scene?.file).toBe("media/buying-bread/scene-500k.spz");
  });
});
