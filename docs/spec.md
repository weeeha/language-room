# Language room - Design Spec

- **Date:** 2026-10-27
- **Status:** draft, pending owner review before the implementation plan starts
- **Surface:** a browser app with four screens (library, brief, scene, recap) and a local server for API keys. Out of scope: other languages, real-time generated worlds, animated 3D characters, accounts, payments, a public marketplace, a mobile app. The Quest 3 view is an optional late phase.

## 1. Summary

Language room lets a learner practise speaking by walking into a generated place and talking to the character in it. Each place is a World Labs Marble scene, generated once, exported and viewed in the browser with three.js and Spark. The character is voiced by an LLM that keeps to the learner's level and corrects gently. After the scene the learner gets a recap with phrases used, mistakes and three phrases to practise.

The conversation loop is built and tested before the scene is attached. The scene is context and memory cue. The lesson comes from the character's voice and the corrections. The first build covers one language (European Portuguese) and one scenario (a Lisbon café).

## 2. Goals / non-goals

**Goals**

- A learner at A2 completes a spoken café scenario in Portuguese and reads a recap that a fluent speaker judges accurate.
- The scenario is a plain file (place, character, goal, level) that a teacher can eventually write without code.
- No wrong grammar is presented to the learner as a correction.
- The conversation works when the scene fails to load. The scene adds context and never gates the lesson.
- Total cost stays at $0 until the owner approves a paid tool, and every paid step is visible in the plan.

**Non-goals** (each prevents a "why did you touch X" later)

- Real-time generated worlds. Genie 3 and Runway GWM Worlds 2 have no public API.
- A generated scene that changes as the learner talks. Each scene is static and exported once.
- Teaching from text that appears inside the generated scenery. World models render text poorly.
- Animated or lip-synced 3D characters.
- Grading, certifying or tracking a learner's level over time.
- User accounts, cloud sync, payments.
- A second language before the first one passes its real-input test.
- Hosting a public service. The first build runs locally and as an unlisted preview.

## 3. Information architecture

| Route | Screen | Purpose |
|---|---|---|
| `/` | Library | List of scenarios with language, level, place, goal. One scenario in the first build. |
| `/s/:id` | Brief | Place, character, goal, level, useful words, microphone check, start button. |
| `/s/:id/play` | Scene | Scene viewer, character panel, transcript, microphone control, end button. |
| `/s/:id/recap/:sessionId` | Recap | Phrases used, mistakes, three phrases to practise, replay of the transcript. |
| `/author` | Authoring | Teacher form to write a scenario. Phase 5, outline only. |

**Scene screen layout.** The conversation panel is the primary element and holds the transcript, the "what I heard" confirmation and the correction chips. The scene viewer fills the background or a side panel. On a phone-width screen the viewer collapses to a header image that expands on tap.

**Landing behavior.** `/` shows the library. A returning learner sees their last recap linked under the scenario card (stored in the browser only).

**Removed or moved.** Nothing exists yet. The static HTML draft in `draft/` (phase 1) is replaced by the real screens and then deleted.

## 4. Data model

### 4.1 Scenario

One JSON file per scenario in `scenarios/`, validated by `scenarios/schema/scenario.schema.json`.

