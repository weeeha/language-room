// Route parsing (docs/spec.md section 3). Pure: no DOM.
export type Route =
  | { name: "library" }
  | { name: "brief"; id: string }
  | { name: "play"; id: string }
  | { name: "recap"; id: string; sessionId: string }
  | { name: "not-found" };

function decode(part: string): string | null {
  try {
    const out = decodeURIComponent(part);
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

export function parseRoute(pathname: string): Route {
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (trimmed === "/" || trimmed === "") return { name: "library" };
  const parts = trimmed.split("/").slice(1);
  if (parts[0] !== "s") return { name: "not-found" };
  const id = parts[1] === undefined ? null : decode(parts[1]);
  if (id === null) return { name: "not-found" };
  if (parts.length === 2) return { name: "brief", id };
  if (parts.length === 3 && parts[2] === "play") return { name: "play", id };
  if (parts.length === 4 && parts[2] === "recap") {
    const sessionId = decode(parts[3] ?? "");
    if (sessionId !== null) return { name: "recap", id, sessionId };
  }
  return { name: "not-found" };
}

export const paths = {
  library: () => "/",
  brief: (id: string) => `/s/${encodeURIComponent(id)}`,
  play: (id: string) => `/s/${encodeURIComponent(id)}/play`,
  recap: (id: string, sessionId: string) => `/s/${encodeURIComponent(id)}/recap/${encodeURIComponent(sessionId)}`,
};
