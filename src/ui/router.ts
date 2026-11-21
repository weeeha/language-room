// History API router. Each screen returns an element, a title and an optional cleanup.
import { parseRoute, type Route } from "./routes";

export interface Screen {
  title: string;
  element: HTMLElement;
  /** Class names for the root <main> element. */
  rootClass?: string;
  dispose?(): void;
  /** A message when leaving would lose work, or null. The router asks before it leaves. */
  leaveWarning?(): string | null;
}

export const ADDRESS_CHANGED = "language-room:address-changed";

export type Resolver = (route: Route) => Screen | Promise<Screen>;

export function startRouter(root: HTMLElement, resolve: Resolver): { navigate(path: string): void } {
  let current: Screen | undefined;
  let token = 0;
  let shownPath = location.pathname + location.search;

  function mayLeave(): boolean {
    const message = current?.leaveWarning?.();
    return !message || window.confirm(message);
  }

  async function render(first: boolean): Promise<void> {
    const mine = ++token;
    const route = parseRoute(location.pathname);
    const screen = await resolve(route);
    if (mine !== token) {
      screen.dispose?.();
      return;
    }
    current?.dispose?.();
    current = screen;
    shownPath = location.pathname + location.search;
    root.className = screen.rootClass ?? "wrap page";
    root.replaceChildren(screen.element);
    document.title = `${screen.title} - Language room`;
    window.scrollTo(0, 0);
    if (!first) {
      const heading = root.querySelector("h1");
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus();
      }
    }
  }

  function navigate(path: string): void {
    if (path === location.pathname + location.search) return;
    if (!mayLeave()) return;
    history.pushState({}, "", path);
    void render(false);
  }

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element | null)?.closest("a");
    if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
    const url = new URL(anchor.href, location.href);
    if (url.origin !== location.origin) return;
    event.preventDefault();
    navigate(url.pathname + url.search);
  });
  // A screen that rewrites its own address with replaceState tells the router with this event.
  window.addEventListener(ADDRESS_CHANGED, () => {
    shownPath = location.pathname + location.search;
  });
  window.addEventListener("popstate", () => {
    if (!mayLeave()) {
      history.pushState({}, "", shownPath);
      return;
    }
    void render(false);
  });
  void render(true);
  return { navigate };
}

/** Moves to a path from inside a screen. The router renders it like a link click. */
export function goTo(path: string): void {
  history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
