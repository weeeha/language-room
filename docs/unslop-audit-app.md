# Unslop audit of the app UI (task 22)

Date: 2026-11-21. Skill: `unslop:unslop` (plugin copy at `/Users/nickv/ClaudeCode Projects/Unslop/skills/unslop`).
Scope: `src/ui/*.ts`, `src/ui/styles.css`, `src/recap/view.ts`, and the four screens (library, brief, conversation, recap), rendered against the Vite dev server.
The fresh-eyes reviewer subagent step was skipped on purpose: this task may not dispatch subagents.

## Mechanical tier

- `rules.mjs selftest`, `render.mjs --selftest` and the registry tests passed before the audit, so a zero is a real zero.
- `rules.mjs check` over the sources: 0 grep hits. The remaining rules are render or judgment rules and are covered below.
- `render.mjs` at 375 and 1280 px, light and dark, on `/`, `/s/lisbon-cafe-pt`, `/s/lisbon-cafe-pt/play` and `/s/lisbon-cafe-pt/recap/nope`.

## Fixed (2)

1. RSP-2, tap target: the development-only scenario links in the library and the "Open last recap" link were 18 px tall at 375 px. Both links now carry the existing `tap` class (`src/ui/Library.ts`).
2. TYP-8, flat scale: the "Debug" heading in the debug footer was 16 px and weight 600, the same as body text. It now uses the `--text-md` step (`src/ui/styles.css`).

## Left (1)

1. TYP/LAY edge WARN, three hits on `span.sr-only` "Not done:" at 15 px from the screen edge at 375 px (conversation screen). The text is visually hidden for screen readers and draws nothing, so there is no gutter to keep. Reflex tier, waived on the record: unslop-waive LAY-12 · the span is clipped to 1 px by `.sr-only` and never paints · screen reader label inside the goal step list.

## Judgment passes, by eye

- CMP-7, one filled control: recap has "Start again" filled, "Replay transcript" outlined, "Back to library" plain. PASS.
- CMP-6, every control does something: Replay transcript scrolls to and focuses the transcript heading, Try again rebuilds the recap, the other controls are links. PASS.
- CPY-4 and CPY-6: no exclamation marks in `src/ui` or `src/recap` strings, no cheering copy. PASS (grep and read).
- STA-1, states: recap has loading, error with Try again, session not found, no mistakes, one turn, many mistakes (five then a bounded scrolling list). PASS.
- LAY-1 and LAY-4: recap is one text column with no cards. PASS.
- RSP-1: the seeded recap (7 mistakes, 7 chips, 36 Portuguese runs) has no horizontal scroll at 375 px, measured over DevTools.
- Screenshots are in `media/shots/` (git-ignored), for example `recap-many.png` and `recap-375.png`.

## Not checked

- `render.mjs` cannot see the recap with data: it opens a fresh browser profile and the session lives in IndexedDB. The populated recap was measured for overflow and read from a screenshot only, not run through the contrast and state-stability checks. Its colours come from the same tokens as the draft.
- Impeccable (`npx impeccable detect`) was not run: it downloads a package and the task allows no installs.
- Safari was not checked.

## Authoring screens (tasks 24 to 26)

- `rules.mjs check` over `Author.ts`, `AuthorList.ts`, `AuthorScene.ts`, `AuthorReview.ts`, `ImportShare.ts` and `styles.css`: 1 reflex WARN, no errors. `render.mjs` was not run: it opens a fresh profile and the screens need saved data, so the screens were measured by hand (below).
- LAY-4 WARN, `repeat(3, minmax(...))` in `.number-row`: three equal columns for the X, Y and Z number inputs. They are one coordinate, so equal columns are the right shape. Waived on the record, not a card grid.
- RSP-1: `scrollWidth` equals `clientWidth` (375 of 375) on `/author`, `/author/new` with every section filled, in light and dark, read over a headless Chrome session.
- CMP-7, one filled control: the form has Save filled. Sign off, Make share link and the scene buttons are outlined. The list page has New scenario filled.
- STA-1 states: list empty, list with items, delete confirm step, import error, form errors (summary plus field text, `aria-invalid`), scene not loaded, scene failed to load, share link too long, invalid share link. Checked by running them.
- CPY: no exclamation marks and no em dashes in the new UI text.
- Not checked: Safari, the scene viewer with a live scene in a screenshot (the headless capture hung while the WebGL scene drew, so placement was checked by numbers and DOM, not by image), screen reader output.
- Found outside this task: `.scene-surface > .overlay { display: none }` in `styles.css` hides the name tag, the sample label and the placing panel on the conversation page (computed display is none in a loaded scene). The authoring preview uses its own `.author-surface` class and is not affected. Left as is.
