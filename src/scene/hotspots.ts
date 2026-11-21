// Hotspots: a small button anchored in the scene. Click, Enter or focus opens the word card.
// Escape closes it. In the stacked layout (no scene) every card is shown as a plain label.
import type { Hotspot } from "../scenario/validate";
import { h, icon } from "../ui/dom";
import { clearPlacement, markPlaced, placeElement, type OverlayGroup, type Projector } from "./overlay";

export interface HotspotView {
  id: string;
  word: string;
  gloss: string;
  lang: string;
  /** The words a screen reader gets for the card, and the stacked label. */
  cardText: string;
}

export function hotspotView(items: readonly Hotspot[], lang: string): HotspotView[] {
  return items.map((x) => ({ id: x.id, word: x.word, gloss: x.gloss, lang, cardText: `${x.word}, ${x.gloss}` }));
}

export function createHotspots(items: readonly Hotspot[], lang: string): OverlayGroup {
  const views = hotspotView(items, lang);
  const entries = views.map((view, i) => {
    const cardId = `hotspot-card-${view.id}`;
    const word = h("span", { lang: view.lang }, view.word);
    const card = h("p", { class: "overlay word-card", id: cardId }, word, `, ${view.gloss}`);
    const button = h(
      "button",
      { class: "hotspot-btn", type: "button", "aria-expanded": "false", "aria-controls": cardId },
      icon("info"),
      h("span", { class: "sr-only" }, "Word: "),
      h("span", { class: "sr-only", lang: view.lang }, view.word),
    );
    const wrap = h("div", { class: "hotspot", "data-hotspot": view.id }, button, card);
    return { wrap, button, card, item: items[i] as Hotspot };
  });

  function setOpen(entry: (typeof entries)[number], open: boolean): void {
    entry.card.classList.toggle("is-open", open);
    entry.button.setAttribute("aria-expanded", open ? "true" : "false");
  }

  for (const entry of entries) {
    entry.button.addEventListener("click", () => setOpen(entry, true));
    entry.button.addEventListener("focus", () => setOpen(entry, true));
    entry.wrap.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !entry.card.classList.contains("is-open")) return;
      e.stopPropagation();
      setOpen(entry, false);
    });
    entry.wrap.addEventListener("focusout", (e) => {
      if (!entry.wrap.contains(e.relatedTarget as Node | null)) setOpen(entry, false);
    });
  }

  // Safari does not focus a button on click, so a press elsewhere closes open cards.
  const onPointerDown = (e: PointerEvent): void => {
    for (const entry of entries) if (!entry.wrap.contains(e.target as Node | null)) setOpen(entry, false);
  };
  document.addEventListener("pointerdown", onPointerDown);

  return {
    dispose: () => document.removeEventListener("pointerdown", onPointerDown),
    elements: entries.map((e) => e.wrap),
    update(projector: Projector | null) {
      for (const entry of entries) {
        if (!projector) {
          clearPlacement(entry.wrap);
          setOpen(entry, false);
        } else {
          markPlaced(entry.wrap);
          placeElement(entry.wrap, projector.project(entry.item.position));
        }
      }
    },
  };
}
