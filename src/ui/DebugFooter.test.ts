import { describe, expect, it } from "vitest";
import { formatCounts, formatMedian } from "./DebugFooter";

describe("debug footer text", () => {
  it("counts the three kinds of call", () => {
    expect(formatCounts({ llm: 7, stt: 2, tts: 3 })).toBe("Calls this session: language model 7, speech to text 2, speech 3.");
  });
  it("shows the median in seconds once there is one", () => {
    expect(formatMedian(null)).toBeNull();
    expect(formatMedian(1234)).toBe("Median reply time: 1.2 s.");
  });
});
