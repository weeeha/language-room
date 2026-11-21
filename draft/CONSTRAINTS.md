# Draft constraints and cafe copy

Phase 1 input for the static HTML draft: library, brief, scene, recap and a states page. These constraints come from the unslop skill (version 2.1.0, Phase 1 rules). Rule ids in brackets point at that skill. This file holds no HTML or CSS beyond token names and values.

## Part 1. Constraints

### 1.1 Type

| Item | Value |
|---|---|
| Sans family | `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. No web font, no remote font file. |
| Mono family | Not used. No code, data or measurements on these screens [TYP-13]. |
| Scale (7 steps max) [TYP-1] | 14 / 16 / 18 / 22 / 28 / 36 px as `--text-sm`, `--text-base`, `--text-md`, `--text-lg`, `--text-xl`, `--text-2xl` |
| Body | 16 px, weight 400, line height 1.5 |
| Small text | 14 px, line height 1.45. Nothing under 14 px [TYP-7] |
| `--text-md` 18 px | Character lines in the transcript, line height 1.5 |
| `--text-lg` 22 px | h3, weight 600, line height 1.3 |
| `--text-xl` 28 px | h2, weight 600, line height 1.25 |
| `--text-2xl` 36 px | h1, weight 700, line height 1.15. Below 640 px wide: 28 px |
| Weights | 400, 600, 700 only. Emphasis is a weight step, not a new size |
| Headings | One h1 per screen, no skipped level, each level a visible size and weight step from the next [TYP-8] |
| Measure | Running text 68ch max [TYP-9] |
| Tracking | Default everywhere. No tight tracking [TYP-2] |
| Banned | Eyebrows, tracked-caps labels, italic accent words, justified text, all-caps running text [TYP-3, 5, 6, 11] |
| Portuguese lines | Set in the same family as the UI, with `lang="pt-PT"` on the element. Learner and character lines use `--text-md` |

### 1.2 Spacing, radius, elevation

| Item | Value |
|---|---|
| Spacing scale | 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px as `--space-1` to `--space-8` |
| Gutter | 16 px at 375, 32 px at 1280. Text and cards never touch the edge [LAY-12] |
| Box padding | 16 px (small boxes) or 24 px (panels), from the scale only [LAY-13] |
| Heading spacing | Space above a heading is larger than space below it: 32 above, 12 below for h2 [LAY-11] |
| Radius | 8 px for controls and chips (`--radius-sm`), 12 px for panels (`--radius-md`). No pill buttons, no other radius [LAY-3] |
| Separation ladder | Spacing, then 1 px hairline, then surface tint. Card only as the last step. No card inside a card [LAY-1, LAY-2] |
| Shadow | None at rest. One token `--shadow-pop: 0 2px 8px rgba(0,0,0,0.12)` for a menu or toast only. No coloured or glowing shadow, no hard block shadow [EFF-6, EFF-8] |
| Borders | 1 px `--color-border` for hairlines, 1 px `--color-border-strong` for inputs and outlined buttons |
| Layout on state change | Hover, focus and selection change colour or outline only. Padding, size, border width and type never change. Space for error text and the correction chip row is reserved at rest [LAY-15] |

### 1.3 Widths and breakpoints

| Item | Value |
|---|---|
| Breakpoints | 375 px (phone, base styles, no horizontal scroll) and 1280 px (desktop). One rule at `min-width: 1280px`. Widths between are fluid |
| Page max width | 1120 px, centred, on library, brief and recap |
| Text column | 68ch inside a page |
| Scene screen at 1280 | Two columns: conversation panel 480 px, scene area fills the rest. The conversation panel is the dominant element [LAY-10] |
| Scene screen at 375 | One column. Scene collapses to a 160 px high header that expands on tap. Use `dvh`, not `vh` [RSP-5] |
| Tap targets | 44 px high for the microphone button, Start button and any control in a sticky bar. 24 px at least elsewhere [RSP-2] |
| Microphone button | 56 px circle is the one allowed circle, because it is a toggle with a state, not a decorative shape |

### 1.4 Colour tokens

One accent colour: azulejo blue. It is the only saturated colour. A semantic error colour exists and is always paired with a word and an icon shape, never colour alone [STA-6]. No gradients anywhere, no pure black on pure white [EFF-1, EFF-2, EFF-3, EFF-7]. Dark mode flips token values, components read the same tokens [STA-7].

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-bg` | `#F4F5F7` | `#12151A` | Page |
| `--color-surface` | `#FBFBFC` | `#1A1F26` | Panels, transcript |
| `--color-text` | `#1A1F26` | `#E6E9ED` | Body text |
| `--color-text-muted` | `#4A5260` | `#A8B0BC` | Secondary text, glosses |
| `--color-border` | `#C9CED6` | `#3A424E` | Hairlines, decorative only |
| `--color-border-strong` | `#6F7886` | `#7C8594` | Input and outlined button edges |
| `--color-accent` | `#1D5BA6` | `#8DB8EC` | Filled primary button, links, focus ring, active mic |
| `--color-on-accent` | `#FBFBFC` | `#0F1620` | Text on the filled accent button |
| `--color-error` | `#A3261F` | `#F0908A` | Error text and icon, with a word |

