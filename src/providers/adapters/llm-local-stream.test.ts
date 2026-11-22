import { describe, expect, it } from "vitest";
import { createLocalLlm } from "./llm-local";

function streamResponse(parts: string[]): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const p of parts) c.enqueue(enc.encode(p));
      c.close();
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
}

describe("createLocalLlm completeStream", () => {
  it("posts to /api/llm/stream and hands each text chunk to onDelta", async () => {
    let url = "";
    let sent: Record<string, unknown> = {};
    const llm = createLocalLlm({
      fetch: (async (u: string, init: RequestInit) => {
        url = u;
        sent = JSON.parse(String(init.body));
        return streamResponse(["Bom ", "dia", "."]);
      }) as unknown as typeof fetch,
    });
    const deltas: string[] = [];
    const r = await llm.completeStream!(
      { messages: [{ role: "user", content: "oi" }], maxTokens: 40 },
      (d) => deltas.push(d),
    );
    expect(url).toBe("/api/llm/stream");
    expect(sent.provider).toBe("local");
    expect(sent.maxTokens).toBe(40);
    expect(deltas).toEqual(["Bom ", "dia", "."]);
    expect(r.text).toBe("Bom dia.");
  });

  it("throws the server error message on a non-ok reply", async () => {
    const llm = createLocalLlm({
      fetch: (async () =>
        new Response(JSON.stringify({ error: "Local model did not answer" }), {
          status: 502,
        })) as unknown as typeof fetch,
    });
    await expect(llm.completeStream!({ messages: [] }, () => {})).rejects.toThrow(
      "Local model did not answer",
    );
  });
});
