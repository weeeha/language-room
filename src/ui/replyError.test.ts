import { describe, expect, it } from "vitest";
import { replyErrorCopy } from "./replyError";

describe("replyErrorCopy", () => {
  it("keeps the timeout copy for timeouts", () => {
    expect(replyErrorCopy("Dona Amélia", true)).toBe("Dona Amélia did not answer in time. Your line is kept.");
  });
  it("uses the other copy for every other failure", () => {
    expect(replyErrorCopy("Dona Amélia", false)).toBe("Dona Amélia could not answer. Your line is kept.");
  });
});