Dark mode applies under `@media (prefers-color-scheme: dark)` and a `data-theme="dark"` override on the root. A light override uses `data-theme="light"`.

Contrast ratios, computed with the WCAG relative luminance formula (script run in this task, output kept in the report):

| Pair | Light | Dark |
|---|---|---|
| Body text on page | 15.18:1 | 15.02:1 |
| Body text on surface | 16.02:1 | 13.60:1 |
| Muted text on page | 7.22:1 | 8.36:1 |
| Muted text on surface | 7.61:1 | 7.57:1 |
| Accent on page (links, focus ring) | 6.21:1 | 8.89:1 |
| Accent on surface | 6.55:1 | 8.04:1 |
| On-accent text on accent button | 6.55:1 | 8.82:1 |
| Error on page | 6.74:1 | 7.89:1 |
| Error on surface | 7.11:1 | 7.15:1 |
| Strong border on page (3:1 needed) | 4.09:1 | 4.91:1 |
| Strong border on surface (3:1 needed) | 4.31:1 | 4.45:1 |

All text pairs are 4.5:1 or more. The scene area sits under an image, so any text over it uses a `--color-surface` backing, never text directly on the picture [STA-4].

### 1.5 Focus, hover, motion

| Item | Value |
|---|---|
| Focus style | `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }` on every link, button, input and the scene toggle. Outline is never removed. It is 6.21:1 (light) and 8.89:1 (dark) against the page |
| Hover | Surface tint only: `color-mix(in srgb, var(--color-text) 6%, transparent)` over the control. No movement |
| Selection | `::selection` background `--color-accent`, text `--color-on-accent`. `caret-color` and `accent-color` set to `--color-accent` [STA-13] |
| Filled controls | One filled control per view: the Start button on the brief, the microphone on the scene, one on the recap. Everything else is outlined or plain [CMP-7] |
| Motion | Only on state change, 150 ms, opacity and transform only. No loops at rest, no scroll reveal, never `transition: all`. A `prefers-reduced-motion` guard wherever keyframes exist. The speaking indicator is a static label "Speaking" with an icon when motion is reduced [MOT-1 to MOT-5] |
| Nothing hidden at rest | No `opacity: 0` reveal classes. Content is visible without script [MOT-6] |
| Icons | One inline SVG set, 2 px stroke, 20 and 24 px only. No emoji [ICO-1, ICO-2] |

### 1.6 Content rules

