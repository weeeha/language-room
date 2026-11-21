// Words per sentence over the character lines of a session export (docs/spec.md section 6, criterion 6).
import { checkLevel } from "../src/conversation/level";
import type { Level } from "../src/scenario/validate";

export interface LevelLine {
  text: string;
  words: number;
  sentences: number;
  average: number;
}

export interface LevelReport {
  level: Level;
  limit: number;
  lines: LevelLine[];
  average: number;
  pass: boolean;
}

interface TurnLike {
  role?: unknown;
  text?: unknown;
}

/** Accepts a session export ({ turns }), or the sheet's JSON twin ({ session: { turns }, level }). */
export function levelReport(data: unknown, levelOverride?: string): LevelReport {
  const root = (data ?? {}) as { turns?: unknown; session?: { turns?: unknown }; level?: unknown };
  const turns = Array.isArray(root.turns) ? root.turns : Array.isArray(root.session?.turns) ? root.session.turns : null;
  if (!turns) throw new Error("No turns found. Expected a session export or the sheet JSON.");
  const levelName = levelOverride ?? (typeof root.level === "string" ? root.level : "A2");
  if (!["A1", "A2", "B1", "B2"].includes(levelName)) throw new Error(`Unknown level ${levelName}`);
  const level = levelName as Level;
  const lines: LevelLine[] = [];
  let limit = 0;
  for (const t of turns as TurnLike[]) {
    if (t.role !== "character" || typeof t.text !== "string") continue;
    const r = checkLevel(t.text, level);
    limit = r.limit;
    lines.push({ text: t.text, words: Math.round(r.averageWords * r.sentences), sentences: r.sentences, average: r.averageWords });
  }
  const words = lines.reduce((n, l) => n + l.words, 0);
  const sentences = lines.reduce((n, l) => n + l.sentences, 0);
  const average = sentences === 0 ? 0 : words / sentences;
  return { level, limit: limit || checkLevel("x", level).limit, lines, average, pass: average <= (limit || checkLevel("x", level).limit) };
}
