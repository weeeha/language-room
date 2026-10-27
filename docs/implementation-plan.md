# Language room Implementation Plan

> Steps use checkbox (`- [ ]`) syntax for tracking. Do tasks in order inside a phase. One branch per task, one pull request per change, nothing on `main` directly.

**Goal:** A learner at A2 level completes a spoken Lisbon café scenario in European Portuguese, in a browser, with a generated 3D scene as context, and reads an accurate recap afterwards.

**Architecture:** A scenario file (JSON) describes place, character, goal and level. The scene viewer loads a Marble export with three.js and Spark. The conversation loop runs speech-to-text, an LLM character and text-to-speech behind swappable adapters, with an analyzer and a reviewer producing verified corrections in parallel. A session log feeds the recap. A small local Node server holds API keys. The loop is built and tested without the scene first.

**Tech stack:** TypeScript, Vite, Vitest, three.js, Spark, Node (local proxy), plain HTML for the phase 1 draft. Providers per the spec, section 5.8. Marble for scenes.

**Spec:** [docs/spec.md](spec.md)

**Scope note:** Phases 0 and 1 are written step by step. Phase 2 is written step by step because it is the core of the product, but its provider choices depend on phase 0 and on the voice test in tasks 13 and 15. Phases 3 to 5 and the Quest 3 phase are outlines. Expand each when the phase before it lands, using the measurements from phase 0.

## Global Constraints

- **Budget is $0** until the owner approves paid tools. Steps that would cost money carry the tag **[PAID GATE]** and stop until the owner says yes in writing. Prices that were not read from an official page are labelled "unverified".
- **Draft before build.** Phase 1 is a static HTML draft. No application code for screens before the owner has seen the draft.
- **Run the `unslop` anti-slop audit** before building any screen (task 5) and again before calling UI done (tasks 7 and 22).
- **Media stays local and out of git.** Scene exports, audio, recordings and large screenshots live in `media/`, which is ignored. Task 1 adds the ignore rule before any media exists.
- **No API keys in the repo or the browser bundle.**
- **Correctness first.** No correction reaches the learner unless the reviewer pass returned `correct`. Scenery text is never used for teaching.
- **Writing rules for all prose in this repo:** no em dashes, no exclamation marks, no negative parallelism, plain short sentences.
- **No client names, no claims about the owner.** The repo is public.
- Check every claim about a provider against its official page on the day it is used, and write the date next to it.

## Review Focus

1. **The scene fails to load.** The session still runs, with a notice. Test: `scene-fallback.test.ts` (task 20) and the manual check in task 21.
2. **The reviewer says `unsure` or `incorrect`.** The correction is never shown and never reaches the recap. Test: `corrections-gate.test.ts` (task 14).
3. **Speech-to-text changes what the learner said.** The learner confirms the transcript before it is sent. Check: task 13 compares heard text with spoken text for 20 deliberately wrong sentences.
4. **A paid provider is selected by accident.** The paid guard throws before any request. Test: `paid-guard.test.ts` (task 11).
5. **Wrong text on a generated sign.** The brief and the scene screen state it, and the app draws authored signage only. Check: task 21.

---

# Phase 0 - Spike: one Marble café in the browser

Goal: learn the real file size, load time and frame rate before anything else depends on them. Output: `docs/spikes/phase-0-results.md` and a go or no-go on the scene.

### Task 1: Repo basics

**Files:**
- Create: `.gitignore`, `.env.example`
- The `media/` folder is created locally and ignored, so it holds no placeholder file in git

- [ ] **Step 1:** Confirm the working branch and folder.

Run: `cd "/Users/nickv/ClaudeCode Projects/language-room" && git branch --show-current && git remote -v`
Expected: a task branch (not `main`) and the `weeeha/language-room` remote.

- [ ] **Step 2:** Create `.gitignore` with `media/`, `.env`, `node_modules/`, `dist/`, `*.spz`, `*.ply`, `*.glb`, `*.wav`, `*.mp3`, `*.mp4`, `.DS_Store`.
- [ ] **Step 3:** Create `.env.example` with key names and no values: `WLT_API_KEY=`, `ANTHROPIC_API_KEY=`, `PAID_PROVIDERS=off`.
- [ ] **Step 4:** Prove the ignore rule works before any media exists.

