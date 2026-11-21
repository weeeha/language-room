# Acceptance sheet, 2026-11-21

The 14 criteria from spec section 6, checked against the build on branch `build/language-room`. Every output below was produced on 2026-11-21 on the build machine. Browser checks ran in headless Chrome 158 against the Vite dev server with a software WebGL renderer, so no frame rate or timing from them is a measurement of the app on a GPU.

Status words, and only these: `met (automated)`, `met (checked in a browser)`, `partly met`, `not met`, `needs a person`, `needs a paid step`.

Count: 5 `met (automated)`, 2 `met (checked in a browser)`, 6 `partly met`, 1 `not met`, 0 `needs a person`, 0 `needs a paid step`. Several `partly met` rows have a half that needs a person or a paid step. The half is named in the "Missing" column and again in "Needs the owner".

## The 14 criteria

| # | Criterion (short) | Status | Evidence | Missing |
|---|---|---|---|---|
| 1 | `npm test` passes and the validator rejects a file with no `level`, naming the field | met (automated) | `npm test`: 48 files, 396 tests passed (output below). Test "rejects a scenario with no level and names the field" in `src/scenario/validate.test.ts`. | Nothing. |
| 2 | `lisbon-cafe-pt.json` validates and has a `reviewed` entry from a fluent speaker | not met | `npm run validate:scenarios`: "lisbon-cafe-pt valid, unlisted (reviewed: missing ...)". | A fluent European Portuguese speaker has to review the persona, target phrases and signage and sign the file. Until then the scenario is unlisted. |
| 3 | `/s/lisbon-cafe-pt/play` loads the scene with a progress indicator; with the file missing the page still starts and shows "Scene unavailable, continuing without it" | partly met | Browser, `?scene=sample`: progress bar and "Loading the scene, 84 percent" then 100 percent, scene drawn (7.8 MB, 500,000 splats, load 2.6 to 5.9 s over the internet). Browser, plain URL (café file absent, which is the renamed-file case): conversation starts and the page shows "Scene unavailable, continuing without it". | The "loads the scene" half holds only for the sample room. The café scene needs the paid Marble export (plan tasks 3 and 4). |
| 4 | Learner presses the microphone, speaks, sees "What I heard" with edit and confirm; the turn is sent only after confirm | partly met | Unit tests `src/ui/HeardConfirm.test.ts` and `src/ui/Mic.test.ts` (inside the `npm test` run). A confirmed turn can only be made by `buildConfirmedTurn`, and the loop takes only that type. The synthetic run sent Whisper output through it. | Nobody has pressed the microphone and spoken in a browser. Needs a learner at a real microphone (task 13 step 5, task 17). |
| 5 | After confirm, character text shows and audio starts within 4 seconds on the reference machine | partly met | Synthetic session, local model, no-audio speech stand-in: reply latency per turn 937, 1409, 1890, 1473, 1087, 599, 334 ms, median 1087 ms (`eval/transcripts/phase-2-synthetic-2026-11-21.md`). Machine load averages were 23 (1 minute) when the run started. | Time to first audio was not measured in a browser with a real voice. Reference machine for the speech timing is not written into a results file for this build. |
| 6 | At A2 the character averages 12 words or fewer per sentence; a fluent reviewer rates the lines natural pt-PT | partly met | `npm run check:level`, output below: average 4.9 words per sentence over 8 character lines, limit 12, exit 0. | The reviewer half needs a fluent speaker. The sheet is `eval/transcripts/phase-2-synthetic-2026-11-21.md`. Some lines read oddly (see "Found while running these checks"). |
| 7 | A chip appears only for verdict `correct`; the log shows every `incorrect` and `unsure` issue as not shown | met (automated) | Gate and loop tests in `npm test` (`src/conversation/corrections`, `src/conversation/loop.test.ts`: "stores unsure and incorrect issues as not shown"). In the synthetic session one `incorrect` issue on line l5 was stored and not shown. | Nothing on the rule. The rule is tested on model output from one local model only. |
| 8 | The gold-set run reports 0 corrections shown on correct sentences | met (automated) | `npm run eval`, output below, and `eval/results-2026-11-21.md`: 0 shown on 20 correct sentences, run again today. Proof the check can fail: `eval/results-2026-11-21-bypass.md` (reviewer bypassed and every sentence flagged) shows 20. | The gold set was drafted by a model and no fluent speaker has reviewed it. The run used the local model only. Errors caught moved between runs: 20 of 20 in the run committed earlier today, 19 of 20 in the run above (the model is not deterministic), which is why `eval/results-2026-11-21.md` is updated in this commit. Shown on correct sentences was 0 both times. The Claude run is a paid step and has not run. |
| 9 | The scene ends when all goal steps are done or the learner presses End; both open the recap | partly met | End path in a browser: pressing "End conversation" showed "You ended the conversation." and an "Open recap" link to `/s/lisbon-cafe-pt/recap/<session id>`; the recap page loaded. Goal path: `src/conversation/loop.test.ts` ("ends with reason goal when every step is done"). | The goal path was not run in a browser. In the synthetic session the judge never marked the `pay` step on a line that asked for the bill and said thanks, so that session ended by End, not by goal (see findings). |
| 10 | Recap shows phrases used, each mistake with learner text, corrected form and rule, exactly three practise phrases, all in the transcript or targets | met (automated) | `src/recap/build.test.ts` and `src/recap/view.test.ts` in `npm test`. Browser: the synthetic session opened as a recap shows the headings Phrases used, Mistakes, Phrases to practise, Transcript, two mistakes with "You said", "Corrected form", "Reason" and two chips. The synthetic recap lists 3 practise phrases. | Not run on a recap from a real learner session. |
| 11 | The scene screen shows the signage notice from spec section 5.7 | met (checked in a browser) | `/s/lisbon-cafe-pt/play` shows the notice "Text on signs inside the generated scene may be wrong. Use the labels shown by the app." | Nothing. |
| 12 | `git ls-files` has no `.spz`, `.ply`, `.glb`, audio or video file; the built bundle holds no API key string | met (automated) | `git ls-files` search and `dist` search, output below. The search was shown to catch a planted key. | Nothing. |
| 13 | With `PAID_PROVIDERS=off`, choosing a paid adapter fails with a visible error and no request leaves the app | met (checked in a browser) | Headless Chrome with network logging on the play page, `/api/config` says `paidProviders: off`. Choosing each paid option in the footer (speech to text, language model, speech) showed "Paid providers are off. <name> was not used.", the select went back to the free option, and 0 requests were sent after the choices. Unit tests in `src/providers/paid-guard.test.ts`. | Checked in headless Chrome through the DevTools network log, not by eye in the network panel of a visible window. |
| 14 | The unslop audit ran before the screens and again before UI is done; findings fixed or listed | partly met | `draft/AUDIT.md` (phase 1, on the draft) and `docs/unslop-audit-app.md` (task 22 and the authoring screens). Fixed items and waived items are listed in both. | The fresh-eyes reviewer step was skipped in both (no subagents). Safari was not checked. One audit finding (overlays hidden by a CSS rule, "left as is") was fixed afterwards in commit `Fix review findings in the play page, steps judge and recap order` and the audit was not rerun after that fix. |

