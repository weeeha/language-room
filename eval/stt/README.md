# Speech-to-text mis-hearing measurement

Question: when a learner says a sentence with a grammar error, does the engine write down what was said, or does it quietly fix the error? A silent fix hides the mistake from the coach. The "What I heard" confirm row is the mitigation, because the learner sees the text before it is sent.

## Files

- `sentences-pt-PT.json`: 30 sentences. 20 have one deliberate learner-style error (wrong gender article, wrong verb form, missing article, wrong preposition contraction). 10 are correct. Status: not yet reviewed by a fluent speaker (`"reviewed": null`).
- `run-synthetic.ts`: the synthetic run. `npm run eval:stt:synthetic` (needs the server running; set `PORT` if it is not 5188).
- `results-synthetic-<date>.json`: output of the synthetic run (text only, no audio).

## Procedure for the human test

Step 2 first. These steps need people and have not been run.

1. A fluent speaker of European Portuguese reads `sentences-pt-PT.json`. They confirm each error is a real error, unambiguous, and that `corrected` is right. They set `reviewed` to their name and the date and change `status`. Fix or replace any sentence they reject.
2. A learner (a person with the accent we care about) reads each of the 30 sentences aloud exactly as written, including the errors. Do not correct while reading. Quiet room, same microphone for every engine.
3. Run each engine on the same 30 readings:
   - Local Whisper: start `npm run server`, start the app, pick "Local Whisper".
   - Browser recognition in Chrome and in Safari: pick "Browser speech recognition".
   - Save the heard text next to the written text, one row per sentence, per engine.
4. For the 20 error sentences count each result as one of:
   - kept: the error is still in the heard text.
   - silently fixed: the heard text equals `corrected`, ignoring case and punctuation.
   - other: changed some other way (a mishearing, a dropped word).
   For the 10 correct sentences count exact matches (ignoring case and punctuation). Also note overall accuracy in pt-PT with this learner's accent.
5. Fill the table below and decide the default (see Decision).

## Results

| Engine | Sentences | Errors kept | Errors silently fixed | Other | Exact on correct sentences | Date | Reader |
|---|---|---|---|---|---|---|---|
| Local Whisper (large-v3-turbo, whisper.cpp) | 30 | not run | not run | not run | not run | not run | not run |
| Browser recognition, Chrome | 30 | not run | not run | not run | not run | not run | not run |
| Browser recognition, Safari | 30 | not run | not run | not run | not run | not run | not run |
| Local Whisper, synthetic voice Joana, not a learner; shows whether Whisper normalizes errors in clean speech | 30 | 11 of 20 | 3 of 20 | 6 of 20 | 10 of 10 | 2026-11-21 | macOS voice Joana (pt_PT) |

The synthetic row is not a learner and says nothing about real accents. The 6 "other" results are mostly mishearings of the synthetic voice (for example "O mesa" heard as "O Lumeza", "de a sopa" heard as "de assopa") and several turned the article into "um". Details are in `results-synthetic-2026-11-21.json`. The sentence set was not yet reviewed by a fluent speaker when this ran.

## Decision

Provisional: Local Whisper is the first engine in the list. This is based only on one measurement: with clean synthetic speech it kept 11 of 20 errors, silently fixed 3 of 20 (15 percent, below the quarter that would count as a problem) and heard 10 of 10 correct sentences exactly. It is free and runs on this machine.

No claim is made about browser recognition accuracy. It has not been measured.

The confirm step stays as the mitigation in every case, because 9 of 20 errors were not kept as written even in clean speech. The default engine must be re-decided after the human run (steps 2 to 5). If both engines fix more than a quarter of the errors with a real learner, record that and keep the confirm step.