Run: `mkdir -p media && touch media/test.spz && git status --short media .gitignore && git check-ignore -v media/test.spz && rm media/test.spz`
Expected: `git check-ignore` prints the `.gitignore` rule that matched, and `media/test.spz` is not listed as untracked.

**Check:** `git check-ignore -v media/test.spz` printed a rule. A check that prints nothing proves nothing, so the temporary file stays until the rule is shown.

- [ ] **Step 5:** Commit on the task branch and open a pull request.

### Task 2: Viewer spike with a free sample splat

Costs $0. Proves the viewer path before any Marble spend.

**Files:**
- Create: `spike/viewer/index.html`, `spike/viewer/main.js`, `spike/viewer/README.md`
- The sample splat goes in `media/samples/`, ignored.

- [ ] **Step 1:** Find a sample splat file (SPZ or PLY) with a license that allows testing. Candidates: the Spark examples. Record the source URL and license in `spike/viewer/README.md`. If no license is clear, skip to task 3.
- [ ] **Step 2:** Write a minimal page: three.js scene, Spark's splat mesh, orbit or first-person camera, a text readout of load time and frames per second. Pin exact versions of three.js and Spark.
- [ ] **Step 3:** Serve locally and open in Chrome and Safari.

Run: `cd spike/viewer && python3 -m http.server 5173`
Expected: the splat renders and the readout shows a load time and an fps number in both browsers.

**Check:** a screenshot from each browser saved in `media/samples/`, and the numbers copied into `docs/spikes/phase-0-results.md`. If the page is blank, read the browser console before changing anything.

### Task 3: Generate and export the café scene [PAID GATE]

Needs a Marble plan that allows export (the Free plan cannot export) or API credits. **Price: unverified.** Ask the owner to approve before opening any checkout.

**Files:**
- Create: `media/lisbon-cafe/` (ignored), `docs/spikes/phase-0-results.md` (entries only, no media)

- [ ] **Step 1:** Re-read `docs.worldlabs.ai` export and API pages and write the date and the plan that was chosen into the results file.
- [ ] **Step 2:** Owner approves the spend and the plan, in writing.
- [ ] **Step 3:** Generate one world from a text prompt: "A small Lisbon pastelaria, tiled walls, glass pastry counter, espresso machine, two tables by the window". Save the prompt in the results file. Try the image-input route only if the text result is poor, and record both.
- [ ] **Step 4:** Export the splat at each available tier (100k, 500k, full) in SPZ. Export PLY for the 500k tier to compare size. Export the collider mesh only if the plan includes it.
- [ ] **Step 5:** Record credits or money spent, exactly as shown by the account page.

**Check:** the files exist in `media/lisbon-cafe/` with sizes listed by `ls -l`, and `git status` shows nothing from `media/`.

### Task 4: Measure and decide

**Files:**
- Modify: `spike/viewer/main.js` to load a file chosen by query string
- Create: `docs/spikes/phase-0-results.md` (table and decision)

- [ ] **Step 1:** Load each tier in the spike viewer on the reference machine. Reference machine: write its model, browser versions and network type in the results file.
- [ ] **Step 2:** Per tier and browser, record file size, load time (median of 3 cold loads) and fps while turning the camera for 10 seconds.
- [ ] **Step 3:** Inspect the scene from the learner's spawn point. Record: does the counter read as a counter, is any large text visible, which parts look wrong. Take screenshots.
- [ ] **Step 4:** Compare to the proposed targets: 500k SPZ loads in 10 seconds or less, fps 30 or higher. Write the decision: which tier is the default, or whether the scene is dropped from the default view and kept as optional.
- [ ] **Step 5:** Note what the spike did not cover: WebXR (unverified), a phone, a slow network.

**Check:** `docs/spikes/phase-0-results.md` has a filled table with a number in every cell and a one-line decision at the top. The owner reads it before phase 1 starts the scene work.

---

# Phase 1 - HTML draft of the flow

Goal: the owner can click through the four screens and the states before any application code exists. The draft is throwaway.

### Task 5: Constraints pass with unslop

**Files:**
- Create: `draft/CONSTRAINTS.md` (short, replaced by notes in the PR description if the owner prefers)

