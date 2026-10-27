# language-room

Status: exploration. Live URL: none. Started 2026-10-27.

**TL;DR**

- Practise a language by walking into a generated place (a Lisbon café, a Tokyo ticket window, a Paris pharmacy) and talking to the person behind the counter.
- The conversation is the lesson: a character voiced by an LLM keeps to your level and corrects gently. The place supplies context and memory cues.
- After the scene you get a short recap: phrases you used, your mistakes, and three phrases to practise next.

## What it is

A web app for adult self-learners, and for teachers who want a ready-made scene for a class. The core content unit is a **scenario**: one place, one character, one goal ("order a coffee and ask for the bill") and one target level (CEFR A1 to B2).

The first build covers one language (European Portuguese) and one scenario (a Lisbon café). Everything else waits for that loop to work.

## How a session works

1. Pick a scenario and read its brief: place, goal, level, five or six useful words.
2. Walk in. The scene loads in the browser and the character greets you.
3. Talk. You speak, you see what the app heard and confirm it, the character answers in voice and text.
4. Gentle corrections appear next to your lines, only after a second check has agreed with them.
5. The scene ends when you reach the goal or leave.
6. Read the recap: phrases used, mistakes with the corrected form, three phrases to practise next.

## How it works

```
 Scenario file (JSON)
   place + character + goal + level + hotspots + signage
        |
        |-----------------------> Scene viewer
        |                         Marble scene (exported once, kept local)
        |                         three.js + Spark, optional WebXR on Quest 3
        |
        '-----------------------> Conversation loop
                                  mic -> speech-to-text -> learner confirms transcript
                                       -> LLM character reply -> text-to-speech
                                  in parallel: analyzer -> reviewer -> verified corrections
                                       |
                                       v
                                  Session log -> Recap
```

- **The place.** World Labs Marble builds a persistent 3D scene from text, an image or a video. Each place is generated once, exported as a Gaussian splat (SPZ or PLY), and loaded in the browser. Genie 3 and Runway GWM Worlds 2 have no public API, so they are not used.
- **The voice.** Speech-to-text, an LLM character and text-to-speech, each behind an adapter so providers can be swapped. Paid providers stay off until the owner approves them. A local model on a home GPU box is the $0 fallback.
- **Correctness.** Every correction goes through a second review pass before the learner sees it. A correction the reviewer cannot confirm is never shown as fact.
- **Scenery text.** World models render text poorly, so signs and menus in a generated scene may contain wrong or invented words. The app never teaches from text inside the scene. Signs a learner should read are authored in the scenario file and drawn as overlays.

## Stack

- TypeScript, Vite, Vitest.
- three.js and the Spark splat renderer (by World Labs) for the scene.
- A small local Node server that holds API keys and proxies LLM calls. Keys never reach the browser.
- Provider options (recommended first): speech-to-text, local Whisper-class model or browser speech recognition, then hosted; LLM, Claude API or a local model; text-to-speech, browser voices, a local open model, then hosted. Details and costs are in the spec.

## Out of scope

- Languages other than European Portuguese in the first build.
- Real-time generated worlds (Genie 3, GWM Worlds 2): no public API.
- Animated 3D characters. The character is a voice, a name tag in the scene and a portrait.
- Accounts, payments, a public scenario marketplace.
- Grading or certifying a learner's level.
- Mobile apps. The Quest 3 view is an optional late phase.

## Docs

- [Spec](docs/spec.md): goals, data model, decisions, acceptance criteria, verification.
- [Implementation plan](docs/implementation-plan.md): phase 0 spike to phase 5, with checks per task.

## Repository rules

- Branch per task. Pull request per change. Nothing goes to `main` directly.
- Media stays local and out of git: scene exports (`.spz`, `.ply`, `.glb`), audio, recordings and screenshots over 1 MB live in `media/`, which is ignored.
- No API keys in the repo. Keys live in a local `.env` file that is ignored.
- Budget is $0 until the owner approves paid tools. Any step that costs money is flagged in the plan and waits for approval.
- Before any UI is built, and again before it is called done, the `unslop` anti-slop audit runs.
