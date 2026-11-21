import { describe, expect, it } from "vitest";
import { buildConfirmedTurn, LOW_CONFIDENCE, type ConfirmedTurn } from "./HeardConfirm";

// A send function that accepts only a confirmed turn.
function send(turn: ConfirmedTurn): string {
  return turn.text;
}

describe("buildConfirmedTurn", () => {
  it("is the only way to get a value that send accepts", () => {
    // @ts-expect-error a plain string is not a confirmed turn
    send("Queria uma café");
    // @ts-expect-error a plain object is not a confirmed turn
    send({ text: "Queria uma café", heardText: "Queria uma café", lowConfidenceWords: [] });
    const turn = buildConfirmedTurn({ text: "Bom dia." }, null);
    expect(turn).not.toBeNull();
    expect(send(turn!)).toBe("Bom dia.");
  });

  it("keeps heard text and low confidence words when not edited", () => {
    const turn = buildConfirmedTurn(
      {
        text: " A conta, por favor. ",
        words: [
          { text: "A", confidence: 0.99 },
          { text: "conta", confidence: 0.4 },
          { text: "por", confidence: LOW_CONFIDENCE },
          { text: "favor", confidence: 0.59 },
        ],
      },
      null,
    );
    expect(turn).toMatchObject({
      text: "A conta, por favor.",
      heardText: " A conta, por favor. ",
      lowConfidenceWords: ["conta", "favor"],
    });
  });

  it("uses the edited text, trimmed, and drops low confidence words", () => {
    const turn = buildConfirmedTurn(
      { text: "A conta", words: [{ text: "conta", confidence: 0.1 }] },
      "  A conta, por favor.  ",
    );
    expect(turn).toMatchObject({
      text: "A conta, por favor.",
      heardText: "A conta",
      lowConfidenceWords: [],
    });
  });

  it("keeps low confidence words when the edit left the text unchanged", () => {
    const turn = buildConfirmedTurn(
      { text: "A conta", words: [{ text: "conta", confidence: 0.1 }] },
      "A conta",
    );
    expect(turn?.lowConfidenceWords).toEqual(["conta"]);
  });

  it("returns null for empty or whitespace only text", () => {
    expect(buildConfirmedTurn({ text: "   " }, null)).toBeNull();
    expect(buildConfirmedTurn({ text: "Bom dia." }, "  \n ")).toBeNull();
    expect(buildConfirmedTurn({ text: "" }, "")).toBeNull();
  });
});