- [ ] **Step 1:** Run the `unslop` skill in constraints mode before designing: read the audit rules and write the constraints that apply to these four screens (type scale, spacing, one accent colour, no stock gradients, real content in every state, no placeholder lorem).
- [ ] **Step 2:** Write the real copy for the café scenario: brief text, character greeting, three sample turns with one correction chip, recap text. The copy follows the writing rules. A fluent reviewer checks the Portuguese lines.

**Check:** the constraints file lists at least the type scale, the colour tokens for light and dark, and the focus style, each with a value.

### Task 6: Draft the four screens

**Files:**
- Create: `draft/index.html` (library), `draft/brief.html`, `draft/scene.html`, `draft/recap.html`, `draft/states.html` (loading, error, empty, long content), `draft/styles.css`

- [ ] **Step 1:** Library: one scenario card with language, level, place, goal.
- [ ] **Step 2:** Brief: place, character, goal, useful words, microphone check, signage notice, start button.
- [ ] **Step 3:** Scene: a placeholder image where the viewer goes (a screenshot from task 4 if it exists), the conversation panel as the primary element, a "what I heard" confirm row, correction chips, microphone toggle, end button, name tag over the placeholder.
- [ ] **Step 4:** Recap: phrases used, mistakes, three practise phrases, transcript replay.
- [ ] **Step 5:** `states.html` shows: microphone denied, scene unavailable, LLM timeout, TTS failed, silent learner prompt, recap with no mistakes, recap after one turn.
- [ ] **Step 6:** Dark mode via `prefers-color-scheme`. Works at 375 px and 1280 px.

**Check:** open each file in Chrome and Safari at both widths. No horizontal scroll at 375 px. Tab through each page and see a visible focus ring.

### Task 7: Walk the flow, audit, share

**Files:**
- Modify: `draft/*` after the audit

- [ ] **Step 1:** Click through the flow in order: library, brief, scene, recap. Write down every point where the next step is unclear.
- [ ] **Step 2:** Run `unslop` in audit mode on the draft. Fix findings or list them with a reason.
- [ ] **Step 3:** Tick the states checklist from the spec for the draft.
- [ ] **Step 4:** Publish the draft as an unlisted preview (Vercel preview or a local file link) and post the link in the pull request. Confirm the project target and that the link is not public before sharing. Hosting cost: $0 on a free preview, tier unverified.
- [ ] **Step 5:** Owner reviews the draft and answers by number.

**Check:** the owner has replied with approval or a list of changes. Phase 2 does not start before this.

---

# Phase 2 - Conversation loop without the scene

Goal: one language, one scenario, voice in and voice out, verified corrections. No 3D. This phase decides whether the product works.

### Task 8: Project skeleton

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `src/main.ts`, `src/ui/`, `server/index.ts`

- [ ] **Step 1:** Initialise with Vite and TypeScript. Pin exact dependency versions.
- [ ] **Step 2:** Add one trivial test to prove the runner works, run it, and confirm it fails when the assertion is flipped.

Run: `npm test`
Expected: pass, then fail after flipping the assertion, then pass after flipping back.

- [ ] **Step 3:** Add lint and type check scripts. Run both on the empty project.

**Check:** `npm test`, `npm run typecheck`, `npm run lint` all exit 0, and `npm run dev` serves a blank page.

### Task 9: Scenario schema and validator

**Files:**
- Create: `scenarios/schema/scenario.schema.json`, `src/scenario/validate.ts`, `src/scenario/load.ts`
- Test: `src/scenario/validate.test.ts`

- [ ] **Step 1:** Write failing tests:
  - a valid scenario passes;
  - a scenario with no `level` fails and the error text contains `level`;
  - `level: "C2"` fails;
  - a scenario with no `place.scene` passes;
  - a scenario with no `reviewed` entry is valid but is flagged `unlisted`.
- [ ] **Step 2:** Run the tests and confirm they fail for the right reason (validator missing).
- [ ] **Step 3:** Implement the schema and validator per spec section 4.1.
- [ ] **Step 4:** Run the tests and confirm they pass.

**Check:** `npm test -- validate` shows five passing tests.

### Task 10: Café scenario, written and reviewed

