// Small DOM helpers and the icon set (one inline SVG sprite, 2 px stroke, 20 and 24 px).
const SVG_NS = "http://www.w3.org/2000/svg";

type Attrs = Record<string, string | boolean | undefined>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (value === true) node.setAttribute(key, "");
    else node.setAttribute(key, value);
  }
  for (const child of children) {
    if (child === null || child === undefined) continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

/** Text in the scenario's language, marked with lang so screen readers pronounce it. */
export function lang(code: string, text: string): HTMLSpanElement {
  return h("span", { lang: code }, text);
}

const SPRITE = `
<symbol id="i-mic" viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/></symbol>
<symbol id="i-stop" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></symbol>
<symbol id="i-alert" viewBox="0 0 24 24"><path d="M12 3L2 21h20L12 3zM12 10v5M12 18h.01"/></symbol>
<symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7h.01"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path d="M4 12l5 5L20 6"/></symbol>
<symbol id="i-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></symbol>
<symbol id="i-speaker" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4zM17 8a5 5 0 0 1 0 8"/></symbol>`;

export type IconName = "mic" | "stop" | "alert" | "info" | "check" | "circle" | "speaker";

export function installSprite(): void {
  if (document.getElementById("sprite")) return;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "sprite");
  svg.setAttribute("id", "sprite");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.innerHTML = SPRITE;
  document.body.prepend(svg);
}

export function icon(name: IconName, large = false): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", large ? "icon icon-lg" : "icon");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
}

export function setIcon(svg: SVGSVGElement, name: IconName): void {
  svg.querySelector("use")?.setAttribute("href", `#i-${name}`);
}

export const SIGNAGE_NOTICE = "Text on signs inside the generated scene may be wrong. Use the labels shown by the app.";

export function notice(text: string, opts: { error?: boolean; action?: { label: string; onClick: () => void } } = {}): HTMLDivElement {
  const body = h("div", {}, h("p", {}, text));
  if (opts.action) {
    const btn = h("button", { class: "btn", type: "button" }, opts.action.label);
    btn.addEventListener("click", opts.action.onClick);
    body.append(btn);
  }
  return h(
    "div",
    { class: opts.error ? "notice notice-error" : "notice" },
    icon(opts.error ? "alert" : "info"),
    body,
  );
}

export function signageNotice(): HTMLDivElement {
  return h("div", { class: "notice" }, icon("info"), h("p", {}, SIGNAGE_NOTICE));
}
