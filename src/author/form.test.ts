import { describe, expect, it } from "vitest";
import { validScenario } from "../scenario/fixture";
import { validateScenario, type Scenario } from "../scenario/validate";
import {
  addHotspot,
  addSign,
  addStep,
  buildScenario,
  checkForm,
  deriveScenarioId,
  duplicateScenario,
  emptyForm,
  exportFileName,
  exportText,
  fieldKeyForPath,
  formFromScenario,
  groupErrors,
  importText,
  linesToList,
  moveStep,
  nextVersion,
  removeStep,
  setHotspotText,
  setId,
  setSignText,
  setStepHint,
  setStepId,
  setTitle,
  slugify,
  type FormState,
} from "./form";

const cafe = (): Scenario => validScenario() as unknown as Scenario;

function filled(): FormState {
  let s = emptyForm();
  s = setTitle(s, "Buying bread at a bakery");
  s = { ...s, placeName: "Padaria in Graça", placePrompt: "A small bakery with a wooden counter", characterName: "Senhor Rui", role: "baker", persona: "Calm and patient." };
  s = { ...s, goalDescription: "Buy two rolls and pay." };
  s = setStepHint(s, 0, "Greet the baker.");
  s = addStep(s);
  s = setStepHint(s, 1, "Ask for two rolls.");
  s = { ...s, phrases: ["Bom dia", "Quero dois pães"], grammar: ["numbers one to ten"] };
  return s;
}

describe("form state and scenario object", () => {
  it("round trips a scenario through the form", () => {
    const original = cafe();
    const back = buildScenario(formFromScenario(original), original.version);
    expect(back).toEqual(original);
  });

  it("round trips a scenario with place.prompt and no scene", () => {
    const original = cafe();
    delete original.place.scene;
    original.place.prompt = "A bakery with a wooden counter";
    const back = buildScenario(formFromScenario(original), 1);
    expect(back).toEqual(original);
    expect(back.place.prompt).toBe("A bakery with a wooden counter");
  });

  it("stores the prompt on the scene when a scene is attached", () => {
    const s = formFromScenario(cafe());
    const built = buildScenario({ ...s, placePrompt: "Tiled walls" }, 1);
    expect(built.place.scene?.prompt).toBe("Tiled walls");
    expect(built.place.prompt).toBeUndefined();
  });

  it("a scenario made by the form logic passes the validator", () => {
    const built = buildScenario(filled(), 1);
    const result = validateScenario(built);
    expect(result.valid).toBe(true);
    expect(checkForm(filled(), 1).valid).toBe(true);
  });

  it("never carries a review block from a new form", () => {
    expect(buildScenario(filled(), 1).reviewed).toBeUndefined();
    const result = validateScenario(buildScenario(filled(), 1));
    expect(result.valid && result.listed).toBe(false);
  });

  it("an empty form is invalid and names the required fields", () => {
    const check = checkForm(emptyForm(), 1);
    expect(check.valid).toBe(false);
    const text = check.errors.join("\n");
    for (const path of ["title", "id", "place.name", "character.name", "goal.description", "goal.steps[0].hint", "targets.phrases"]) {
      expect(text).toContain(path);
    }
  });
});

describe("ids", () => {
  it("derives the scenario id from the title", () => {
    expect(deriveScenarioId("Coffee at a Lisbon café")).toBe("coffee-at-a-lisbon-cafe");
    expect(slugify("  --Olá, Mundo!!  ")).toBe("ola-mundo");
    expect(slugify("")).toBe("");
  });

  it("follows the title until the id is edited, and only while the scenario is new", () => {
    let s = setTitle(emptyForm(), "First title");
    expect(s.id).toBe("first-title");
    s = setId(s, "my-own-id");
    s = setTitle(s, "Second title");
    expect(s.id).toBe("my-own-id");
    const saved = setTitle(formFromScenario(cafe()), "A new title");
    expect(saved.id).toBe("lisbon-cafe-pt");
  });

  it("keeps step ids unique when hints repeat", () => {
    let s = emptyForm();
    s = addStep(addStep(s));
    s = setStepHint(s, 0, "Say good morning.");
    s = setStepHint(s, 1, "Say good morning.");
    s = setStepHint(s, 2, "Say good morning.");
    expect(s.steps.map((x) => x.id)).toEqual(["say-good-morning", "say-good-morning-2", "say-good-morning-3"]);
  });

  it("stops changing a step id after the author edits it", () => {
    let s = setStepHint(emptyForm(), 0, "Order a coffee.");
    s = setStepId(s, 0, "order");
    s = setStepHint(s, 0, "Order a coffee and a tart.");
    expect(s.steps[0]?.id).toBe("order");
  });

  it("reports two steps with the same id", () => {
    let s = filled();
    s = setStepId(s, 1, s.steps[0]?.id ?? "");
    const check = checkForm(s, 1);
    expect(check.valid).toBe(false);
    expect(check.errors.some((e) => e.startsWith("goal.steps[1].id"))).toBe(true);
  });

  it("refuses reserved ids and ids a bundled scenario uses", () => {
    expect(checkForm(setId(filled(), "import"), 1).errors.join("\n")).toContain("reserved");
    const taken = checkForm(setId(filled(), "lisbon-cafe-pt"), 1, { bundledIds: ["lisbon-cafe-pt"] });
    expect(taken.errors.join("\n")).toContain("bundled scenario already uses");
    const saved = { ...filled(), isNew: false };
    expect(checkForm(setId(saved, "lisbon-cafe-pt"), 1, { bundledIds: ["lisbon-cafe-pt"] }).valid).toBe(true);
  });

  it("makes hotspot and sign ids from the text and keeps them unique", () => {
    let s = emptyForm();
    s = addHotspot(addHotspot(addSign(s)));
    s = setHotspotText(s, 0, "word", "o pastel de nata");
    s = setHotspotText(s, 1, "word", "o pastel de nata");
    s = setSignText(s, 0, "Café 1,00");
    expect(s.hotspots.map((x) => x.id)).toEqual(["o-pastel-de-nata", "o-pastel-de-nata-2"]);
    expect(s.signage[0]?.id).toBe("cafe-1-00");
  });
});