**Files:**
- Create: `scenarios/lisbon-cafe-pt.json`

- [ ] **Step 1:** Write the scenario from the spec example: persona, three goal steps, target phrases, grammar targets, hotspots and signage with placeholder coordinates until phase 3.
- [ ] **Step 2:** A fluent European Portuguese speaker reviews the persona text, the target phrases and the signage text and corrects them. Record their identifier and the date in `reviewed`.
- [ ] **Step 3:** Validate it.

Run: `npm run validate:scenarios`
Expected: `lisbon-cafe-pt` valid and listed.

**Check:** removing the `reviewed` block makes the command report the scenario as unlisted.

### Task 11: Provider interfaces, adapters and the paid guard

**Files:**
- Create: `src/providers/stt.ts`, `src/providers/llm.ts`, `src/providers/tts.ts`, `src/providers/paid-guard.ts`, `src/providers/adapters/` (one file per adapter), `server/proxy.ts`
- Test: `src/providers/paid-guard.test.ts`

- [ ] **Step 1:** Define one interface per provider kind. Each adapter declares `paid: boolean`.
- [ ] **Step 2:** Write a failing test: with `PAID_PROVIDERS=off`, calling a paid adapter throws before any fetch is made (spy on `fetch` and assert zero calls).
- [ ] **Step 3:** Implement the guard and make the test pass.
- [ ] **Step 4:** Implement the free adapters first: browser speech recognition, browser speech synthesis, local model over an HTTP endpoint. Stub the paid adapters (Claude, hosted STT and TTS) so they exist but throw with the guard on.
- [ ] **Step 5:** The local server forwards LLM calls and reads keys from `.env`. The browser calls the server, never the provider.

**Check:** `npm test -- paid-guard` passes. Build the app, then run `grep -R "ANTHROPIC" dist/` and `grep -R "WLT_" dist/`. Expected: no matches. First plant a fake key string `sk-test-planted` in a temporary file under `src/`, rebuild, confirm the grep finds it, then remove it, so the check is shown to catch a positive.

### Task 12: Prompt builder and level guard

**Files:**
- Create: `src/conversation/prompt.ts`, `src/conversation/level.ts`
- Test: `src/conversation/prompt.test.ts`, `src/conversation/level.test.ts`

- [ ] **Step 1:** Failing tests for the prompt builder: the prompt contains the character persona, the goal steps, the level and language, the instruction "do not correct the learner in your reply", and the instruction to stay in character.
- [ ] **Step 2:** Failing tests for the level guard: given a reply text and a level, compute average sentence length in words. A2 reply of 20 words per sentence is flagged. A2 reply of 8 words is not.
- [ ] **Step 3:** Implement both. The level guard is a measuring tool for the eval and the log. It does not block replies in the first build.
- [ ] **Step 4:** Run the tests and confirm they pass.

**Check:** `npm test -- prompt level` passes. Print the full assembled prompt for the café scenario and read it once for wrong or leftover text.

### Task 13: Speech-to-text, confirm step and mis-hearing measurement

**Files:**
- Create: `src/ui/HeardConfirm.ts`, `eval/stt/README.md`, `eval/stt/sentences-pt-PT.json`
- Modify: `src/providers/adapters/stt-*.ts`

- [ ] **Step 1:** Build the "What I heard" row with edit and confirm. The turn is sent only after confirm. Test: sending without confirm is impossible (the send function receives only confirmed text).
- [ ] **Step 2:** Write 20 sentences with deliberate learner-style errors (wrong gender, wrong verb form, missing article) and 10 correct ones. A fluent speaker checks them.
- [ ] **Step 3:** The learner reads each sentence aloud, exactly as written, into option 1 (local Whisper-class model) and option 2 (browser recognition). Save the heard text next to the written text.
- [ ] **Step 4:** Count sentences where the engine silently fixed the error. Record per engine in `eval/stt/README.md`. Also record accuracy in pt-PT with an accent typical of the learner.
- [ ] **Step 5:** Pick the default STT from the numbers. If both fix more than a quarter of the errors, record that and keep the confirm step as the mitigation.

**Check:** the results table has a count for each engine on the same 30 sentences. The decision names the engine and the number it is based on.

### Task 14: Correction checker - analyzer, reviewer, gate