## Output pasted for the sheet

`npm test`:

```
RUN  v5.1.1 /Users/nickv/ClaudeCode Projects/language-room/.claude/worktrees/build
Test Files  48 passed (48)
Tests  396 passed (396)
Duration  1.31s (tests 32%, transform 31%, import 28%, worker 9%)
```

`npm run validate:scenarios`:

```
lisbon-cafe-pt valid, unlisted (reviewed: missing, so the scenario is unlisted and will not appear in the library)
```

`git ls-files | grep -E "\.(spz|ply|glb|wav|aiff|mp3|mp4|webm)$"` (no output, grep exit 1 means no file matched):

```
(no output)
```

Built bundle key search after `npm run build` (patterns: `AIza...`, `sk-ant-...`, `sk-...`, `WLT_API_KEY`, `ANTHROPIC_API_KEY`), `grep -rEl <patterns> dist` printed nothing and exited 1. The same grep on a file holding a planted `sk-ant-` string printed the file and exited 0.

`npm run check:level`:

```
file: eval/transcripts/phase-2-synthetic-2026-11-21.json
line 1: 4.0 words per sentence (8 words, 2 sentences)  Bom dia! O que gostaria de tomar hoje?
line 2: 9.0 words per sentence (9 words, 1 sentences)  Um café e um pastel de nata, por favor.
line 3: 6.0 words per sentence (12 words, 2 sentences)  Aqui está o seu café e o seu pastel. Mais alguma coisa?
line 4: 5.0 words per sentence (5 words, 1 sentences)  Quer a conta, por favor?
line 5: 7.0 words per sentence (7 words, 1 sentences)  O galão custa um euro e sessenta.
line 6: 3.5 words per sentence (7 words, 2 sentences)  Fico feliz que goste. Quer pagar agora?
line 7: 4.0 words per sentence (8 words, 2 sentences)  Aqui está a conta. Muito obrigada pela visita!
line 8: 4.0 words per sentence (8 words, 2 sentences)  Bom dia! O que gostaria de tomar hoje?
average: 4.9 words per sentence over 8 character lines, level A2, limit 12
ok
```

