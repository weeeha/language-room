# Draft audit (task 7, steps 1 to 3)

Checked on 2026-11-21 with the unslop skill 2.1.0: `rules.mjs check`, `rules.mjs selftest`, `render.mjs --selftest`, then `render.mjs` at 375 and 1280 px in light and dark on all five pages. The fresh-eyes reviewer agent was skipped on purpose: this run may not dispatch subagents.

## Flow walk

Order walked: library, brief, scene, recap.

1. Library: one card, one way forward ("Open scenario"). Clear. Left as is.
2. Brief: it was not clear that the microphone check is optional. Fixed: the line "The check is optional." sits above Start conversation.
3. Brief: no way back to the library inside the page (only the draft bar). Fixed: plain link "Back to library" under Start conversation.
4. Brief: "Test microphone" did nothing and said nothing. Fixed: it now shows "Coming soon" after the button (all controls without behaviour do, per CONSTRAINTS 1.6).
5. Scene: the microphone, Report a mistake, Send and the correction chip were dead with no label. Fixed: "Coming soon" note, except the microphone, which now switches its label and icon between Start speaking and Stop speaking.
6. Scene: the correction reason was in a tooltip only, so touch users could not read it. Fixed: pressing the chip shows the sentence below it. Without script the sentence is always visible.
7. Scene: the learner must scroll past the whole transcript to reach What I heard, Send and the microphone. Left: a pinned control bar is a Phase 2 pattern with a scrolling transcript, and a static draft has no scrolling region to pin to. Recorded for the owner review.
8. Scene: while What I heard is open, the microphone is still offered. It is unclear whether speaking again replaces the pending text. Left: this is a behaviour decision for Phase 2. Recorded for the owner review.
9. Scene to recap: End conversation has no confirmation. Left: the recap says the transcript is saved, so nothing is lost.
10. Recap: three controls, one filled (Start again), one outlined, one plain. Clear. Path back exists (Back to library). Left as is.
11. Recap: "Replay transcript" jumps to the transcript below on the same page. It does not replay audio. Left: label comes from CONSTRAINTS 2.5.

Known items:

- (a) Phone-width scene without script: the toggle button is not shown and the scene header is not capped. All overlays, the hotspot and the signage stay visible above the conversation. Checked with a copy of scene.html with the script tag removed at 500 px (headless Chrome minimum width), screenshot `media/shots/scene-nojs.png`. Kept.
- (b) Heading steps below 640 px: h1 28 and 700, h2 22 and 600, h3 18 and 600. Each step is visible. A rule that forced the scene h1 to 28 px also made it equal to h2 between 640 and 1279 px. Removed, so the scene h1 now follows the normal h1 sizes.
- (c) One filled control per view. Scene at rest: Send is the only filled control, because What I heard is open; the microphone is outlined. Brief: Start conversation. Recap: Start again. Library: none. The microphone state is text: the label reads Start speaking or Stop speaking and the icon changes with it. The active border colour is only reinforcement. States page is a catalogue and shows several filled buttons on purpose, one per demo.

## unslop audit

Mechanical: `rules.mjs check` on all html, css and js reported no Floor or Reflex hit. Selftests of both scripts passed first, so the zero is trusted.

