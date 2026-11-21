import type { SttResult } from "../providers/stt";

export const LOW_CONFIDENCE = 0.6;

declare const confirmedBrand: unique symbol;

/** A turn the learner has confirmed. Only buildConfirmedTurn makes one. */
export interface ConfirmedTurn {
  readonly text: string;
  readonly heardText: string;
  readonly lowConfidenceWords: readonly string[];
  readonly [confirmedBrand]: true;
}

/**
 * The one place a ConfirmedTurn is created. Returns null when the text to send is empty.
 * editedText is null when the learner did not edit.
 */
export function buildConfirmedTurn(heard: SttResult, editedText: string | null): ConfirmedTurn | null {
  const text = (editedText ?? heard.text).trim();
  if (!text) return null;
  const edited = editedText !== null && text !== heard.text.trim();
  const lowConfidenceWords = edited
    ? []
    : (heard.words ?? []).filter((w) => w.confidence < LOW_CONFIDENCE).map((w) => w.text);
  return { text, heardText: heard.text, lowConfidenceWords } as unknown as ConfirmedTurn;
}

export interface HeardConfirmHandle {
  element: HTMLElement;
  show(heard: SttResult): void;
  clear(): void;
  isOpen(): boolean;
}

export function createHeardConfirm(opts: {
  lang: string;
  onConfirm: (turn: ConfirmedTurn) => void;
  onCancel?: () => void;
}): HeardConfirmHandle {
  const root = document.createElement("div");
  root.className = "confirm";
  root.setAttribute("role", "group");
  root.setAttribute("aria-labelledby", "heard-label");
  root.hidden = true;

  const label = document.createElement("p");
  label.className = "label";
  label.id = "heard-label";
  label.textContent = "What I heard";

  const textEl = document.createElement("div");
  textEl.className = "heard-text";
  textEl.tabIndex = 0;
  textEl.lang = opts.lang;

  const area = document.createElement("textarea");
  area.className = "heard-edit";
  area.rows = 2;
  area.lang = opts.lang;
  area.setAttribute("aria-labelledby", "heard-label");
  area.hidden = true;

  const actions = document.createElement("div");
  actions.className = "actions";
  const editBtn = document.createElement("button");
  editBtn.className = "btn";
  editBtn.type = "button";
  editBtn.setAttribute("aria-pressed", "false");
  editBtn.textContent = "Edit";
  const sendBtn = document.createElement("button");
  sendBtn.className = "btn btn-primary";
  sendBtn.type = "button";
  sendBtn.textContent = "Send";
  actions.append(editBtn, sendBtn);

  root.append(label, textEl, area, actions);

  let current: SttResult = { text: "" };
  let open = false;
  let editing = false;

  function currentText(): string {
    return editing ? area.value : current.text;
  }
  function refresh(): void {
    sendBtn.disabled = currentText().trim() === "";
  }
  function setEditing(on: boolean): void {
    editing = on;
    textEl.hidden = on;
    area.hidden = !on;
    editBtn.setAttribute("aria-pressed", String(on));
    if (on) {
      area.value = current.text.trim();
      area.focus();
    }
    refresh();
  }
  function send(): void {
    const turn = buildConfirmedTurn(current, editing ? area.value : null);
    if (!turn) return;
    open = false;
    root.hidden = true;
    opts.onConfirm(turn);
  }

  editBtn.addEventListener("click", () => setEditing(!editing));
  sendBtn.addEventListener("click", send);
  area.addEventListener("input", refresh);
  area.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditing(false);
      opts.onCancel?.();
    }
  });

  return {
    element: root,
    show(heard) {
      current = heard;
      open = true;
      root.hidden = false;
      textEl.textContent = heard.text;
      setEditing(heard.text.trim() === "");
    },
    clear() {
      current = { text: "" };
      open = false;
      root.hidden = true;
      textEl.textContent = "";
      area.value = "";
      setEditing(false);
    },
    isOpen: () => open,
  };
}
