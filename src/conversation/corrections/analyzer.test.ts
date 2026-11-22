import { describe, expect, it } from "vitest";
import { parseAnalyzerOutput } from "./analyzer";

const line = "Queria uma café, por favor.";
const good = { span: "uma café", type: "grammar", suggestion: "um café", rule: "gender" };

describe("parseAnalyzerOutput", () => {
  it("parses plain JSON", () => {
    expect(parseAnalyzerOutput(JSON.stringify({ issues: [good] }), line)).toEqual([good]);
  });
  it("parses fenced JSON with stray text", () => {
    const text = "Here you go:\n```json\n" + JSON.stringify({ issues: [good] }) + "\n```\nDone.";
    expect(parseAnalyzerOutput(text, line)).toEqual([good]);
  });
  it("accepts a bare array", () => {
    expect(parseAnalyzerOutput(JSON.stringify([good]), line)).toEqual([good]);
  });
  it("returns [] on garbage", () => {
    expect(parseAnalyzerOutput("no idea", line)).toEqual([]);
    expect(parseAnalyzerOutput("{bad json", line)).toEqual([]);
  });
  it("drops a span that is not in the line", () => {
    expect(parseAnalyzerOutput(JSON.stringify({ issues: [{ ...good, span: "uma mesa" }] }), line)).toEqual([]);
  });
  it("drops a suggestion equal to the span", () => {
    expect(parseAnalyzerOutput(JSON.stringify({ issues: [{ ...good, suggestion: "uma café" }] }), line)).toEqual([]);
  });
  it("drops an unknown type", () => {
    expect(parseAnalyzerOutput(JSON.stringify({ issues: [{ ...good, type: "spelling" }] }), line)).toEqual([]);
  });
});