```json
{
  "id": "lisbon-cafe-pt",
  "version": 1,
  "title": "Coffee at a Lisbon café",
  "language": { "code": "pt-PT", "name": "European Portuguese" },
  "level": "A2",
  "place": {
    "name": "Pastelaria in Alfama",
    "scene": {
      "file": "media/lisbon-cafe/scene-500k.spz",
      "format": "spz",
      "source": "marble",
      "prompt": "A small Lisbon pastelaria, tiled walls, glass pastry counter, espresso machine, two tables by the window",
      "spawn": { "position": [0, 1.6, 2], "lookAt": [0, 1.4, -1] }
    },
    "hotspots": [
      { "id": "pastel-de-nata", "position": [0.4, 1.0, -0.8], "word": "o pastel de nata", "gloss": "custard tart" }
    ],
    "signage": [
      { "id": "menu", "anchor": [1.2, 1.8, -1.5], "text": "Café 1,00 | Galão 1,60 | Pastel de nata 1,30" }
    ]
  },
  "character": {
    "name": "Dona Amélia",
    "role": "café owner behind the counter",
    "persona": "Friendly, a little hurried, speaks clearly, repeats once when asked.",
    "voice": { "tts": "default-pt-PT-female", "rate": 0.85 }
  },
  "goal": {
    "description": "Order a coffee and a pastry, then ask for the bill.",
    "steps": [
      { "id": "greet", "hint": "Say good morning." },
      { "id": "order", "hint": "Ask for a coffee and a pastel de nata." },
      { "id": "pay", "hint": "Ask for the bill and say thank you." }
    ],
    "completion": "all steps done or learner ends the scene"
  },
  "targets": {
    "phrases": ["Bom dia", "Queria um café, por favor", "A conta, por favor", "Quanto é?"],
    "grammar": ["polite request with 'queria'", "indefinite articles um/uma"]
  },
  "reviewed": { "by": "fluent-reviewer-id", "on": "2026-11-01" }
}
```

Rules enforced by the validator:

- `level` is one of A1, A2, B1, B2.
- `language.code` is a BCP 47 tag.
- `place.scene` may be absent. The scenario then plays without a scene.
- Every `signage.text` is authored. The generated scene's own text is never read.
- `reviewed` must be present for a scenario to appear in the library. A fluent reviewer checks the persona, the target phrases and the signage text.

### 4.2 Session

Created when the learner starts the scene, stored in the browser (IndexedDB). Audio is not stored.

```
Session   { id, scenarioId, scenarioVersion, startedAt, endedAt, endReason, turns[], stepsDone[], providers }
Turn      { id, role: "learner" | "character", text, heardText?, confirmed?, at, latencyMs? }
Issue     { id, turnId, span, type, suggestion, rule, verdict: "correct" | "incorrect" | "unsure", shown: boolean }
```

- `heardText` is what speech-to-text returned. `text` is what the learner confirmed or edited.
- `providers` records which STT, LLM and TTS ran, for the evaluation sheet.
- Only issues with `verdict: "correct"` have `shown: true`.

### 4.3 Recap

Built from the session by the recap step.

```
Recap { sessionId, phrasesUsed[], mistakes[], practise[], generatedAt }
mistakes[]: { learnerText, corrected, rule, turnId }   // verified issues only
practise[]: { phrase, why, example }                   // exactly three
```

## 5. Decisions

### 5.1 Scene source: Marble, exported once

World Labs Marble builds a persistent 3D scene from text, an image or a video. Read on docs.worldlabs.ai on 2026-10-27:

- Splat export in SPZ and PLY, with lower-resolution tiers. The API lists 100k and 500k splat versions beside the full-resolution file.
- Collider mesh (GLB) on the Standard plan. Textured mesh (GLB) and commercial rights on the Pro plan. The Free plan can generate worlds but cannot export them.
- A public World API exists: `POST /marble/v1/worlds:generate`, polling on `GET /marble/v1/operations/{id}`, `POST /marble/v1/worlds/{id}:export`. Authentication is an API key in the `WLT-Api-Key` header. Usage is credit-based. Generation is documented as about 5 minutes.
- **Prices and credits per world: unverified.** The docs do not list them. A secondary source quoted a mesh export price. It was not confirmed and is not used here.
- The plan names and what each includes may change. Re-read the docs before paying.

Why exported and static: Genie 3 and GWM Worlds 2 have no public API, and generated-on-the-fly worlds drift and forget. A static splat does neither. The cost is that the scene cannot react to the conversation.

### 5.2 Viewer: three.js plus Spark

Spark is a 3D Gaussian splat renderer for three.js, made by World Labs. Its page lists PLY, SPZ, splat and KSplat support. **WebXR support in Spark: unverified.** Quest 3 performance with 500k splats: unverified. Both are checked in the optional Quest phase before any promise is made.

Default asset: the 500k SPZ tier, chosen to keep download and load time down. The phase 0 spike measures size and load time for each tier and fixes this default.

