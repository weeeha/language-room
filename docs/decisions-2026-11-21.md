# Decisions made during the build run, 2026-11-21

The owner asked the run to take the recommended option at every gate and to record it here for later review. Each line is a decision and its reason. Nothing here was pushed, deployed or paid for.

## Setup

1. **Build from `origin/main`.** It already holds the phase 0 spike plus two README commits, so no other branch had extra work.
2. **One commit per task on `build/language-room`.** The plan asks for a branch and pull request per task. This run cannot push, so the split into pull requests is left to the owner.
3. **The controller reviews each task itself.** It reads the diff and reruns the checks. No second reviewer agent, to save usage.

## Phase 0

4. **Task 3 skipped.** Marble export costs money. Paid steps stay off.
5. **Task 4 skipped.** It measures the files from task 3. The sample-room numbers from task 2 stay as the provisional result.

## Phase 1

6. **Portuguese copy is marked "not yet reviewed by a fluent speaker".** No reviewer was available and none is invented.
7. **Scene placeholder is a plain labelled area.** The only screenshot on hand shows a bedroom, which would mislead.
8. **Draft shared as a local link only.** No Vercel preview without the owner.
9. **Draft approved by the owner** (reply "1 Approve").

## Phase 2

10. **Vanilla TypeScript, no UI framework.** The plan names plain `.ts` files and the screens are small.
11. **TypeScript pinned at 6.0.3.** typescript-eslint 8.73.0 does not accept 7 yet.
12. **The café scenario ships with no `reviewed` entry.** It validates as unlisted. A fake reviewer id would break the correctness rule.
13. **Local model: Gemma 4 E4B on llama-server, port 11434.** It is already on this Mac and costs nothing. Claude stays behind the paid guard.
14. **Local speech-to-text: whisper.cpp with large-v3-turbo.** Already installed. The browser engine stays as the second free option.
15. **Synthetic stand-in for the mis-hearing test.** The macOS voice Joana read the 30 sentences into Whisper. A learner reading aloud is still needed, so the default engine is provisional.
16. **Gold set drafted by a model and marked unreviewed.** The eval runs on the local model only. The Claude run is a paid gate.
17. **Voice default: Joana (pt-PT) at rate 0.85, provisional.** It is the only pt-PT voice that runs here without an install. Ratings by a fluent speaker are still open.
18. **LLM streaming added.** The task 15 check needs audio to start before the full reply arrives.
19. **Hidden reasoning switched off for character replies.** Measured on the same request: 4.0 s and an empty reply with it on, 0.32 s and a good reply with it off. The correction checker keeps it on, because its gold-set result was measured that way.
20. **Task 16 split into two commits.** The loop first, then the page.