**Files:**
- Create: `src/conversation/corrections/analyzer.ts`, `reviewer.ts`, `gate.ts`, `eval/gold-pt-PT.json`, `eval/run-gold.ts`
- Test: `src/conversation/corrections/gate.test.ts`

- [ ] **Step 1:** Failing tests for the gate: a `correct` issue is shown; an `incorrect` issue is not shown; an `unsure` issue is not shown and is never in the recap input; an issue on a word flagged low confidence is held as "possibly misheard".
- [ ] **Step 2:** Implement the gate and make the tests pass.
- [ ] **Step 3:** Write the analyzer and reviewer prompts. The reviewer gets one issue at a time and returns `correct`, `incorrect` or `unsure` with one sentence of reason. The reviewer separates errors from other valid varieties of Portuguese.
- [ ] **Step 4:** A fluent speaker writes the gold set: 40 sentences at A1 to B1, half with a labelled error, half correct, each with the accepted correction.
- [ ] **Step 5:** `npm run eval` runs the gold set through analyzer, reviewer and gate and prints: corrections shown on correct sentences (must be 0), errors caught, errors missed, issues held as `unsure`.
- [ ] **Step 6:** Prove the eval can fail. Temporarily bypass the reviewer so every analyzer issue reaches the gate as `correct`, and make the analyzer flag every sentence. Run the eval and confirm shown-on-correct is above 0. Revert both changes. A zero that cannot turn non-zero proves nothing.
- [ ] **Step 7:** Run with the free local model and, only after owner approval, with Claude **[PAID GATE]**. Record both.

**Check:** the eval prints 0 shown-on-correct for the chosen provider pair, the bypass run printed a number above 0, and results are saved in `eval/results-<date>.md`.

### Task 15: Text-to-speech and voice decision

**Files:**
- Create: `docs/spikes/voices.md`
- Modify: `src/providers/adapters/tts-*.ts`

- [ ] **Step 1:** Generate the same 10 character lines with each free option (browser voices available on the reference machine, a local open TTS model). Save audio to `media/voices/`.
- [ ] **Step 2:** A fluent speaker rates each voice on naturalness and pt-PT accent (1 to 5) and notes mispronounced words.
- [ ] **Step 3:** Record whether any free option reaches a score the owner accepts. If none does, write the hosted candidates with "price unverified" and ask the owner **[PAID GATE]**.
- [ ] **Step 4:** Chunk the reply by sentence so audio starts after the first sentence.

**Check:** `docs/spikes/voices.md` holds the ratings table and the decision. The first audio starts before the full reply has arrived, shown by a timestamp log.

### Task 16: The conversation loop, text first then voice

**Files:**
- Create: `src/conversation/loop.ts`, `src/conversation/session.ts`, `src/ui/ConversationPanel.ts`, `src/ui/Mic.ts`
- Test: `src/conversation/loop.test.ts`

- [ ] **Step 1:** Failing loop tests with fake providers: a confirmed learner line produces a character reply; the analyzer and reviewer run in parallel with the reply; the session records turns, issues and latencies; a provider timeout keeps the turn and allows retry.
- [ ] **Step 2:** Implement the loop and session log. Store sessions in IndexedDB.
- [ ] **Step 3:** Text-only page: type a line, get a reply, see correction chips. Use it to tune the prompts with the free local model.
- [ ] **Step 4:** Add microphone input, the confirm row and spoken replies. Add the 20-second silence prompt and the "report a mistake" button on character lines.
- [ ] **Step 5:** Log latency from end of learner speech to first audio. Print the median over 10 turns.

**Check:** the loop tests pass, and a real 10-turn conversation in Chrome and Safari completes with the median latency printed. If it is over the 4 second target, write where the time goes before changing anything.

### Task 17: Phase 2 real-input test

**Files:**
- Create: `eval/transcripts/phase-2-<date>.md` (review sheet)

- [ ] **Step 1:** A learner at A2 level speaks the whole café scenario into the real microphone, using the providers chosen in tasks 13 to 15.
- [ ] **Step 2:** Export the transcript, every shown correction, every held issue and the character lines.
- [ ] **Step 3:** A fluent European Portuguese speaker marks each shown correction right or wrong, each character line natural or not, and lists anything the app missed.
- [ ] **Step 4:** Fix the prompts for every item marked wrong and repeat the session.

