// Debug footer (docs/spec.md section 5.11): provider names, call counts, median latency, and the
// provider pickers. Choosing a paid provider while paid providers are off shows an error instead.
import { h } from "./dom";

export interface CallCounts {
  llm: number;
  stt: number;
  tts: number;
}

export function formatCounts(c: CallCounts): string {
  return `Calls this session: language model ${c.llm}, speech to text ${c.stt}, speech ${c.tts}.`;
}

export function formatMedian(ms: number | null): string | null {
  if (ms === null) return null;
  return `Median reply time: ${(ms / 1000).toFixed(1)} s.`;
}

export type Kind = "stt" | "llm" | "tts";

export interface PickerProvider {
  id: string;
  label: string;
  paid: boolean;
}

const KIND_LABEL: Record<Kind, string> = { stt: "Speech to text", llm: "Language model", tts: "Speech" };

export interface DebugFooterHandle {
  element: HTMLElement;
  update(state: { counts: CallCounts; median: number | null }): void;
}

export function createDebugFooter(opts: {
  providers: Record<Kind, PickerProvider[]>;
  selected: Record<Kind, string>;
  /** Returns an error message when the choice is refused, or null when it was applied. */
  onSelect: (kind: Kind, id: string) => string | null;
}): DebugFooterHandle {
  const error = h("p", { class: "notice-error", role: "alert" });
  error.hidden = true;
  const pickers = h("div", { class: "debug-pickers" });
  const selects: Record<Kind, HTMLSelectElement> = {} as Record<Kind, HTMLSelectElement>;
  for (const kind of ["stt", "llm", "tts"] as const) {
    const select = h("select", { id: `pick-${kind}` });
    for (const p of opts.providers[kind]) {
      const option = h("option", { value: p.id }, p.paid && !/paid/i.test(p.label) ? `${p.label} (paid)` : p.label);
      if (p.id === opts.selected[kind]) option.selected = true;
      select.append(option);
    }
    let previous = opts.selected[kind];
    select.addEventListener("change", () => {
      const message = opts.onSelect(kind, select.value);
      if (message) {
        select.value = previous;
        error.textContent = message;
        error.hidden = false;
      } else {
        previous = select.value;
        error.hidden = true;
        error.textContent = "";
      }
    });
    selects[kind] = select;
    pickers.append(h("label", { for: `pick-${kind}` }, KIND_LABEL[kind], select));
  }
  const counts = h("p", {});
  const median = h("p", {});
  const element = h("footer", { class: "debug", "aria-label": "Debug" }, h("h2", {}, "Debug"), pickers, error, counts, median);
  return {
    element,
    update(state) {
      counts.textContent = formatCounts(state.counts);
      const text = formatMedian(state.median);
      median.textContent = text ?? "";
      median.hidden = text === null;
    },
  };
}