- No lorem, no placeholder text, no filler people, no invented statistics, no testimonials [CPY-7, CPY-11].
- Every state in the spec checklist (default, hover and focus, empty, loading, error, long content, small screen, dark mode) is drawn with the copy in Part 2.
- Labels are verb plus object. No "Get started", no "Learn more" [CPY-1].
- No exclamation marks, no em dashes, no cheerleading, no confetti or trophy on the recap. The recap reports the result [CPY-4, CPY-6].
- No middle-dot strings, no arrows glued to link text, no status dots before labels [CPY-8 to CPY-10].
- No icon in a tinted tile above a heading, no coloured left-border strips, no AI badges [CMP-2 to CMP-4].
- No identical three-card strip. The library shows one real card. The recap lists three practise phrases as a ranked list, not three equal cards [LAY-4].
- No section numbers. The three practise phrases may be numbered because order is the priority order [LAY-8].
- Every control has a handler or is labelled "Coming soon". The draft sends nothing and says so where a form appears [CMP-6].
- Captions are always on: the transcript is always visible on the scene screen.
- Signage text comes only from the scenario, shown in an HTML overlay, never read from the generated image.

## Part 2. Copy

Portuguese lines are not yet reviewed by a fluent speaker.

UI text is English. Character and learner lines are European Portuguese (pt-PT). Character lines are A2 and 12 words or fewer. The scenario data (character, goal steps, target phrases, signage, hotspot) matches section 4.1 of `docs/spec.md`.

### 2.1 Library card

- Title: Coffee at a Lisbon café
- Language: European Portuguese
- Level: A2
- Place: Pastelaria in Alfama
- Goal: Order a coffee and a pastry, then ask for the bill.
- Action: Open scenario

Under the card for a returning learner: "Last recap: Coffee at a Lisbon café" with link text "Open last recap".

Library states:

- Loading: "Loading scenarios."
- Empty: "No scenarios are available yet. Add a reviewed scenario file to the scenarios folder." with no action.
- Error: "The scenario list could not be loaded. Check that the app is running, then press Try again." Action: Try again.
- Long content: a title of 70 characters wraps to two lines and never truncates.

### 2.2 Brief

- h1: Coffee at a Lisbon café
- Place: Pastelaria in Alfama. A small pastelaria with tiled walls, a glass pastry counter and two tables by the window.
- Character: Dona Amélia, café owner behind the counter. She is friendly, a little hurried and speaks clearly. She repeats once when you ask.
- Level: A2
- Goal: Order a coffee and a pastry, then ask for the bill.
- Steps: Say good morning. Ask for a coffee and a pastel de nata. Ask for the bill and say thank you.
- Useful words heading: Useful words

| Portuguese | English |
|---|---|
| Bom dia | good morning |
| Queria um café, por favor | I would like a coffee, please |
| o pastel de nata | custard tart |
| a conta | the bill |
| Quanto é? | How much is it? |
| Obrigado (said by a man), obrigada (said by a woman) | thank you |

- Microphone check heading: Check your microphone
- Microphone check text: Press the microphone button and say "Bom dia". Your words appear below the button. Check that they match what you said.
- Microphone button label: Test microphone
- Microphone check passed: "Microphone works. We heard: Bom dia."
- Signage notice, exact: "Text on signs inside the generated scene may be wrong. Use the labels shown by the app."
- Start button label: Start conversation

Brief states:

- Microphone denied: "Microphone access is blocked. Allow the microphone for this site in your browser settings, then press Try again. The conversation needs the microphone." Action: Try again.
- No microphone found: "No microphone found. Connect a microphone or headset, then press Check again." Action: Check again.
- Speech service unreachable: "The speech service did not respond. Check your connection, then press Try again." Action: Try again.
- Loading: "Checking your microphone."
- Empty (check not run yet): the check text above, with Start conversation enabled. The learner may skip the check.
- Long content: a 60-word persona wraps inside the 68ch column.

### 2.3 Character greeting

Dona Amélia opens the scene with: "Bom dia. Diga, faz favor." (5 words)

### 2.4 Sample turns

Each turn has: learner line, "What I heard" text, character reply. The learner confirms the heard text before it is sent.

Turn 1

- Learner says: Bom dia.
- What I heard: Bom dia.
- Dona Amélia: Bom dia. O que vai ser? (5 words)

Turn 2 (one learner error)

- Learner says: Queria uma café, por favor.
- What I heard: Queria uma café, por favor.
- Correction chip: **um café** and rule name "Article gender". The chip sits under the learner line. Tooltip and accessible text: "Café is masculine, so it takes um."
- Dona Amélia: Já trago o café. Mais alguma coisa? (7 words)

