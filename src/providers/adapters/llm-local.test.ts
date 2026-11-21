import { describe, expect, it, vi } from "vitest";
import { createLocalLlm } from "./llm-local";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("createLocalLlm", () => {
  it("posts the expected request and returns the text", async () => {
    const fetchSpy = vi.fn(async () => jsonResponse({ text: "Bom dia." }));
    const llm = createLocalLlm({ fetch: fetchSpy as unknown as typeof fetch, baseUrl: "http://x" });
    const out = await llm.complete({
      messages: [{ role: "user", content: "oi" }],
      temperature: 0.2,
      maxTokens: 20,
      json: true,
    });
    expect(out).toEqual({ text: "Bom dia." });
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://x/api/llm");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      provider: "local",
      messages: [{ role: "user", content: "oi" }],
      temperature: 0.2,
      maxTokens: 20,
      json: true,
    });
  });

  it("throws the server error message on a non-2xx reply", async () => {
    const fetchSpy = vi.fn(async () => jsonResponse({ error: "Upstream failed" }, 502));
    const llm = createLocalLlm({ fetch: fetchSpy as unknown as typeof fetch });
    await expect(llm.complete({ messages: [] })).rejects.toThrow("Upstream failed");
  });

  it("is free", () => {
    expect(createLocalLlm().paid).toBe(false);
    expect(createLocalLlm().id).toBe("llm-local");
  });
});
