import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateScenario, type Scenario } from "../scenario/validate";
import {
  buildCharacterMessages,
  buildCharacterSystemPrompt,
  buildSilencePrompt,
} from "./prompt";

function cafe(): Scenario {
  const url = new URL("../../scenarios/lisbon-cafe-pt.json", import.meta.url);
  const result = validateScenario(JSON.parse(readFileSync(url, "utf8")));
  if (!result.valid) throw new Error(result.errors.join("; "));
  return result.scenario;
}

function bare(): Scenario {
  const s = cafe();
  delete s.place.scene;
  delete s.place.hotspots;
  delete s.place.signage;
  delete s.character.voice;
  delete s.goal.completion;
  delete s.reviewed;
  return s;
}

describe("buildCharacterSystemPrompt", () => {
  const prompt = buildCharacterSystemPrompt(cafe());

  it("contains the character name, role, persona and place", () => {
    expect(prompt).toContain("Dona Amélia");
    expect(prompt).toContain("café owner behind the counter");
    expect(prompt).toContain("Friendly, a little hurried");
    expect(prompt).toContain("Pastelaria in Alfama");
  });

  it("contains the goal and every step hint", () => {
    expect(prompt).toContain("Order a coffee and a pastry, then ask for the bill.");
    expect(prompt).toContain("Say good morning.");
    expect(prompt).toContain("Ask for a coffee and a pastel de nata.");
    expect(prompt).toContain("Ask for the bill and say thank you.");
  });

  it("names the level, language and code, and the locale rule", () => {
    expect(prompt).toContain("A2");
    expect(prompt).toContain("European Portuguese");
    expect(prompt).toContain("pt-PT");
    expect(prompt).toMatch(/never Brazilian/i);
  });

  it("states the A2 limits", () => {
    expect(prompt).toContain("12 words or fewer");
    expect(prompt).toMatch(/one or two sentences/i);
  });

  it("states the per-level limits for each level", () => {
    const limits = { A1: "8 words", A2: "12 words", B1: "16 words", B2: "20 words" } as const;
    for (const level of ["A1", "A2", "B1", "B2"] as const) {
      const s = cafe();
      s.level = level;
      const text = buildCharacterSystemPrompt(s);
      expect(text).toContain(limits[level]);
      const twoSentences = /one or two sentences/i.test(text);
      expect(twoSentences).toBe(level === "A1" || level === "A2");
    }
  });

  it("contains the exact no-correction and in-character sentences", () => {
    expect(prompt).toContain("Do not correct the learner in your reply.");
    expect(prompt).toContain("Stay in character.");
  });

  it("asks for the spoken line only", () => {
    expect(prompt).toMatch(/spoken line only/i);
    expect(prompt).toMatch(/no stage directions/i);
    expect(prompt).toMatch(/no translations/i);
    expect(prompt).toMatch(/no markdown/i);
    expect(prompt).toMatch(/no emoji/i);
  });

  it("asks to move toward the next undone step and to repeat once when asked", () => {
    expect(prompt).toMatch(/next step that is not done/i);
    expect(prompt).toMatch(/repeat once/i);
  });

  it("lists the authored signage as the menu and nothing else", () => {
    expect(prompt).toContain("Café 1,00 | Galão 1,60 | Pastel de nata 1,30");
  });

  it("marks steps as pending when none are done", () => {
    expect(prompt).toContain("[next] greet");
    expect(prompt).not.toContain("[done]");
  });

  it("marks done steps and points at the first undone one", () => {
    const text = buildCharacterSystemPrompt(cafe(), { stepsDone: ["greet"] });
    expect(text).toContain("[done] greet");
    expect(text).toContain("[next] order");
    expect(text).toContain("[todo] pay");
  });

  it("says all steps are done when they are", () => {
    const text = buildCharacterSystemPrompt(cafe(), { stepsDone: ["greet", "order", "pay"] });
    expect(text).not.toContain("[next]");
    expect(text).toMatch(/all steps are done/i);
  });

  it("contains no leftover placeholder text when optional fields are missing", () => {
    const text = buildCharacterSystemPrompt(bare());
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("null");
    expect(text).not.toContain("[object Object]");
    expect(text).toContain("Dona Amélia");
  });
});

describe("buildCharacterMessages", () => {
  it("puts the system prompt first and maps learner to user and character to assistant", () => {
    const messages = buildCharacterMessages(cafe(), [
      { role: "learner", text: "Bom dia." },
      { role: "character", text: "Bom dia. Diga." },
      { role: "learner", text: "Queria um café, por favor." },
    ]);
    expect(messages).toHaveLength(4);
    expect(messages[0]).toEqual({ role: "system", content: buildCharacterSystemPrompt(cafe()) });
    expect(messages.slice(1)).toEqual([
      { role: "user", content: "Bom dia." },
      { role: "assistant", content: "Bom dia. Diga." },
      { role: "user", content: "Queria um café, por favor." },
    ]);
  });

  it("passes stepsDone into the system prompt", () => {
    const messages = buildCharacterMessages(cafe(), [], { stepsDone: ["greet"] });
    expect(messages).toHaveLength(1);
    expect(messages[0]?.content).toContain("[done] greet");
  });
});

describe("buildSilencePrompt", () => {
  it("carries the conversation so far and tells the character not to greet again", () => {
    const messages = buildSilencePrompt(cafe(), {}, [{ role: "character", text: "Bom dia. Diga, faz favor." }]);
    expect(messages.map((m) => m.role)).toEqual(["system", "assistant", "user"]);
    expect(messages[1]?.content).toBe("Bom dia. Diga, faz favor.");
    expect(messages[2]?.content).toMatch(/Do not greet them again/);
  });

  it("asks for one short gentle in-character nudge after 20 seconds of silence", () => {
    const messages = buildSilencePrompt(cafe());
    expect(messages[0]?.role).toBe("system");
    expect(messages[0]?.content).toContain("Do not correct the learner in your reply.");
    const last = messages[messages.length - 1];
    expect(last?.role).toBe("user");
    expect(last?.content).toMatch(/20 seconds/);
    expect(last?.content).toMatch(/one short/i);
    expect(last?.content).toMatch(/gentle/i);
  });

  it("passes stepsDone through", () => {
    const messages = buildSilencePrompt(cafe(), { stepsDone: ["greet"] });
    expect(messages[0]?.content).toContain("[done] greet");
  });
});