### 5.3 Conversation first, scene second

Phase 2 builds the full conversation loop with no scene. Phase 3 attaches the scene. If the scene fails to load, the scene screen shows the character panel on a plain background with a notice. The lesson continues.

### 5.4 The character is a voice and a name tag

No animated 3D character in the first build. The character appears as a name tag anchored near the counter in the scene, a portrait in the panel, and a speaking indicator while the audio plays.

### 5.5 Correction style

- **In the scene:** the character keeps the conversation moving and does not stop to explain. A verified correction appears as a small chip under the learner's line with the corrected form.
- **In the recap:** each verified mistake is listed with the corrected form and a one-line reason.
- The character's spoken reply is generated from the confirmed learner text and the scenario. It does not contain corrections, because a spoken line cannot be taken back if the check later disagrees.

### 5.6 How corrections are checked

Correctness is the main risk of the product. Two LLM calls, plus a human-checked test set.

1. **Analyzer.** Input: confirmed learner line, language, locale, level, scenario context. Output: a list of issues, each with the span, a type (grammar, vocabulary, word order, register, pronunciation-suspected), a suggestion and a short rule name. It runs in parallel with the character reply, so it adds no wait to the conversation.
2. **Reviewer.** A separate call with a different prompt, preferably a different model. Input: the same line and one issue. Output: `correct`, `incorrect` or `unsure`, with a one-sentence reason. The reviewer is told to separate an error from a valid form of another variety (for example Brazilian Portuguese) and to label the latter as a variety note.
3. **Gate.** Only `correct` issues are shown. `incorrect` issues are dropped. `unsure` issues are logged, never shown as fact, and never appear in the recap.
4. **Mis-hearing guard.** Speech-to-text can change what the learner said. The learner confirms or edits the transcript before it is sent. Issues on words the STT flagged as low confidence are marked "possibly misheard" and are held back.
5. **Evaluation set.** `eval/gold-pt-PT.json` holds sentences written and labelled by a fluent speaker: some with known errors and some correct. The checker runs against it on every change to the prompts or the provider. Any correction shown on a correct sentence fails the run. This catches regressions. With a small set it does not prove the checker is right, so the real-input test (section 6) stays the gate.
6. **Character replies can be wrong too.** The reply is not blocked by a check, because that adds delay. The real-input test has the fluent reviewer audit the character's lines. A "report a mistake" button on every character line logs reports for review. A blocking check for A1 and A2 replies is a candidate if the audit finds errors, with its delay measured first.

### 5.7 Scenery text

Generated scenes may contain wrong signage text: letters that do not form words, wrong spellings, mixed languages. Decisions:

- Text visible in the scene is decoration and is never used for teaching.
- Text the learner should read is authored in `place.signage` and drawn as an HTML overlay anchored in the scene.
- The brief and the scene screen carry one plain line: "Text on signs inside the generated scene may be wrong. Use the labels shown by the app."
- The scenario review checks the exported scene for large, prominent text and, if present, regenerates or crops it out. No automatic detection in the first build.

### 5.8 Provider options

Each provider sits behind an adapter with one interface, so a swap changes one file. Recommended option first.

**Speech-to-text.** Must handle the target language and learner accents.

| # | Option | Cost | Tradeoff |
|---|---|---|---|
| 1 | Local Whisper-class model (faster-whisper or whisper.cpp) on a home GPU box | $0 | Handles accents well in general, needs a server running. Models tend to normalize errors into correct text, which hides what the learner said. The confirm step and the measurement in task 13 cover this. pt-PT accuracy unverified. |
| 2 | Browser speech recognition (Web Speech API) | $0 | Zero setup. Behavior and language support differ between Chrome and Safari, and some browsers send audio to the vendor. pt-PT support unverified. |
| 3 | Hosted STT (Deepgram, OpenAI, Google) | **Paid, price unverified** | Fast and consistent. Needs owner approval. |

**LLM character, analyzer and reviewer.**