Why the correction is right: "café" is a masculine noun in Portuguese, so the indefinite article is "um", and "uma café" is wrong in every variety. It is an error, not a regional form.

Turn 3

- Learner says: Sim, um pastel de nata. Quanto é?
- What I heard: Sim, um pastel de nata. Quanto é?
- Dona Amélia: São dois euros e trinta. (5 words) The menu sign in the scenario lists café 1,00 and pastel de nata 1,30, which add up to 2,30.

Scene screen fixed text:

- Heading above the transcript: Conversation
- Step list heading: Goal
- Microphone button labels: Start speaking, Stop speaking
- Confirm area: "What I heard" with buttons Send and Edit. Edit opens the text for correction. Send is the one filled control while a confirmation is open.
- End button: End conversation
- Signage notice repeated in the scene panel, exact text from 2.2.
- Hotspot label on the scene: "o pastel de nata, custard tart"
- Menu signage overlay: "Café 1,00 | Galão 1,60 | Pastel de nata 1,30"
- Name tag: Dona Amélia

### 2.5 Recap

Heading: Recap, Coffee at a Lisbon café

Summary line (sample session of three turns, steps done: greet, order): "You spoke 3 turns. You finished 2 of 3 goal steps."

Phrases used (from the transcript):

- Bom dia
- o pastel de nata
- Quanto é?

Mistake (one):

- You said: Queria uma café, por favor.
- Corrected form: Queria um café, por favor.
- Reason: Café is masculine, so it takes um.

Phrases to practise (exactly three, each from the scenario targets):

1. A conta, por favor. Why: You did not reach this step, and it ends every visit. Example: "Boa tarde. A conta, por favor."
2. Queria um café, por favor. Why: Practise um with a masculine word, the one slip in this session. Example: "Queria um pastel de nata, por favor."
3. Quanto é? Why: Short and useful after any order. Example: "Quanto é um galão?"

Controls: Replay transcript (outlined), Start again (the one filled control), Back to library (plain).

Recap states:

- No mistakes: "No mistakes found in this session. The checker shows only corrections it is sure about, so a quiet recap does not prove every line was perfect." The mistake section is replaced by this sentence.
- Ended after one turn: "You ended after 1 turn, so there is little to review. Phrases used are listed below. Try the full conversation to practise the order and the bill." The mistake section reads "No mistakes found in this turn." The three practise phrases still appear.
- Many mistakes: "Showing the first 5 of N mistakes. Scroll for the rest." where N is the real count in the draft example, for example 8. The list scrolls inside a bounded area.
- Loading: "Preparing your recap."
- Error: "The recap could not be built. Your transcript is saved. Press Try again." Action: Try again.
- Long content: a learner line of 40 words wraps and the corrected form sits on its own line.

### 2.6 Scene state copy

- Scene loading: "Loading the scene." with a progress bar and a text value such as "Loading the scene, 60 percent" while it loads.
- Scene failed, exact: "Scene unavailable, continuing without it". The conversation works as normal.
- Speech returned nothing: "We did not hear anything. Press the microphone and speak again."
- LLM timeout: "Dona Amélia did not answer in time. Your line is kept." Action: Retry.
- TTS failed: "Audio is unavailable for this line. Showing text only." The character line stays in the transcript.
- Learner silent for 20 seconds, spoken and shown from the character: "Precisa de ajuda? Diga, faz favor." (5 words). Under it, a hint from the current goal step: "Hint: Ask for a coffee and a pastel de nata."
- Very long learner line: the "What I heard" box scrolls after 6 lines, and the Send button stays visible.
- Empty transcript (before the greeting plays): "Dona Amélia is about to speak."
- Report control on character lines: "Report a mistake".
- Small screen: the scene header image toggle reads "Show scene" and "Hide scene".

### 2.7 Keyboard

- The space bar toggles the microphone when focus is not in a text field.
- Every control reachable by Tab, in reading order. Focus ring per 1.5.
- Captions always on, with no switch.
