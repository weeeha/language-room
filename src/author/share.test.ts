import { describe, expect, it } from "vitest";
import { validScenario } from "../scenario/fixture";
import { validateScenario, type Scenario } from "../scenario/validate";
import { bundledLink, browserCodec, decodePayload, encodePayload, fromBase64Url, linkWarning, shareLink, toBase64Url, type Codec } from "./share";

const base = (): Scenario => validScenario() as unknown as Scenario;
const unreviewed = (): Scenario => {
  const s = base();
  delete s.reviewed;
  return s;
};

// A stand-in codec that is easy to read in a failure: it reverses the bytes.
const reverse: Codec = {
  compress: async (b) => Uint8Array.from(b).reverse(),
  decompress: async (b) => Uint8Array.from(b).reverse(),
};

describe("base64url", () => {
  it("round trips bytes with no padding or unsafe characters", () => {
    const bytes = Uint8Array.from({ length: 300 }, (_, i) => (i * 7) % 256);
    const text = toBase64Url(bytes);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Array.from(fromBase64Url(text) ?? [])).toEqual(Array.from(bytes));
  });
  it("rejects other characters and impossible lengths", () => {
    expect(fromBase64Url("ab+/")).toBeNull();
    expect(fromBase64Url("a")).toBeNull();
    expect(fromBase64Url("")).toEqual(new Uint8Array());
  });
});

describe("share payload", () => {
  it("round trips with no compression (p.)", async () => {
    const payload = await encodePayload(base(), {});
    expect(payload.startsWith("p.")).toBe(true);
    const back = await decodePayload(payload, {});
    expect(back.ok && back.scenario).toEqual(base());
  });
  it("round trips with an injected codec (z.)", async () => {
    const payload = await encodePayload(base(), reverse);
    expect(payload.startsWith("z.")).toBe(true);
    const back = await decodePayload(payload, reverse);
    expect(back.ok && back.scenario).toEqual(base());
  });
  it("round trips with the browser codec when this runtime has one", async () => {
    const codec = browserCodec();
    if (!codec.compress) return;
    const payload = await encodePayload(base(), codec);
    expect(payload.startsWith("z.")).toBe(true);
    const plain = await encodePayload(base(), {});
    expect(payload.length).toBeLessThan(plain.length);
    const back = await decodePayload(payload, codec);
    expect(back.ok && back.scenario).toEqual(base());
  });
  it("accepts a leading # as the address gives it", async () => {
    const payload = await encodePayload(base(), {});
    expect((await decodePayload(`#${payload}`, {})).ok).toBe(true);
  });
});

describe("a tampered or invalid payload is rejected", () => {
  it("rejects an empty payload and an unknown prefix", async () => {
    expect((await decodePayload("", {})).ok).toBe(false);
    expect((await decodePayload("q.abcd", {})).ok).toBe(false);
  });
  it("rejects damaged base64", async () => {
    const r = await decodePayload("p.@@@@", {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toContain("damaged");
  });
  it("rejects data that is not JSON", async () => {
    const r = await decodePayload(`p.${toBase64Url(new TextEncoder().encode("not json"))}`, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toContain("could not parse");
  });
  it("returns the validator's errors for a scenario that fails validation, and stores nothing", async () => {
    const bad = { ...base(), level: "C2" } as unknown as Scenario;
    const expected = validateScenario(bad);
    const r = await decodePayload(await encodePayload(bad, {}), {});
    expect(r.ok).toBe(false);
    if (!r.ok && !expected.valid) expect(r.errors).toEqual(expected.errors);
  });
  it("rejects a compressed link when the browser cannot decompress", async () => {
    const payload = await encodePayload(base(), reverse);
    const r = await decodePayload(payload, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toContain("cannot open");
  });
  it("rejects compressed data that does not decompress", async () => {
    const bad: Codec = { decompress: async () => Promise.reject(new Error("bad")) };
    expect((await decodePayload(`z.${toBase64Url(Uint8Array.of(1, 2, 3))}`, bad)).ok).toBe(false);
  });
  it("rejects a payload with one character changed when the result no longer validates", async () => {
    const payload = await encodePayload(unreviewed(), {});
    const at = payload.length - 20;
    const flipped = payload.slice(0, at) + (payload[at] === "A" ? "B" : "A") + payload.slice(at + 1);
    const r = await decodePayload(flipped, {});
    // Either the JSON breaks or a value changes. A broken result must never come back as ok with errors.
    if (r.ok) expect(validateScenario(r.scenario).valid).toBe(true);
    else expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe("review state travels exactly as the payload says", () => {
  it("an unreviewed scenario stays unreviewed after the link", async () => {
    const r = await decodePayload(await encodePayload(unreviewed(), {}), {});
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.scenario.reviewed).toBeUndefined();
      const v = validateScenario(r.scenario);
      expect(v.valid && v.listed).toBe(false);
    }
  });
  it("a reviewed scenario keeps its block", async () => {
    const r = await decodePayload(await encodePayload(base(), {}), {});
    expect(r.ok && r.scenario.reviewed).toEqual({ by: "fluent-reviewer-id", on: "2026-11-01" });
  });
});

describe("links", () => {
  it("builds the import link and the bundled link", () => {
    expect(shareLink("https://x.test", "p.abc")).toBe("https://x.test/s/import#p.abc");
    expect(bundledLink("https://x.test", "lisbon-cafe-pt")).toBe("https://x.test/s/lisbon-cafe-pt");
  });
  it("warns above 8000 characters and not at 8000", () => {
    expect(linkWarning("x".repeat(8000))).toBeNull();
    expect(linkWarning("x".repeat(8001))).toContain("8001");
  });
});
