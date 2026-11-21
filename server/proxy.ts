import { existsSync, readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createLocalStt, LocalSttError, type RunFn } from "./stt-local";

export type Env = Record<string, string | undefined>;

export interface ProxyOptions {
  env?: Env;
  fetch?: typeof fetch;
  sttRun?: RunFn;
  fileExists?: (path: string) => boolean;
}

const DEFAULT_LOCAL_URL = "http://127.0.0.1:11434/v1";
const MAX_BODY = 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 30_000;

/** Tiny .env parser. KEY=value lines, # comments, optional quotes. */
export function parseEnv(text: string): Env {
  const out: Env = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/** Reads .env from the project root. Missing file gives an empty object. */
export function loadDotEnv(): Env {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const file = join(root, ".env");
  if (!existsSync(file)) return {};
  return parseEnv(readFileSync(file, "utf8"));
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > MAX_BODY) throw new HttpError(413, "Body is too large");
    chunks.push(buf);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Body is not valid JSON");
  }
}

export function createProxy(opts: ProxyOptions = {}) {
  const env: Env = opts.env ?? { ...loadDotEnv(), ...process.env };
  const doFetch = opts.fetch ?? fetch;
  const paidOn = () => env.PAID_PROVIDERS === "on";
  const localUrl = () => (env.LOCAL_LLM_URL || DEFAULT_LOCAL_URL).replace(/\/+$/, "");
  let cachedModel: string | undefined;
  const localStt = createLocalStt({ env, run: opts.sttRun, fileExists: opts.fileExists });

  async function upstream(url: string, init: RequestInit): Promise<Response> {
    try {
      return await doFetch(url, { ...init, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    } catch {
      throw new HttpError(502, "Local model did not answer");
    }
  }

  async function localModel(): Promise<string> {
    if (env.LOCAL_LLM_MODEL) return env.LOCAL_LLM_MODEL;
    if (cachedModel) return cachedModel;
    const res = await upstream(`${localUrl()}/models`, { method: "GET" });
    if (!res.ok) throw new HttpError(502, "Local model list failed");
    const data = (await res.json().catch(() => null)) as { data?: { id?: string }[] } | null;
    const id = data?.data?.[0]?.id;
    if (!id) throw new HttpError(502, "Local model list was empty");
    cachedModel = id;
    return id;
  }

  async function localPayload(body: Record<string, unknown>, stream: boolean): Promise<string> {
    const provider = body.provider;
    if (provider === "claude") {
      if (!paidOn()) throw new HttpError(403, "Paid providers are off");
      throw new HttpError(501, "Claude adapter is not enabled in this build");
    }
    if (provider !== "local") throw new HttpError(400, "Unknown provider");
    if (!Array.isArray(body.messages)) throw new HttpError(400, "messages must be a list");
    const model = await localModel();
    const payload: Record<string, unknown> = { model, messages: body.messages };
    if (typeof body.temperature === "number") payload.temperature = body.temperature;
    if (typeof body.maxTokens === "number") payload.max_tokens = body.maxTokens;
    if (body.json === true) payload.response_format = { type: "json_object" };
    if (body.thinking !== true) payload.chat_template_kwargs = { enable_thinking: false };
    if (stream) payload.stream = true;
    return JSON.stringify(payload);
  }

  async function handleLlm(body: Record<string, unknown>): Promise<{ text: string }> {
    const res = await upstream(`${localUrl()}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await localPayload(body, false),
    });
    if (!res.ok) throw new HttpError(502, `Local model answered ${res.status}`);
    const data = (await res.json().catch(() => null)) as {
      choices?: { message?: { content?: string } }[];
    } | null;
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string") throw new HttpError(502, "Local model reply had no text");
    return { text };
  }

  /** Pulls the text out of one SSE event block, or null for [DONE] and events without text. */
  function sseText(block: string): string | null {
    let out: string | null = null;
    for (const line of block.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "" || data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
        const piece = parsed.choices?.[0]?.delta?.content;
        if (typeof piece === "string" && piece.length > 0) out = (out ?? "") + piece;
      } catch {
        // A malformed event is skipped.
      }
    }
    return out;
  }

  async function handleLlmStream(body: Record<string, unknown>, res: ServerResponse): Promise<void> {
    const up = await upstream(`${localUrl()}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await localPayload(body, true),
    });
    if (!up.ok) throw new HttpError(502, `Local model answered ${up.status}`);
    if (!up.body) throw new HttpError(502, "Local model reply had no body");
    const reader = up.body.getReader();
    res.on("close", () => void reader.cancel().catch(() => undefined));
    const decoder = new TextDecoder();
    let pending = "";
    let started = false;
    const write = (text: string | null) => {
      if (text === null) return;
      if (!started) {
        res.writeHead(200, {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
          "X-Accel-Buffering": "no",
        });
        started = true;
      }
      res.write(text);
    };
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        for (;;) {
          const m = /\r?\n\r?\n/.exec(pending);
          if (!m) break;
          write(sseText(pending.slice(0, m.index)));
          pending = pending.slice(m.index + m[0].length);
        }
      }
      write(sseText(pending));
    } catch {
      if (!started) throw new HttpError(502, "Local model stream failed");
    }
    if (!started) throw new HttpError(502, "Local model reply had no text");
    res.end();
  }

  /** Returns true when the request was handled. */
  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = req.url ?? "";
    const method = req.method ?? "";
    if (!url.startsWith("/api/")) return false;
    try {
      if (method === "GET" && url === "/api/config") {
        send(res, 200, {
          paidProviders: paidOn() ? "on" : "off",
          localLlm: { url: localUrl(), model: env.LOCAL_LLM_MODEL || cachedModel || null },
        });
        return true;
      }
      if (method === "POST" && url === "/api/llm") {
        const body = await readJson(req);
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
          throw new HttpError(400, "Body must be an object");
        }
        send(res, 200, await handleLlm(body as Record<string, unknown>));
        return true;
      }
      if (method === "POST" && url === "/api/llm/stream") {
        const body = await readJson(req);
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
          throw new HttpError(400, "Body must be an object");
        }
        await handleLlmStream(body as Record<string, unknown>, res);
        return true;
      }
      if (method === "POST" && (url === "/api/stt/local" || url.startsWith("/api/stt/local?"))) {
        const lang = new URL(url, "http://localhost").searchParams.get("lang");
        send(res, 200, await localStt(req, lang));
        return true;
      }
      if (method === "POST" && (url === "/api/stt" || url === "/api/tts")) {
        if (!paidOn()) throw new HttpError(403, "Paid providers are off");
        throw new HttpError(501, "Hosted provider is not enabled in this build");
      }
      return false;
    } catch (e) {
      if (e instanceof LocalSttError) send(res, e.status, { error: e.message });
      else if (e instanceof HttpError) send(res, e.status, { error: e.message });
      else send(res, 500, { error: "Server error" });
      return true;
    }
  };
}
