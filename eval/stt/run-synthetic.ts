import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT ?? "5188";

interface Item {
  id: string;
  written: string;
  hasError: boolean;
  errorType: string | null;
  corrected: string;
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type Outcome = "kept" | "silently-fixed" | "other";

export function classify(item: Pick<Item, "written" | "corrected">, heard: string): Outcome {
  const h = normalize(heard);
  if (h === normalize(item.written)) return "kept";
  if (h === normalize(item.corrected)) return "silently-fixed";
  return "other";
}

async function main(): Promise<void> {
  const set = JSON.parse(await readFile(join(here, "sentences-pt-PT.json"), "utf8")) as { items: Item[] };
  const dir = await mkdtemp(join(tmpdir(), "lr-eval-"));
  const results: Record<string, unknown>[] = [];
  const counts = { kept: 0, "silently-fixed": 0, other: 0 };
  let correctExact = 0;
  let correctTotal = 0;
  try {
    for (const item of set.items) {
      const file = join(dir, `${item.id}.aiff`);
      await run("say", ["-v", "Joana", "-o", file, item.written]);
      const audio = await readFile(file);
      const res = await fetch(`http://127.0.0.1:${port}/api/stt/local?lang=pt`, {
        method: "POST",
        headers: { "content-type": "audio/aiff" },
        body: audio,
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || typeof data.text !== "string") {
        throw new Error(`${item.id}: server answered ${res.status} ${data.error ?? ""}`);
      }
      if (item.hasError) {
        const outcome = classify(item, data.text);
        counts[outcome] += 1;
        results.push({ id: item.id, written: item.written, heard: data.text, errorType: item.errorType, outcome });
      } else {
        correctTotal += 1;
        const exact = normalize(data.text) === normalize(item.written);
        if (exact) correctExact += 1;
        results.push({ id: item.id, written: item.written, heard: data.text, exact });
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  const date = new Date().toISOString().slice(0, 10);
  const out = join(here, `results-synthetic-${date}.json`);
  await writeFile(
    out,
    JSON.stringify(
      {
        engine: "whisper.cpp via /api/stt/local",
        voice: "say -v Joana (synthetic, not a learner)",
        date,
        errorSentences: { total: counts.kept + counts["silently-fixed"] + counts.other, ...counts },
        correctSentences: { total: correctTotal, exact: correctExact },
        results,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`error sentences: kept ${counts.kept}, silently-fixed ${counts["silently-fixed"]}, other ${counts.other}`);
  console.log(`correct sentences: exact ${correctExact} of ${correctTotal}`);
  console.log(`wrote ${out}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
