import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "./index";
import { parseWhisperJson, type RunFn } from "./stt-local";

const fixture = JSON.parse(readFileSync(new URL("./stt-local.fixture.json", import.meta.url), "utf8"));

describe("parseWhisperJson", () => {
  it("merges sub-word tokens, skips special tokens and takes the minimum probability", () => {
    const r = parseWhisperJson(fixture);
    expect(r.text).toBe("Queria uma café, por favor.");
    expect(r.words.map((w) => w.text)).toEqual(["Queria", "uma", "café", "por", "favor"]);
    expect(r.words[0]?.confidence).toBeCloseTo(0.97482, 5);
    expect(r.words[2]?.confidence).toBeCloseTo(0.995239, 5);
  });

  it("returns nothing for an empty result", () => {
    expect(parseWhisperJson({})).toEqual({ text: "", words: [] });
  });
});

let server: Server | undefined;
afterEach(async () => {
  await new Promise<void>((r) => (server ? server.close(() => r()) : r()));
  server = undefined;
});

async function start(sttRun: RunFn, fileExists = () => true) {
  server = createServer({ env: { WHISPER_MODEL: "/m/ggml-test.bin" }, sttRun, fileExists });
  await new Promise<void>((r) => server!.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return (path: string, body: Uint8Array | string = new Uint8Array([1, 2, 3])) =>
    fetch(base + path, { method: "POST", headers: { "content-type": "audio/webm" }, body: body as BodyInit });
}

function fakeRun(calls: { file: string; args: string[] }[]): RunFn {
  return async (file, args) => {
    calls.push({ file, args });
    if (file === "whisper-cli") {
      const of = args[args.indexOf("-of") + 1]!;
      await writeFile(`${of}.json`, JSON.stringify(fixture));
    }
    return { stdout: "" };
  };
}

describe("POST /api/stt/local", () => {
  it("converts, transcribes, returns words and removes the temp dir", async () => {
    const calls: { file: string; args: string[] }[] = [];
    const post = await start(fakeRun(calls));
    const res = await post("/api/stt/local?lang=pt");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("Queria uma café, por favor.");
    expect(body.engine).toBe("whisper.cpp");
    expect(body.model).toBe("ggml-test.bin");
    expect(calls.map((c) => c.file)).toEqual(["ffmpeg", "whisper-cli"]);
    expect(calls[1]!.args).toEqual(expect.arrayContaining(["-m", "/m/ggml-test.bin", "-l", "pt", "-ojf", "-np"]));
    const wav = calls[1]!.args.at(-1)!;
    expect(wav.startsWith(tmpdir()) || wav.includes("lr-stt-")).toBe(true);
    expect(existsSync(wav)).toBe(false);
  });

  it("removes the temp dir when whisper fails", async () => {
    let wav = "";
    const post = await start(async (file, args) => {
      if (file === "whisper-cli") {
        wav = args.at(-1)!;
        throw new Error("boom");
      }
      return { stdout: "" };
    });
    const res = await post("/api/stt/local?lang=pt");
    expect(res.status).toBe(502);
    expect(existsSync(wav)).toBe(false);
  });

  it("rejects a bad lang", async () => {
    const post = await start(fakeRun([]));
    expect((await post("/api/stt/local?lang=por")).status).toBe(400);
    expect((await post("/api/stt/local?lang=p;")).status).toBe(400);
    expect((await post("/api/stt/local")).status).toBe(400);
  });

  it("answers 503 naming a missing model", async () => {
    const post = await start(fakeRun([]), () => false);
    const res = await post("/api/stt/local?lang=pt");
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain("model");
  });

  it("answers 503 naming a missing binary", async () => {
    const post = await start(async (file) => {
      throw Object.assign(new Error("nope"), { code: "ENOENT", file });
    });
    const res = await post("/api/stt/local?lang=pt");
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain("ffmpeg");
  });

  it("answers 413 above 10 MB and 400 for an empty body", async () => {
    const post = await start(fakeRun([]));
    expect((await post("/api/stt/local?lang=pt", new Uint8Array(10 * 1024 * 1024 + 1))).status).toBe(413);
    expect((await post("/api/stt/local?lang=pt", "")).status).toBe(400);
  });
});
