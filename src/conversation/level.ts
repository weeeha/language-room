// Level guard (docs/spec.md section 5.6, point 6).
// It measures the character's reply. It never blocks or edits a reply.
import type { Level } from "../scenario/validate";

export const MAX_WORDS_PER_SENTENCE: Record<Level, number> = {
  A1: 8,
  A2: 12,
  B1: 16,
  B2: 20,
};

// A sentence ends at . ? ! or an ellipsis that is followed by white space or the end.
// A dot between digits (1.30) is not followed by white space, so it never splits.
const SENTENCE_END = /[.?!…]+(?=\s|$)/;

export function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let rest = text;
  for (;;) {
    const match = SENTENCE_END.exec(rest);
    if (!match) {
      sentences.push(rest);
      break;
    }
    const end = match.index + match[0].length;
    sentences.push(rest.slice(0, end));
    rest = rest.slice(end);
  }
  // Pieces made only of punctuation are dropped with the empty ones.
  return sentences.map((s) => s.trim()).filter((s) => /[\p{L}\p{N}]/u.test(s));
}

function countWords(sentence: string): number {
  return sentence
    .split(/\s+/)
    .filter((token) => token.length > 0 && /[\p{L}\p{N}]/u.test(token)).length;
}

function wordCounts(text: string): number[] {
  return splitSentences(text)
    .map(countWords)
    .filter((n) => n > 0);
}

export function averageSentenceLength(text: string): number {
  const counts = wordCounts(text);
  if (counts.length === 0) return 0;
  return counts.reduce((sum, n) => sum + n, 0) / counts.length;
}

export function checkLevel(
  text: string,
  level: Level,
): { averageWords: number; sentences: number; limit: number; flagged: boolean } {
  const counts = wordCounts(text);
  const limit = MAX_WORDS_PER_SENTENCE[level];
  const averageWords =
    counts.length === 0 ? 0 : counts.reduce((sum, n) => sum + n, 0) / counts.length;
  return { averageWords, sentences: counts.length, limit, flagged: averageWords > limit };
}
