// The character name tag. It sits at character.anchor when the scenario has one.
// Without an anchor it keeps a fixed place over the scene area, as in the draft.
import type { Scenario, Vec3 } from "../scenario/validate";
import { h } from "../ui/dom";
import { clearPlacement, markPlaced, placeElement, type OverlayGroup, type Projector } from "./overlay";

export interface NameTagView {
  text: string;
  lang: string;
  anchor?: Vec3;
}

export function nameTagView(scenario: Pick<Scenario, "language" | "character">): NameTagView {
  return { text: scenario.character.name, lang: scenario.language.code, anchor: scenario.character.anchor };
}

export function createNameTag(view: NameTagView, anchor?: () => Vec3 | undefined): OverlayGroup {
  const el = h("p", { class: "overlay name-tag" }, view.text);
  el.lang = view.lang;
  const at = anchor ?? (() => view.anchor);
  return {
    elements: [el],
    update(projector: Projector | null) {
      const pos = at();
      if (!projector || !pos) {
        clearPlacement(el);
        return;
      }
      markPlaced(el);
      placeElement(el, projector.project(pos));
    },
  };
}
