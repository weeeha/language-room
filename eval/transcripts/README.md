# Session transcripts and review sheets

This folder holds session logs and the sheets a fluent speaker marks. Text and timings only. Audio is never saved, here or anywhere else in the repo.

## What is here

- `learner-script-pt-PT.json`: the scripted A2 learner used by the synthetic run. Seven lines, three with one deliberate error each.
- `phase-2-synthetic-<date>.md` and `.json`: the output of `npm run session:synthetic`. A synthetic stand-in. The learner voice is the macOS voice Joana, not a person, and no fluent speaker has reviewed it. It does not satisfy the real-input test in spec section 8.
- Real runs, once they exist: `phase-2-<date>.md` (task 17) and `phase-4-<date>.md` (task 23), each with the sheet filled in by the reviewer.

## The synthetic run

1. Start the proxy (`npm run server`, port 5188) and the local model behind it.
2. `npm run session:synthetic`. Set `SESSION_BASE_URL` for another proxy address.
3. `npm run check:level` prints the average words per sentence of the character lines and exits 1 when it is above the level limit (12 at A2).

The run uses the real local Whisper and the real local model. It has no scene and no audio output, so its latency is time to first text and says nothing about the scene.

## The real-input test (tasks 17 and 23)

It needs a learner at a real microphone and a fluent European Portuguese speaker. Neither can be replaced by the synthetic run.

Task 17, one sitting:

1. The learner starts the app (`npm run server`, `npm run dev`), opens `/s/lisbon-cafe-pt/play`, and speaks the whole cafe scenario with the real microphone and the providers chosen for the run. The learner confirms or edits each line in "What I heard" as they would normally.
2. After the recap opens, export the session: transcript, every shown correction, every held or not-shown issue, the character lines and the recap. Copy `phase-2-synthetic-<date>.md` as the template and fill it from the real session.
3. The fluent speaker marks, in the sheet: every shown correction right or wrong, every character line natural or not, every recap item accurate or not, and lists anything the app missed.
4. For every item marked wrong, fix the prompt and repeat the session.

Task 23 is the same test end to end with the scene and the recap, saved as a second sheet.

Where the sheet is saved: in this folder, as `phase-2-<date>.md` for task 17 and `phase-4-<date>.md` for task 23. Reviewer name and date go at the bottom.

## Pass rule (spec section 8)

The test passes when all three hold:

- no shown correction is marked wrong,
- no recap item is marked inaccurate,
- the reviewer's list of character-line errors is empty, or each item is fixed in the prompt and the session is repeated.

Green unit tests do not count. The synthetic run does not count.
