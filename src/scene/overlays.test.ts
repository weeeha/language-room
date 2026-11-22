import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Scenario } from "../scenario/validate";
import { hotspotView } from "./hotspots";
import { nameTagView } from "./nametag";
import { signageView } from "./signage";

const scenario = JSON.parse(readFileSync(new URL("../../scenarios/lisbon-cafe-pt.json", import.meta.url), "utf8")) as Scenario;
const code = scenario.language.code;

describe("overlay text", () => {
  it("signage text is exactly the scenario text, with the language set", () => {
    const views = signageView(scenario.place.signage ?? [], code);
    expect(views.length).toBeGreaterThan(0);
    views.forEach((v, i) => {
      expect(v.text).toBe(scenario.place.signage?.[i]?.text);
      expect(v.lang).toBe("pt-PT");
    });
    expect(views[0]?.text).toBe("Café 1,00 | Galão 1,60 | Pastel de nata 1,30");
  });

  it("hotspot word and gloss are exactly the scenario words", () => {
    const views = hotspotView(scenario.place.hotspots ?? [], code);
    views.forEach((v, i) => {
      const src = scenario.place.hotspots?.[i];
      expect(v.word).toBe(src?.word);
      expect(v.gloss).toBe(src?.gloss);
      expect(v.cardText).toBe(`${src?.word}, ${src?.gloss}`);
    });
    expect(views[0]?.cardText).toBe("o pastel de nata, custard tart");
  });

  it("the name tag is the character name, anchored only when the scenario has an anchor", () => {
    expect(nameTagView(scenario).text).toBe("Dona Amélia");
    expect(nameTagView(scenario).anchor).toBeUndefined();
    const anchored = { ...scenario, character: { ...scenario.character, anchor: [0, 1.5, -2] as [number, number, number] } };
    expect(nameTagView(anchored).anchor).toEqual([0, 1.5, -2]);
  });
});