| # | Option | Cost | Tradeoff |
|---|---|---|---|
| 1 | Claude API | **Paid, price unverified for the chosen model** | Best expected quality in the target language and best instruction following for level control. Needs owner approval. Default once approved. |
| 2 | Local open-weight model served by llama.cpp or Ollama on a home GPU box | $0 | Free and private. Quality in Portuguese and reliability as a reviewer: unverified, measured on the gold set. This is the default until the owner approves paid tools. |

The reviewer should differ from the analyzer. With one provider, use a different prompt and a lower temperature. With two, use one for each.

**Text-to-speech.** Must sound native.

| # | Option | Cost | Tradeoff |
|---|---|---|---|
| 1 | Browser speech synthesis | $0 | No setup. Voice quality and the availability of a pt-PT voice depend on the operating system and browser. Unverified. |
| 2 | Local open-weight TTS (Piper or Kokoro) | $0 | Better control, needs a server. pt-PT coverage and naturalness: unverified. |
| 3 | Hosted TTS (ElevenLabs, OpenAI, Google Cloud) | **Paid, price unverified** | Most natural voices likely. Needs owner approval. |

A fluent speaker rates the candidate voices in phase 2. The decision is recorded in `docs/spikes/voices.md`.

### 5.9 Keys, privacy and storage

- API keys live in a local `.env` file and in the local Node server. The browser bundle contains none.
- Sessions, transcripts and recaps are stored in the browser only. No server stores learner data.
- Audio is streamed to the chosen STT provider and not saved by the app. The brief says which provider receives the audio.
- No analytics in the first build.

### 5.10 Scenario format is JSON

A schema-validated JSON file, no parser dependency in the browser. Teachers get a form in phase 5 that writes this file. YAML is a candidate later if teachers edit files by hand.

### 5.11 Spend controls

A `PAID_PROVIDERS=off` flag is the default. With it off, any call to a paid adapter throws before sending. Each session shows provider names and a call count in a debug footer.

### 5.12 Cost flags

| Step | Why it costs | State |
|---|---|---|
| Marble export on the Standard plan, or API credits | Free plan cannot export | Needs owner approval. Price unverified. |
| Marble Pro (textured mesh, commercial rights) | Needed only for mesh or commercial use | Not planned. |
| Claude API | Per-token billing | Needs owner approval. Price unverified. |
| Hosted STT or TTS | Per-minute or per-character billing | Needs owner approval. |
| Hosting beyond a free preview, a domain | Not needed for the first build | Not planned. |
| Quest 3 testing | Needs the headset | Owner's device. |

## 6. Acceptance criteria & states

**Done means** (first build, one scenario):

1. `npm test` passes, and the scenario validator rejects a file with a missing `level` with a message naming the field `level`.
2. `lisbon-cafe-pt.json` validates and carries a `reviewed` entry from a fluent speaker.
3. Opening `/s/lisbon-cafe-pt/play` loads the scene and shows a progress indicator while loading. With the scene file renamed, the page still starts and shows the notice "Scene unavailable, continuing without it".
4. The learner presses the microphone, speaks, and sees "What I heard" with edit and confirm controls. The turn is sent only after confirm.
5. After confirm, the character's text appears and its audio starts within 4 seconds on the reference machine (proposed target, measured in phase 2). The reference machine is recorded in the results file.
6. At level A2, character lines average 12 words or fewer per sentence, measured by a script over the transcript. A fluent reviewer rates the character's lines as natural pt-PT with 0 grammar errors, or lists the errors found.
7. A correction chip appears only for issues with verdict `correct`. The session log shows every `incorrect` and `unsure` issue as not shown.
8. The gold-set run reports 0 corrections shown on correct sentences.
9. The scene ends when all goal steps are done or the learner presses End. Both paths open the recap.
10. The recap shows phrases used, each mistake with learner text, corrected form and rule, and exactly three practise phrases. Every phrase in the recap appears in the session transcript or in the scenario's `targets.phrases`.
11. The scene screen shows the signage notice from section 5.7.
12. `git ls-files` shows no `.spz`, `.ply`, `.glb`, audio or video file. A search of the built JavaScript bundle finds no API key string.
13. With `PAID_PROVIDERS=off`, selecting a paid adapter fails with a visible error and no network request leaves the app. Checked in the browser network panel.
14. The unslop audit has been run before the screens were built (phase 1) and again before UI is called done, and its findings are fixed or listed.