describe("steps", () => {
  it("moves a step up and down and ignores moves past the ends", () => {
    let s = filled();
    const ids = s.steps.map((x) => x.id);
    s = moveStep(s, 1, -1);
    expect(s.steps.map((x) => x.id)).toEqual([ids[1], ids[0]]);
    expect(moveStep(s, 0, -1)).toBe(s);
    expect(moveStep(s, 1, 1)).toBe(s);
  });
  it("removes a step", () => {
    expect(removeStep(filled(), 0).steps).toHaveLength(1);
  });
});

describe("lists", () => {
  it("turns lines into a list without empty lines", () => {
    expect(linesToList(" Bom dia \n\n  Boa tarde\r\n")).toEqual(["Bom dia", "Boa tarde"]);
  });
});

describe("error path to field mapping", () => {
  const known = new Set(["title", "placeName", "steps[1].hint", "steps", "phrases", "languageCode"]);
  it("maps validator paths to field keys", () => {
    expect(fieldKeyForPath("title")).toBe("title");
    expect(fieldKeyForPath("language.code")).toBe("languageCode");
    expect(fieldKeyForPath("place.name")).toBe("placeName");
    expect(fieldKeyForPath("goal.steps[1].hint")).toBe("steps[1].hint");
    expect(fieldKeyForPath("goal.steps")).toBe("steps");
    expect(fieldKeyForPath("targets.phrases[2]")).toBe("phrases");
    expect(fieldKeyForPath("place.hotspots[0].position")).toBe("hotspots[0].position");
    expect(fieldKeyForPath("place.signage[3].anchor")).toBe("signage[3].position");
    expect(fieldKeyForPath("place.scene.spawn.position")).toBe("scene");
  });
  it("puts errors with a field next to it and the rest in the summary", () => {
    const grouped = groupErrors(
      ["title: must be a non-empty string", "language.code: must be a BCP 47 tag such as pt-PT", "version: must be a positive integer", "reviewed.by: required"],
      known,
    );
    expect(grouped.byField.get("title")).toEqual(["Enter a value."]);
    expect(grouped.byField.get("languageCode")).toEqual(["Use a language tag such as pt-PT."]);
    expect(grouped.unmapped).toEqual(["version: must be a positive integer", "reviewed.by: required"]);
  });
});

describe("version rule", () => {
  it("starts at 1", () => {
    expect(nextVersion(undefined, cafe())).toBe(1);
  });
  it("keeps the version when the content is unchanged, whatever the key order", () => {
    const saved = { ...cafe(), version: 3 };
    const again = buildScenario(formFromScenario(saved), 3);
    expect(nextVersion(saved, again)).toBe(3);
  });
  it("raises the version when the content changed", () => {
    const saved = { ...cafe(), version: 3 };
    const changed = buildScenario({ ...formFromScenario(saved), persona: "Strict." }, 3);
    expect(nextVersion(saved, changed)).toBe(4);
  });
  it("does not raise the version for a review change alone", () => {
    const saved = { ...cafe(), version: 2 };
    const reviewed = { ...saved, reviewed: { by: "r-1", on: "2026-11-20" } };
    expect(nextVersion(saved, reviewed)).toBe(2);
  });
});

describe("export and import", () => {
  it("exports pretty printed JSON that validates and is named after the id", () => {
    const built = buildScenario(filled(), 1);
    const text = exportText(built);
    expect(text).toContain('\n  "id": "buying-bread-at-a-bakery"');
    expect(exportFileName(built)).toBe("buying-bread-at-a-bakery.json");
    const result = importText(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.scenario).toEqual(built);
  });
  it("returns the validator's own errors for an invalid file", () => {
    const bad = { ...cafe(), level: "C2" } as unknown;
    const expected = validateScenario(bad);
    const result = importText(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (!result.ok && !expected.valid) expect(result.errors).toEqual(expected.errors);
  });
  it("reports text that is not JSON", () => {
    const result = importText("{ nope");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain("could not parse");
  });
});

describe("duplicate from a bundled scenario", () => {
  it("makes a copy with a new id, version 1 and no review", () => {
    const copy = duplicateScenario(cafe(), ["lisbon-cafe-pt"]);
    expect(copy.id).toBe("lisbon-cafe-pt-copy");
    expect(copy.version).toBe(1);
    expect(copy.reviewed).toBeUndefined();
    expect(validateScenario(copy).valid).toBe(true);
    expect(duplicateScenario(cafe(), ["lisbon-cafe-pt-copy"]).id).toBe("lisbon-cafe-pt-copy-2");
  });
});
