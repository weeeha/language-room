import { describe, expect, it } from "vitest";
import { parseReviewerOutput } from "./reviewer";

describe("parseReviewerOutput", () => {
  it("parses a verdict", () => {
    expect(parseReviewerOutput('{"verdict":"correct","reason":"Wrong gender."}')).toEqual({
      verdict: "correct",
      reason: "Wrong gender.",
      varietyNote: false,
    });
  });
  it("parses fenced JSON and the variety note", () => {
    const out = parseReviewerOutput('```json\n{"verdict":"incorrect","reason":"Brazilian form.","varietyNote":true}\n```');
    expect(out.verdict).toBe("incorrect");
    expect(out.varietyNote).toBe(true);
  });
  it("turns an unknown verdict into unsure", () => {
    expect(parseReviewerOutput('{"verdict":"maybe","reason":"x"}').verdict).toBe("unsure");
  });
  it("turns garbage into unsure", () => {
    expect(parseReviewerOutput("whatever").verdict).toBe("unsure");
  });
});
