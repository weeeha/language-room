// Share links for a class. There are no accounts and no server storage (docs/spec.md section 2),
// so a local scenario travels inside the link: /s/import#<payload>. The payload is the scenario
// JSON, compressed with deflate-raw when the browser can, then base64url. Pure apart from the
// browser codec, which tests replace.
import { loadScenario } from "../scenario/load";
import type { Scenario } from "../scenario/validate";

export const MAX_LINK_LENGTH = 8000;
const MAX_PAYLOAD_LENGTH = 400_000;
const MAX_JSON_BYTES = 1_000_000;

export const SHARE_NOTE = "The link carries the scenario text only. The scene file stays on your computer.";

export interface Codec {
  compress?(bytes: Uint8Array): Promise<Uint8Array>;
  decompress?(bytes: Uint8Array): Promise<Uint8Array>;
}

const ALPHABET = /^[A-Za-z0-9_-]*$/;

export function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Null for anything that is not base64url. */
export function fromBase64Url(text: string): Uint8Array | null {
  if (!ALPHABET.test(text) || text.length % 4 === 1) return null;
  const pad = text.length % 4 === 0 ? "" : "=".repeat(4 - (text.length % 4));
  try {
    const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/") + pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

interface TransformLike {
  writable: WritableStream;
  readable: ReadableStream<Uint8Array>;
}
type StreamCtor = new (format: string) => TransformLike;

async function pipe(bytes: Uint8Array, stream: TransformLike, cap: number): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  void writer.write(bytes as unknown as BufferSource as Uint8Array<ArrayBuffer>).then(() => writer.close()).catch(() => undefined);
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > cap) {
      void reader.cancel();
      throw new Error("The data is larger than a scenario can be.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** The browser's deflate-raw codec, or an empty codec when CompressionStream is missing. */
export function browserCodec(): Codec {
  const g = globalThis as { CompressionStream?: StreamCtor; DecompressionStream?: StreamCtor };
  if (typeof g.CompressionStream !== "function" || typeof g.DecompressionStream !== "function") return {};
  const C = g.CompressionStream;
  const D = g.DecompressionStream;
  return {
    compress: (bytes) => pipe(bytes, new C("deflate-raw"), MAX_JSON_BYTES * 2),
    decompress: (bytes) => pipe(bytes, new D("deflate-raw"), MAX_JSON_BYTES),
  };
}

/** "z." plus compressed data when a compressor exists, else "p." plus the plain JSON. */
export async function encodePayload(scenario: Scenario, codec: Codec = browserCodec()): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(scenario));
  if (codec.compress) return `z.${toBase64Url(await codec.compress(bytes))}`;
  return `p.${toBase64Url(bytes)}`;
}

export type DecodeResult = { ok: true; scenario: Scenario } | { ok: false; errors: string[] };

/** Reads a payload and runs the validator. A bad or altered payload gives errors and no scenario. */
export async function decodePayload(payload: string, codec: Codec = browserCodec()): Promise<DecodeResult> {
  const text = payload.startsWith("#") ? payload.slice(1) : payload;
  if (text.length === 0) return { ok: false, errors: ["link: this link has no scenario in it"] };
  if (text.length > MAX_PAYLOAD_LENGTH) return { ok: false, errors: ["link: the data is larger than a scenario can be"] };
  const kind = text.slice(0, 2);
  if (kind !== "z." && kind !== "p.") return { ok: false, errors: ["link: this is not a scenario link"] };
  const raw = fromBase64Url(text.slice(2));
  if (!raw) return { ok: false, errors: ["link: the data in the link is damaged"] };
  let bytes = raw;
  if (kind === "z.") {
    if (!codec.decompress) return { ok: false, errors: ["link: this browser cannot open a compressed link"] };
    try {
      bytes = await codec.decompress(raw);
    } catch {
      return { ok: false, errors: ["link: the data in the link is damaged"] };
    }
  }
  let json: string;
  try {
    json = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, errors: ["link: the data in the link is damaged"] };
  }
  const result = loadScenario(json);
  return result.valid ? { ok: true, scenario: result.scenario } : { ok: false, errors: result.errors };
}

export function shareLink(origin: string, payload: string): string {
  return `${origin}/s/import#${payload}`;
}

/** A plain link to a bundled scenario. */
export function bundledLink(origin: string, id: string): string {
  return `${origin}/s/${encodeURIComponent(id)}`;
}

export function linkWarning(link: string): string | null {
  return link.length > MAX_LINK_LENGTH
    ? `This link is ${link.length} characters long. Some chat and mail programs cut links above ${MAX_LINK_LENGTH}. Export the file and share that instead.`
    : null;
}