**Check:** a session exists where no shown correction is marked wrong and the character-line error list is empty. The sheet is saved. Phase 3 starts after the owner reads it.

---

# Phase 3 - Put it in the scene (outline)

Expand after phase 0 and phase 2 results. Depends on the chosen splat tier and on whether the scene is the default view.

### Task 18: Scene viewer module
- Files: `src/scene/viewer.ts`, `src/scene/loader.ts`
- Outline: load the scenario's scene file with three.js and Spark, spawn at `place.scene.spawn`, look-around controls that work by mouse, touch and keyboard, loading progress, memory release on leaving.
- Check: the scene appears behind the conversation panel in Chrome and Safari, with fps and load time logged against the phase 0 numbers.

### Task 19: Hotspots, signage overlays, name tag
- Files: `src/scene/hotspots.ts`, `src/scene/signage.ts`, `src/scene/nametag.ts`
- Outline: project 3D anchors to screen positions, draw authored signage as HTML overlays, show the hotspot word card on click or focus, place the character name tag at the counter. Replace placeholder coordinates in the scenario by clicking in the viewer.
- Check: each hotspot opens its word card; the overlay text equals the scenario text exactly; a sign visible in the splat is never read by the app.

### Task 20: Fallback and performance
- Files: `src/scene/fallback.ts`, test `src/scene/scene-fallback.test.ts`
- Outline: on load error or timeout, show the notice and keep the conversation running. Choose a lower tier on slow networks. Pause rendering when the tab is hidden.
- Check: with the scene file renamed, `/s/lisbon-cafe-pt/play` starts a full conversation with the notice.

### Task 21: Phase 3 verification
- Outline: run the full loop in the scene in Chrome and Safari. Check the signage notice. Check the states list for the Scene surface. Re-run the phase 2 real-input session inside the scene and compare latency.
- Check: latency within 1 second of the no-scene run, or the cause written down.

---

# Phase 4 - Recap after a session (outline)

### Task 22: Recap builder and screen
- Files: `src/recap/build.ts`, `src/ui/Recap.ts`, tests
- Outline: from the session log build phrases used (learner turns that match target phrases or were confirmed correct), mistakes (verified issues only), three practise phrases (LLM proposes from mistakes and unmet targets, reviewer pass checks each phrase and example sentence, the gate applies as for corrections). Transcript replay with corrections inline. Run `unslop` on the finished UI before calling it done.
- Check: a test that `unsure` and `incorrect` issues never appear in the recap; a recap on a session with no mistakes still shows three practise phrases drawn from unmet targets.

### Task 23: Full real-input test
- Outline: the spec's real-input test end to end, with scene and recap. Save the reviewer sheet in `eval/transcripts/`.
- Check: all 14 acceptance criteria in the spec section 6 ticked, each with its evidence file or command output.

---

# Phase 5 - Scenario authoring for teachers (outline)

Expand after phase 4. Needs interviews with two or three teachers first; no assumptions about what they want are made here.

### Task 24: Authoring form
- Outline: a form that writes the scenario JSON: language, level, place prompt, character, goal steps, target phrases. Live validation with the same validator. Export and import of the file.
- Check: a scenario made in the form passes `npm run validate:scenarios`.

### Task 25: Scene generation helper
- Outline: take a place prompt, show the Marble prompt to copy, accept the exported file, and place hotspots and signage by clicking in the viewer. **[PAID GATE]** if it calls the Marble API (credit price unverified).
- Check: a teacher produces a new scenario with a scene, without editing JSON.

### Task 26: Review workflow
- Outline: a scenario is unlisted until a fluent reviewer signs it off. Show reviewer name and date on the card. A shareable link for a class.
- Check: an unreviewed scenario is absent from the library and present by direct link with a warning.

---

# Optional - Quest 3 view (outline)

### Task 27: WebXR spike
- Outline: test whether Spark renders in a WebXR session (unverified), frame rate on Quest 3 with the 100k and 500k tiers (unverified), voice in a headset browser, comfort of the spawn height. Needs the owner's headset.
- Check: a short results note with fps per tier and a go or no-go. No product work before the note exists.
