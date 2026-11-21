// Text matching used by the recap. Case, punctuation and extra spaces are ignored. Accents are kept.
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

/** True when the words of needle appear in order, as whole words, inside haystack. */
export function containsPhrase(haystack: string, needle: string): boolean {
  const n = normalize(needle);
  if (n === "") return false;
  return ` ${normalize(haystack)} `.includes(` ${n} `);
}
