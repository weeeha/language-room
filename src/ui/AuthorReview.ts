// The Review and Share sections of the authoring form (task 26). A fluent reviewer signs the
// scenario off here. A sign-off is removed when the reviewed text changes (src/author/review.ts).
import { REVIEW_CHECKLIST, REVIEW_CLEARED_NOTICE, reviewLine, signOffProblem, todayIso } from "../author/review";
import { encodePayload, linkWarning, shareLink, SHARE_NOTE } from "../author/share";
import { h, notice } from "./dom";
import type { AuthorCtx } from "./Author";

export function createReviewSection(ctx: AuthorCtx): { element: HTMLElement } {
  const state = h("p", { role: "status", id: "review-state" });
  const clearedSlot = h("div", { role: "status" });
  const by = h("input", { type: "text", autocomplete: "off" });
  const on = h("input", { type: "date" });
  on.value = todayIso();
  const confirm = h("input", { type: "checkbox", id: "review-confirm" });
  const confirmLabel = h("label", { for: "review-confirm", class: "check-label" });
  const problem = h("p", { class: "field-error", role: "alert" });
  problem.hidden = true;
  const signBtn = h("button", { class: "btn", type: "button" }, "Sign off");

  const byField = h("div", { class: "field" }, h("label", { for: "review-by" }, "Reviewer name or id"), by);
  by.id = "review-by";
  const onField = h("div", { class: "field" }, h("label", { for: "review-on" }, "Date of review"), on);
  on.id = "review-on";

  function sync(): void {
    const s = ctx.getState();
    const lang = s.languageName.trim() || "the language of this scenario";
    confirmLabel.textContent = `I am fluent in ${lang} and I checked the items above`;
    state.textContent = s.reviewed ? `${reviewLine(s.reviewed)}.` : "Not reviewed yet. This scenario stays out of the library until it is signed off.";
    clearedSlot.replaceChildren(...(ctx.reviewCleared() ? [notice(REVIEW_CLEARED_NOTICE)] : []));
  }
  ctx.onChange(sync);

  signBtn.addEventListener("click", () => {
    const input = { by: by.value, on: on.value, confirmed: confirm.checked };
    const why = signOffProblem(input);
    if (why) {
      problem.textContent = why;
      problem.hidden = false;
      return;
    }
    problem.hidden = true;
    void ctx.signOff(input).then((ok) => {
      if (ok) {
        confirm.checked = false;
        ctx.announce(`${reviewLine(ctx.getState().reviewed)}. Saved.`);
      } else {
        problem.textContent = "The sign-off was not saved. Fix the problems listed at the top of the form, then try again.";
        problem.hidden = false;
      }
    });
  });

  const element = h(
    "section",
    { "aria-labelledby": "h-review" },
    h("h2", { id: "h-review" }, "Review"),
    h("p", { class: "muted" }, "A fluent speaker checks the scenario and signs it off. Only reviewed scenarios appear in the library. Changing the persona, phrases, grammar targets, goal steps, sign text or the words in the scene removes the sign-off."),
    state,
    clearedSlot,
    h("p", { class: "label" }, "The reviewer checks"),
    h("ul", {}, ...REVIEW_CHECKLIST.map((t) => h("li", {}, t))),
    byField,
    onField,
    h("div", { class: "check-row" }, confirm, confirmLabel),
    problem,
    h("div", { class: "actions" }, signBtn),
  );
  sync();
  return { element };
}

export function createShareSection(ctx: AuthorCtx): { element: HTMLElement } {
  const out = h("input", { type: "text", readonly: true, id: "share-link", "aria-describedby": "share-note" });
  const outField = h("div", { class: "field" }, h("label", { for: "share-link" }, "Share link"), out);
  outField.hidden = true;
  const warn = h("p", { class: "field-error", role: "status" });
  warn.hidden = true;
  const status = h("p", { class: "status", role: "status" });
  const btn = h("button", { class: "btn", type: "button" }, "Make share link");
  btn.addEventListener("click", () => {
    const saved = ctx.getSaved();
    if (!saved) {
      status.textContent = "Save the scenario first. The link is made from the saved version.";
      return;
    }
    status.textContent = "";
    void encodePayload(saved).then(async (payload) => {
      const link = shareLink(location.origin, payload);
      out.value = link;
      outField.hidden = false;
      const w = linkWarning(link);
      warn.textContent = w ?? "";
      warn.hidden = !w;
      try {
        await navigator.clipboard.writeText(link);
        status.textContent = "Link copied.";
      } catch {
        status.textContent = "Select the link and copy it.";
        out.focus();
        out.select();
      }
    });
  });
  const element = h(
    "section",
    { "aria-labelledby": "h-share" },
    h("h2", { id: "h-share" }, "Share with a class"),
    h("p", { class: "muted", id: "share-note" }, SHARE_NOTE),
    h("div", { class: "actions" }, btn),
    status,
    outField,
    warn,
  );
  return { element };
}