**States checklist** - every primary surface covers:

For each of Library, Brief, Scene and Recap:

- [ ] default · [ ] hover/focus · [ ] empty · [ ] loading · [ ] error · [ ] long content · [ ] small screen · [ ] dark mode

Each box is ticked in phase 1 on the draft and ticked again on the real screen. Specific states that must exist:

- Brief: microphone permission denied, no microphone found, STT provider unreachable.
- Scene: scene loading with progress, scene failed, STT returned nothing, LLM timeout (retry button, the turn is kept), TTS failed (text only, with a notice), learner silent for 20 seconds (gentle prompt from the character), very long learner line.
- Recap: session with no mistakes, session ended after one turn, session with many mistakes (list scrolls, top five shown first).
- Keyboard: every control reachable, microphone toggle on the space bar, visible focus, captions always on.

**Explicitly not doing:** other languages, animated characters, learner accounts, scoring or level estimates, real-time scene generation, public hosting, paid providers without owner approval.

## 7. File touch list

Added (no existing code to edit or delete; the repo holds only a stub README):

```
README.md                          replaced (this branch)
docs/spec.md                       this file
docs/implementation-plan.md        phased plan
docs/spikes/phase-0-results.md     measurements from the Marble spike
docs/spikes/voices.md              voice and provider decision
.gitignore                         media/, .env, node_modules/, dist/
.env.example                       key names only, no values
package.json, tsconfig.json, vite.config.ts, vitest.config.ts
draft/                             static HTML draft of the four screens (phase 1, deleted after phase 3)
scenarios/schema/scenario.schema.json
scenarios/lisbon-cafe-pt.json
src/scenario/                      load and validate
src/providers/                     stt.ts, llm.ts, tts.ts, adapters, paid-guard.ts
src/conversation/                  prompt builder, loop, level guard, corrections (analyzer, reviewer, gate)
src/scene/                         viewer, hotspots, signage overlays, fallback
src/recap/                         recap builder
src/ui/                            screens and components
server/                            local proxy holding API keys
eval/gold-pt-PT.json               fluent-speaker labelled sentences
eval/transcripts/                  session logs for review (local, ignored if they hold audio)
media/                             local only, ignored by git
```

The reviewer diffs the branch against this list.

## 8. Verification plan

- **Automated:** type check, lint and `vitest` for the validator, prompt builder, level guard, correction gate, recap builder and paid-guard. The correction gate has a test that an `unsure` verdict never reaches the UI or the recap.
- **Evaluation run:** `npm run eval` runs the gold set through analyzer and reviewer and prints shown corrections on correct sentences (must be 0) and issues caught on erroneous sentences (reported).
- **Visual gate:** screenshots of each screen at 375 px and 1280 px wide, light and dark, in Chrome and Safari, plus the states table. Run unslop before building screens and again before calling UI done.
- **Browser matrix:** Chrome and Safari for the full loop, including microphone permission and scene loading.
- **Scene check:** record file size, load time and frame rate per splat tier on the reference machine in `docs/spikes/phase-0-results.md`. Proposed pass targets, set before measuring: 500k SPZ loads in 10 seconds or less on home broadband, frame rate stays at 30 or higher while looking around. Fail means pick a lower tier or drop the scene from the default view.
- **One real-input test:** a learner at A2 level in Portuguese completes the Lisbon café scenario by voice, speaking into a real microphone, with the real providers selected for that run. The session transcript, the corrections shown, the corrections held back and the recap are exported. A fluent Portuguese speaker (European variety) reviews the export and marks every shown correction as right or wrong, every character line as natural or not, and every recap item as accurate or not. The test passes when no shown correction is marked wrong, no recap item is marked inaccurate, and the reviewer's list of character-line errors is empty or each item is fixed in the prompt and the session is repeated. The reviewer's sheet is saved in `eval/transcripts/`. Green unit tests do not count as this.
