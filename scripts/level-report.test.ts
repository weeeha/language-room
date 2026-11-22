import { describe, expect, it } from "vitest";
import { levelReport } from "./level-report";

const turns = [
  { role: "character", text: "Bom dia. Diga, faz favor." },
  { role: "learner", text: "Bom dia, queria um café por favor e também uma coisa mais." },
  { role: "character", text: "Já trago o café. Mais alguma coisa?" },
];

describe("levelReport", () => {
  it("averages over every sentence of the character lines only", () => {
    const r = levelReport({ turns });
    expect(r.lines).toHaveLength(2);
    expect(r.average).toBeCloseTo((2 + 3 + 4 + 3) / 4);
    expect(r.limit).toBe(12);
    expect(r.pass).toBe(true);
  });
  it("reads the sheet JSON twin and its level", () => {
    expect(levelReport({ level: "A1", session: { turns } }).limit).toBe(8);
  });
  it("fails when the average is over the limit", () => {
    const long = "um dois três quatro cinco seis sete oito nove dez onze doze treze catorze.";
    expect(levelReport({ turns: [{ role: "character", text: long }] }).pass).toBe(false);
  });
  it("rejects input without turns", () => {
    expect(() => levelReport({})).toThrow(/No turns/);
  });
});
