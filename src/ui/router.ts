// History API router. Each screen returns an element, a title and an optional cleanup.
import { parseRoute, type Route } from "./routes";

export interface Screen {
  title: string;
  element: HTMLElement;
  /** Class names for the root <main> element. */
  rootClass?: string;
  dispose?(): void;
}

export type Resolver = (route: Route) => Screen | Promise<Screen>;

export function startRouter(root: HTMLElement, resolve: Resolver): { navigate(path: string): void } {
  let current: Screen | undefined;
  let token = 0;

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
  window.addEventListener("popstate", () => void render(false));
  void render(true);
  return { navigate };
}
