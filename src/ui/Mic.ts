// Microphone toggle: visible text labels, icon, and the space bar.
import { h, icon, setIcon } from "./dom";

/** Space toggles the microphone when focus is not in a text field or on a button or link. */
export function isSpaceToggleTarget(tag: string | undefined, editable: boolean): boolean {
  if (editable) return false;
  const t = (tag ?? "").toLowerCase();
  return !["input", "textarea", "select", "button", "a", "summary"].includes(t);
}

export interface MicHandle {
  element: HTMLElement;
  button: HTMLButtonElement;
  setListening(on: boolean): void;
  setDisabled(on: boolean): void;
  /** The microphone is the one filled control, except while "What I heard" is open. */
  setFilled(on: boolean): void;
}

export function createMic(opts: { onToggle: () => void }): MicHandle {
  const glyph = icon("mic", true);
  const label = h("p", { class: "mic-label", id: "mic-scene" }, "Start speaking");
  const button = h("button", { class: "btn mic btn-primary", type: "button", "aria-labelledby": "mic-scene" }, glyph);
  button.addEventListener("click", () => opts.onToggle());
  return {
    element: h("div", { class: "mic-row" }, button, label),
    button,
    setListening(on) {
      button.dataset.on = on ? "true" : "false";
      label.textContent = on ? "Stop speaking" : "Start speaking";
      setIcon(glyph, on ? "stop" : "mic");
    },
    setDisabled(on) {
      button.disabled = on;
    },
    setFilled(on) {
      button.classList.toggle("btn-primary", on);
    },
  };
}

/** Listens for the space bar on the document. Returns a function that removes the listener. */
export function bindSpaceBar(onToggle: () => void): () => void {
  const handler = (e: KeyboardEvent): void => {
    if (e.key !== " " || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (!isSpaceToggleTarget(target?.tagName, target?.isContentEditable ?? false)) return;
    e.preventDefault();
    onToggle();
  };
  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}
