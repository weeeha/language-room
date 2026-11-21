// Authored signage as HTML overlays. The text is exactly the scenario's text.
// Nothing here reads text from the scene itself (docs/spec.md section 5.7).
import type { Signage } from "../scenario/validate";
import { h } from "../ui/dom";
import { clearPlacement, markPlaced, placeElement, type OverlayGroup, type Projector } from "./overlay";

export interface SignageView {
  id: string;
  text: string;
  lang: string;
}

/** What each sign draws. Pure, so a test can compare it with the scenario. */
export function signageView(items: readonly Signage[], lang: string): SignageView[] {
  return items.map((s) => ({ id: s.id, text: s.text, lang }));
}

export function createSignage(items: readonly Signage[], lang: string): OverlayGroup {
  const views = signageView(items, lang);
  const entries = views.map((view, i) => {
    const el = h("p", { class: "overlay signage", "data-signage": view.id }, view.text);
    el.lang = view.lang;
    return { el, item: items[i] as Signage };
  });
  return {
    elements: entries.map((e) => e.el),
    update(projector: Projector | null) {
      for (const { el, item } of entries) {
        if (!projector) clearPlacement(el);
        else {
          markPlaced(el);
          placeElement(el, projector.project(item.anchor));
        }
      }
    },
  };
}
