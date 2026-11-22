import { describe, expect, it } from "vitest";
import {
  MAX_WORDS_PER_SENTENCE,
  averageSentenceLength,
  checkLevel,
  splitSentences,
} from "./level";

function words(n: number): string {
  return Array.from({ length: n }, (_, i) => `palavra${i}`).join(" ");
}

describe("MAX_WORDS_PER_SENTENCE", () => {
  it("has the per-level limits", () => {
    expect(MAX_WORDS_PER_SENTENCE).toEqual({ A1: 8, A2: 12, B1: 16, B2: 20 });
  });
});

describe("splitSentences", () => {
  it("splits on full stop, question mark, exclamation mark and ellipsis", () => {
    expect(splitSentences("Bom dia. Quer um café? Sim... Claro!")).toEqual([
      "Bom dia.",
      "Quer um café?",
      "Sim...",
      "Claro!",
    ]);
  });

  it("splits on the single ellipsis character", () => {
    expect(splitSentences("Hmm… Já vejo.")).toEqual(["Hmm…", "Já vejo."]);
  });

  it("keeps decimals inside one sentence", () => {
    expect(splitSentences("São dois euros e trinta.")).toEqual(["São dois euros e trinta."]);
    expect(splitSentences("Custa 1,30.")).toEqual(["Custa 1,30."]);
    expect(splitSentences("Custa 1.30 hoje. Obrigada.")).toEqual(["Custa 1.30 hoje.", "Obrigada."]);
  });

  it("returns an empty list for empty or blank text", () => {
    expect(splitSentences("")).toEqual([]);
    expect(splitSentences("   \n ")).toEqual([]);
  });

  it("drops empty pieces from repeated punctuation", () => {
    expect(splitSentences("Olá. . . Tudo bem?")).toEqual(["Olá.", "Tudo bem?"]);
  });
});

describe("averageSentenceLength", () => {
  it("is 0 for empty text", () => {
    expect(averageSentenceLength("")).toBe(0);
    expect(averageSentenceLength("  ")).toBe(0);
  });

  it("counts words per sentence", () => {
    expect(averageSentenceLength("Bom dia. Quer um café?")).toBe(2.5);
  });

  it("does not count punctuation-only tokens as words", () => {
    expect(averageSentenceLength("Bom dia - - . Sim !")).toBe(1.5);
  });

  it("handles Portuguese questions and decimals", () => {
    expect(averageSentenceLength("São dois euros e trinta.")).toBe(5);
    expect(averageSentenceLength("Custa 1,30.")).toBe(2);
    expect(averageSentenceLength("Quanto é? Custa 1,30.")).toBe(2);
  });
});

describe("checkLevel", () => {
  it("flags an A2 reply averaging 20 words per sentence", () => {
    const text = `${words(20)}. ${words(20)}.`;
    const result = checkLevel(text, "A2");
    expect(result).toEqual({ averageWords: 20, sentences: 2, limit: 12, flagged: true });
  });

  it("does not flag an A2 reply averaging 8 words per sentence", () => {
    const text = `${words(8)}. ${words(8)}.`;
    const result = checkLevel(text, "A2");
    expect(result.averageWords).toBe(8);
    expect(result.flagged).toBe(false);
  });

  it("does not flag an average of exactly the limit", () => {
    const result = checkLevel(`${words(12)}.`, "A2");
    expect(result.averageWords).toBe(12);
    expect(result.limit).toBe(12);
    expect(result.flagged).toBe(false);
  });

  it("flags just above the limit", () => {
    expect(checkLevel(`${words(13)}.`, "A2").flagged).toBe(true);
  });

  it("uses the limit of the level asked for", () => {
    const text = `${words(10)}.`;
    expect(checkLevel(text, "A1").flagged).toBe(true);
    expect(checkLevel(text, "B1").flagged).toBe(false);
  });

  it("reports zero for empty text and does not flag it", () => {
    expect(checkLevel("", "A1")).toEqual({ averageWords: 0, sentences: 0, limit: 8, flagged: false });
  });
});
