import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateScenario } from "../scenario/validate";
import { audioNotice, briefContent, classifyMicError } from "./briefContent";

const parsed = validateScenario(JSON.parse(readFileSync(new URL("../../scenarios/lisbon-cafe-pt.json", import.meta.url), "utf8")));
if (!parsed.valid) throw new Error(parsed.errors.join("\n"));
const scenario = parsed.scenario;

describe("briefContent", () => {
  const c = briefContent(scenario);
  it("takes the facts from the scenario", () => {
    expect(c.title).toBe("Coffee at a Lisbon café");
    expect(c.level).toBe("A2");
    expect(c.goal).toBe("Order a coffee and a pastry, then ask for the bill.");
    expect(c.steps).toEqual(["Say good morning.", "Ask for a coffee and a pastel de nata.", "Ask for the bill and say thank you."]);
    expect(c.character).toBe(
      "Dona Amélia, café owner behind the counter. Friendly, a little hurried, speaks clearly, repeats once when asked.",
    );
    expect(c.place.startsWith("Pastelaria in Alfama. ")).toBe(true);
    expect(c.languageHeading).toBe("Portuguese");
  });
  it("lists target phrases and hotspot words, with glosses only where the scenario has them", () => {
    expect(c.words.map((w) => w.portuguese)).toEqual([
      "Bom dia",
      "Queria um café, por favor",
      "A conta, por favor",
      "Quanto é?",
      "o pastel de nata",
    ]);
    expect(c.words.filter((w) => w.gloss).map((w) => [w.portuguese, w.gloss])).toEqual([["o pastel de nata", "custard tart"]]);
  });
  it("does not list a word twice", () => {
    const twice = { ...scenario, targets: { ...scenario.targets, phrases: ["o pastel de nata"] } };
    expect(briefContent(twice).words).toEqual([{ portuguese: "o pastel de nata", gloss: "custard tart" }]);
  });
});

describe("audioNotice", () => {
  it("names the provider that gets the audio", () => {
    expect(audioNotice({ id: "stt-whisper-local", label: "Local Whisper", paid: false })).toBe(
      "Audio is sent to Local Whisper on this computer.",
    );
    expect(audioNotice({ id: "stt-browser", label: "Browser speech recognition", paid: false })).toContain("Browser speech recognition");
    expect(audioNotice({ id: "stt-hosted", label: "Hosted STT", paid: true })).toContain("costs money");
  });
});

describe("classifyMicError", () => {
  const named = (name: string): Error => Object.assign(new Error("x"), { name });
  it("sorts errors into the brief states", () => {
    expect(classifyMicError(named("NotAllowedError"))).toBe("denied");
    expect(classifyMicError(named("SttPermissionError"))).toBe("denied");
    expect(classifyMicError(named("NotFoundError"))).toBe("none");
    expect(classifyMicError(named("SttNoSpeechError"))).toBe("nothing");
    expect(classifyMicError(named("AbortError"))).toBe("aborted");
    expect(classifyMicError(new Error("fetch failed"))).toBe("unreachable");
    expect(classifyMicError("odd")).toBe("unreachable");
  });
});