`npm run eval` (machine load was 14 when it started, below the 20 limit):

```
> language-room@0.0.0 eval
> tsx eval/run-gold.ts
........................................
sentences run: 40 of 40
corrections shown on correct sentences: 0
errors caught: 19 of 20
errors missed: 1
wrong fixes shown on error sentences: 1
issues held as unsure: 0
issues dropped as incorrect: 0
calls made: 60
failures: 0 sentences, 0 calls
results written to eval/results-2026-11-21.md
```

## States checklist on the real screens

Checked with headless Chrome against the dev server. A cell says what was seen, or "not checked". Hover was not checked anywhere, so "hover/focus" means focus only. The recap rows used the synthetic session, saved into the browser database by a script; the "many mistakes" row used 8 copies of one mistake as layout data, not real mistakes.

| State | Library `/` | Brief `/s/lisbon-cafe-pt` | Scene `/s/lisbon-cafe-pt/play` | Recap `/s/lisbon-cafe-pt/recap/<id>` |
|---|---|---|---|---|
| default | checked (h1 "Scenarios") | checked (h1 "Coffee at a Lisbon café") | checked (same h1, conversation and scene area) | checked (h1 "Recap, Coffee at a Lisbon café", three controls, four sections) |
| hover/focus | focus only: 2 px solid outline on the first link after Tab | focus only: 2 px solid outline on a button | focus only: 2 px solid outline on a button | focus only: 2 px solid outline on "Start again" |
| empty | checked (library shows "No scenarios are available yet. Add a reviewed scenario file to the scenarios folder.") | not checked | checked ("Dona Amélia is about to speak." before the greeting) | checked (session with no mistakes: "No mistakes found in this session ..."; one-turn session: "No mistakes found in this turn."; unknown id: "Session not found") |
| loading | not checked | not checked | checked (progress bar and "Loading the scene, N percent" with the sample room) | checked ("Preparing your recap.") |
| error | not checked | not checked (microphone problems are covered by `src/ui/briefContent.test.ts` only) | checked ("Scene unavailable, continuing without it" with the café file absent). Reply failure copy is covered by `src/ui/replyError.test.ts` only | not checked |
| long content | not checked | not checked | not checked | checked (8 mistakes render, no horizontal scroll at 375 px; the "five first" split was not checked) |
| small screen | checked (375 px wide, page width 375) | checked (page width 360 at 375 px) | checked (page width 360 at 375 px, scene area closed) | checked (page width 375 at 375 px) |
| dark mode | checked (page background rgb(18, 21, 26)) | checked (same) | checked (same) | checked (same) |

Named states from spec section 6 that were not run in a browser: Brief microphone denied, no microphone, speech provider unreachable; Scene speech returned nothing, reply timeout with Retry, speech output failed, very long learner line; keyboard checks (space bar toggles the microphone, every control reachable). The learner-silent state was seen once: after 20 seconds with no input the page added a second character line and "Hint: Say good morning."

## Needs the owner

1. Paid Marble export of the café scene (plan tasks 3 and 4). Unlocks the café scene for criterion 3 and the scene half of task 21.
2. A fluent European Portuguese speaker for: the scenario sign-off (criterion 2), the gold set, the speech sentences, the voice ratings, and the review sheet `eval/transcripts/phase-2-synthetic-2026-11-21.md` or, better, the real sheet from item 3.
3. A learner at a real microphone (tasks 13, 17 and 23), following `eval/transcripts/README.md`.
4. A Safari run of the full loop and the scene.
5. Teacher interviews for phase 5.
6. The Quest 3 headset for task 27.
7. The Claude run of the gold set (`npm run eval` with the paid provider on). It costs money and needs the owner's approval.

## Found while running these checks

- The goal-step judge did not mark `pay` in the synthetic session, on the scripted line "A conta, por favor. Obrigado.", which Whisper heard as "A conta? Por favor. Obrigado.". The same transcript run through the judge prompt from before the fix of finding 2 marked `pay` both times; with the current prompt it left `pay` open both times. The new prompt that makes the judge check every part of a hint is stricter than the case needs. `npm run steps:live` still passes 7 of 8 cases, with the line "orders the coffee and then the tart in two lines" as a known miss.
- Character lines from the local model that a fluent speaker should look at: line 2 "Um café e um pastel de nata, por favor." (the owner repeats the order as if she were the customer), line 4 "Quer a conta, por favor?" (asks the customer to ask for the bill), and the last line, which greets again after the learner said "Bom dia." a second time.
- Of the 3 scripted learner errors, 2 were shown with the expected correction. The third (a missing contraction) was heard by Whisper as a different, correct sentence, so there was nothing left to correct.
