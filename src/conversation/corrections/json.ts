// Tolerant JSON extraction for small-model output: code fences and stray text.
export function extractJson(text: string): unknown {
  const tryParse = (s: string): unknown => {
    try {
      return JSON.parse(s);
    } catch {
      return undefined;
    }
  };
  const direct = tryParse(text.trim());
  if (direct !== undefined) return direct;
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fence?.[1]) {
    const v = tryParse(fence[1].trim());
    if (v !== undefined) return v;
  }
  for (const [open, close] of [
    ["{", "}"],
    ["[", "]"],
  ] as const) {
    const a = text.indexOf(open);
    const b = text.lastIndexOf(close);
    if (a !== -1 && b > a) {
      const v = tryParse(text.slice(a, b + 1));
      if (v !== undefined) return v;
    }
  }
  return undefined;
}
