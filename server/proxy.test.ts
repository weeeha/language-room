import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "./index";
import type { Server } from "node:http";

let server: Server | undefined;

afterEach(async () => {
  await new Promise<void>((r) => (server ? server.close(() => r()) : r()));
  server = undefined;
});

async function start(env: Record<string, string>, fetchImpl: typeof fetch) {
  server = createServer({ env, fetch: fetchImpl });
  await new Promise<void>((r) => server!.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;
  return {
    get: (path: string) => fetch(base + path),
    post: (path: string, body: unknown) =>
      fetch(base + path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
  };
}

function upstreamFetch() {
  return vi.fn(async (url: string | URL | Request, ...rest: [RequestInit?]) => {
    void rest;
    const u = String(url);
    if (u.endsWith("/models")) {
      return new Response(JSON.stringify({ data: [{ id: "m1" }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: "Bom dia." } }] }), { status: 200 });
  });
}

describe("GET /api/config", () => {
  it("never contains a key value", async () => {
    const f = upstreamFetch();
    const api = await start(
      { ANTHROPIC_API_KEY: "sk-test-planted", WLT_API_KEY: "wlt-planted", PAID_PROVIDERS: "off" },
      f as unknown as typeof fetch,
    );
    const res = await api.get("/api/config");
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).not.toContain("sk-test-planted");
    expect(text).not.toContain("wlt-planted");
    expect(JSON.parse(text).paidProviders).toBe("off");
    expect(f).toHaveBeenCalledTimes(0);
  });

  it("reports on only for the exact string on", async () => {
    const f = upstreamFetch();
    const on = await start({ PAID_PROVIDERS: "on" }, f as unknown as typeof fetch);
    expect((await (await on.get("/api/config")).json()).paidProviders).toBe("on");
  });
});

describe("POST /api/llm", () => {
  it("answers 403 for claude when paid is off and makes no outbound request", async () => {
    const f = upstreamFetch();
    const api = await start({ PAID_PROVIDERS: "off" }, f as unknown as typeof fetch);
    const res = await api.post("/api/llm", { provider: "claude", messages: [] });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Paid providers are off" });
    expect(f).toHaveBeenCalledTimes(0);
  });

  it("answers 501 for claude when paid is on", async () => {
    const f = upstreamFetch();
    const api = await start({ PAID_PROVIDERS: "on" }, f as unknown as typeof fetch);
    const res = await api.post("/api/llm", { provider: "claude", messages: [] });
    expect(res.status).toBe(501);
    expect(f).toHaveBeenCalledTimes(0);
  });

  it("forwards messages to the local model and returns text", async () => {
    const f = upstreamFetch();
    const api = await start({ LOCAL_LLM_URL: "http://local/v1" }, f as unknown as typeof fetch);
    const messages = [{ role: "user", content: "oi" }];
    const res = await api.post("/api/llm", { provider: "local", messages, maxTokens: 20, temperature: 0.1 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "Bom dia." });
    const chat = f.mock.calls.find((c) => String(c[0]).endsWith("/chat/completions"));
    expect(String(chat?.[0])).toBe("http://local/v1/chat/completions");
    const sent = JSON.parse(String(chat?.[1]?.body));
    expect(sent).toMatchObject({ model: "m1", messages, max_tokens: 20, temperature: 0.1 });
  });

  it("caches the model id", async () => {
    const f = upstreamFetch();
    const api = await start({}, f as unknown as typeof fetch);
    await api.post("/api/llm", { provider: "local", messages: [] });
    await api.post("/api/llm", { provider: "local", messages: [] });
    expect(f.mock.calls.filter((c) => String(c[0]).endsWith("/models"))).toHaveLength(1);
  });

  it("answers 502 when the upstream fails", async () => {
    const f = vi.fn(async () => {
      throw new Error("connection refused");
    });
    const api = await start({ LOCAL_LLM_MODEL: "m1" }, f as unknown as typeof fetch);
    const res = await api.post("/api/llm", { provider: "local", messages: [] });
    expect(res.status).toBe(502);
    expect(typeof (await res.json()).error).toBe("string");
  });

  it("answers 502 when the upstream replies with an error status", async () => {
    const f = vi.fn(async () => new Response("boom", { status: 500 }));
    const api = await start({ LOCAL_LLM_MODEL: "m1" }, f as unknown as typeof fetch);
    expect((await api.post("/api/llm", { provider: "local", messages: [] })).status).toBe(502);
  });

  it("answers 400 for an unknown provider and for bad JSON", async () => {
    const f = upstreamFetch();
    const api = await start({}, f as unknown as typeof fetch);
    expect((await api.post("/api/llm", { provider: "nope", messages: [] })).status).toBe(400);
    expect((await api.post("/api/llm", "{not json")).status).toBe(400);
  });

  it("answers 413 for a body over 1 MB", async () => {
    const f = upstreamFetch();
    const api = await start({}, f as unknown as typeof fetch);
    const big = JSON.stringify({ provider: "local", messages: [{ role: "user", content: "x".repeat(1_100_000) }] });
    expect((await api.post("/api/llm", big)).status).toBe(413);
  });
});

describe("POST /api/stt and /api/tts", () => {
  it("answer 403 when paid is off and 501 when on", async () => {
    const f = upstreamFetch();
    const off = await start({ PAID_PROVIDERS: "off" }, f as unknown as typeof fetch);
    expect((await off.post("/api/stt", {})).status).toBe(403);
    expect((await off.post("/api/tts", {})).status).toBe(403);
    await new Promise<void>((r) => server!.close(() => r()));
    const on = await start({ PAID_PROVIDERS: "on" }, f as unknown as typeof fetch);
    expect((await on.post("/api/stt", {})).status).toBe(501);
    expect((await on.post("/api/tts", {})).status).toBe(501);
    expect(f).toHaveBeenCalledTimes(0);
  });
});

describe("health still works", () => {
  it("GET /health", async () => {
    const api = await start({}, upstreamFetch() as unknown as typeof fetch);
    expect((await api.get("/health")).status).toBe(200);
  });
});
