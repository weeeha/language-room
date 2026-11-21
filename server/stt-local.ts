import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const RUN_TIMEOUT_MS = 120_000;

export type RunFn = (file: string, args: string[]) => Promise<{ stdout: string }>;

export interface LocalSttOptions {
  env: Record<string, string | undefined>;
  run?: RunFn;
  fileExists?: (path: string) => boolean;
}

export interface LocalSttReply {
  text: string;
  words: { text: string; confidence: number }[];
  engine: "whisper.cpp";
  model: string;
}

export class LocalSttError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const defaultRun: RunFn = (file, args) =>
  new Promise((resolve, reject) => {
    execFile(file, args, { timeout: RUN_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err);
      else resolve({ stdout });
    });
  });

interface WhisperToken {
  text?: string;
  p?: number;
}
interface WhisperJson {
  transcription?: { text?: string; tokens?: WhisperToken[] }[];
}

const PUNCT_ONLY = /^[\p{P}\p{S}\s]*$/u;

/**
 * Turns whisper-cli full JSON into text and words.
 * A token that starts with a space begins a new word. Tokens without a leading space
 * continue the word before them. Special tokens such as [_BEG_] are skipped.
 * A word takes the lowest probability of its letter tokens. Punctuation joins the
 * word before it and does not change its confidence.
 */
export function parseWhisperJson(json: unknown): { text: string; words: { text: string; confidence: number }[] } {
  const data = (json ?? {}) as WhisperJson;
  const segments = data.transcription ?? [];
  const text = segments
    .map((s) => s.text ?? "")
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  const words: { raw: string; conf: number | null }[] = [];
  for (const seg of segments) {
    for (const tok of seg.tokens ?? []) {
      const t = tok.text ?? "";
      if (t.startsWith("[_")) continue;
      if (t.trim() === "") continue;
      const startsWord = /^\s/.test(t);
      const letters = !PUNCT_ONLY.test(t);
      const p = typeof tok.p === "number" ? tok.p : 0;
      const last = words[words.length - 1];
      if (startsWord || !last) {
        words.push({ raw: t.trim(), conf: letters ? p : null });
      } else {
        last.raw += t;
        if (letters) last.conf = last.conf === null ? p : Math.min(last.conf, p);
      }
    }
  }
  return {
    text,
    words: words
      .map((w) => ({
        text: w.raw.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, ""),
        confidence: w.conf ?? 1,
      }))
      .filter((w) => w.text !== ""),
  };
}

async function readRaw(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > MAX_AUDIO_BYTES) throw new LocalSttError(413, "Audio is larger than 10 MB");
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

function isMissing(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "ENOENT";
}

export function createLocalStt(opts: LocalSttOptions) {
  const run = opts.run ?? defaultRun;
  const fileExists = opts.fileExists ?? existsSync;
  const whisper = opts.env.WHISPER_CLI || "whisper-cli";
  const ffmpeg = opts.env.FFMPEG || "ffmpeg";
  const model = opts.env.WHISPER_MODEL || join(homedir(), "whisper.cpp/models/ggml-large-v3-turbo.bin");

  return async function transcribe(req: IncomingMessage, lang: string | null): Promise<LocalSttReply> {
    if (!lang || !/^[a-z]{2}$/.test(lang)) {
      throw new LocalSttError(400, "lang must be a 2-letter code such as pt");
    }
    if (!fileExists(model)) {
      throw new LocalSttError(503, `Whisper model file is missing: ${model}`);
    }
    const audio = await readRaw(req);
    if (audio.length === 0) throw new LocalSttError(400, "Body is empty");
    const dir = await mkdtemp(join(tmpdir(), "lr-stt-"));
    try {
      const input = join(dir, "in");
      const wav = join(dir, "out.wav");
      const out = join(dir, "result");
      await writeFile(input, audio);
      try {
        await run(ffmpeg, ["-loglevel", "error", "-y", "-i", input, "-ar", "16000", "-ac", "1", wav]);
      } catch (e) {
        if (isMissing(e)) throw new LocalSttError(503, `ffmpeg is missing: ${ffmpeg}`);
        throw new LocalSttError(400, "Audio could not be read");
      }
      try {
        await run(whisper, ["-m", model, "-l", lang, "-ojf", "-of", out, "-np", wav]);
      } catch (e) {
        if (isMissing(e)) throw new LocalSttError(503, `whisper-cli is missing: ${whisper}`);
        throw new LocalSttError(502, "Whisper failed");
      }
      let json: unknown;
      try {
        json = JSON.parse(await readFile(`${out}.json`, "utf8"));
      } catch {
        throw new LocalSttError(502, "Whisper gave no readable result");
      }
      const parsed = parseWhisperJson(json);
      return { ...parsed, engine: "whisper.cpp", model: basename(model) };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  };
}