| Finding | Rule | Result |
|---|---|---|
| Dead controls with no "Coming soon" label | CMP-6 | Fixed |
| Correction reason only in a tooltip (hover only) | RSP-3 | Fixed |
| Plain text links under 24 px high (states page link, new Back to library link, dark links) | RSP-2 | Fixed with `.tap` padding, link on states page became an outlined button |
| States page: card title h4 and h3 share 18 px 600 (flat scale) | TYP-8 | Fixed: the long-title demo uses `.card-title` (h2 style on a paragraph) |
| States page: h4 leading 1.30 over 3 lines | TYP-10 | Fixed by the same change |
| States page: hidden h4 "Conversation" flat against h3 | TYP-8 | Fixed: now a screen-reader-only paragraph |
| Scene h1 equal to h2 size between 640 and 1279 px | TYP-8 | Fixed (override removed) |
| Scene and recap at 375: sr-only spans "Done:", "Not done:" flagged as 15 px from the edge | LAY-12 | Left: false positive, the text is clipped to 1 px and never visible |
| Scene and recap at 375: sr-only chip note flagged at -60 px | LAY-12 | Fixed: the note is now visible text, not sr-only |
| Gradients, em dashes, exclamation marks, emoji | EFF-1, EFF-2, CPY-4 | PASS: grep, 0 hits |
| Overflow at 375 | RSP-1 | PASS: render tier, 5 pages, light and dark, 0 overflow |
| Focus ring, contrast, motion at rest, state stability, broken image, script error | STA-3, STA-4, MOT-1, LAY-15, STA-10, STA-11 | PASS: render tier, 375 and 1280, light and dark |
| Safari and Firefox | | Not checked. Chrome only. |

## States checklist

Pages: L = index.html, B = brief.html, S = scene.html, R = recap.html, St = states.html.

Cross-screen boxes, same for all four screens:

- Hover and focus: defined once in styles.css (`.btn:hover`, `:focus-visible`) and used on every control. Described in St `#all-hover`.
- Small screen: every page is built at 375 px first. Scene collapse is in St `#sc-phone`. 0 overflow in the render tier.
- Dark mode: tokens flip in styles.css. Forced with `?theme=dark`, linked from St `#all-dark`. Contrast read from pixels in the render tier, dark scheme, 0 findings.

| Surface | Default | Hover/focus | Empty | Loading | Error | Long content | Small screen | Dark mode |
|---|---|---|---|---|---|---|---|---|
| Library | [x] index.html | [x] St #all-hover | [x] St #lib-empty | [x] St #lib-loading | [x] St #lib-error | [x] St #lib-long | [x] all pages at 375 | [x] St #all-dark |
| Brief | [x] brief.html | [x] St #all-hover | [x] St #br-empty | [x] St #br-loading | [x] St #br-denied, #br-none, #br-stt | [x] St #br-long | [x] all pages at 375 | [x] St #all-dark |
| Scene | [x] scene.html | [x] St #all-hover | [x] St #sc-empty | [x] St #sc-loading | [x] St #sc-failed, #sc-nothing, #sc-llm, #sc-tts | [x] St #sc-long | [x] St #sc-phone | [x] St #all-dark |
| Recap | [x] recap.html | [x] St #all-hover | [x] St #rc-none | [x] St #rc-loading | [x] St #rc-error | [x] St #rc-long | [x] all pages at 375 | [x] St #all-dark |

Specific states:

| State | Where |
|---|---|
| Brief: microphone permission denied | St #br-denied |
| Brief: no microphone found | St #br-none |
| Brief: STT provider unreachable | St #br-stt |
| Scene: scene loading with progress | St #sc-loading |
| Scene: scene failed | St #sc-failed |
| Scene: STT returned nothing | St #sc-nothing |
| Scene: LLM timeout, Retry, line kept | St #sc-llm |
| Scene: TTS failed, text only with notice | St #sc-tts |
| Scene: learner silent for 20 seconds | St #sc-silent |
| Scene: very long learner line | St #sc-long |
| Recap: no mistakes | St #rc-none |
| Recap: ended after one turn | St #rc-one |
| Recap: many mistakes, list scrolls, first five shown | St #rc-many |
| Keyboard: every control reachable | Native buttons and links, tab order follows reading order (all pages) |
| Keyboard: space bar toggles microphone | Missing in the draft. Native space on a focused microphone button works, a global space shortcut is Phase 2 behaviour. Noted for the owner. |
| Keyboard: visible focus | styles.css `:focus-visible`, all pages |
| Keyboard: captions always on | Transcript is always visible on S |

No state is missing from states.html. Two known gaps, both behaviour and not layout: the global space bar shortcut, and the pinned control bar (flow point 7).
