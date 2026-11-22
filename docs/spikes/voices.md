# Voices spike (task 15)

Date: 2026-11-21
Reference machine: Mac Studio M2 Max, macOS 26.6.2.
Status: provisional. No person has rated any voice yet.

## Candidates

The browser's speech synthesis on this Mac exposes the macOS system voices, so a `say` render stands for "browser voices on the reference machine". The audio is a stand-in for what the browser plays, not a recording of it.

| Engine | Voice | Locale | Cost | How generated | Files |
|---|---|---|---|---|---|
| macOS system voice (browser speech synthesis) | Joana | pt-PT | free | `scripts/make-voice-samples.sh`, `say -v Joana -r 150` | `media/voices/say-joana-pt_PT/01.aiff` to `10.aiff` (10 files) |
| macOS system voices | Eddy, Flo, Grandma, Grandpa, Luciana, Reed, Rocko, Sandy, Shelley | pt-BR | free | not rendered | Brazilian, not for use |
| Kokoro (local, open) | not applicable | pt | free | not generated: Python package `kokoro_onnx` is not installed (model files exist in `~/models/kokoro`) | none |
| Qwen3-TTS (local, open) | not applicable | pt | free | not generated: no server answers on 127.0.0.1:8890 | none |

The 10 lines are in `eval/voices/lines-pt-PT.json`. They are in the style of Dona Amélia at level A2 and include a price with a decimal ("1,30"), a question ("Quer um pastel de nata?") and "pastel de nata". The Portuguese has not been reviewed by a fluent speaker. The `media/` folder is git-ignored, so no audio is committed. Run `bash scripts/make-voice-samples.sh` to render it again.

The `say` rate is in words per minute. The app rate 0.85 is a multiplier on the browser's normal rate, so the files are close to, not identical with, what the browser plays at 0.85.

## Ratings

Every cell is open. A fluent pt-PT speaker fills this in.

| Voice | Naturalness (1 to 5) | pt-PT accent (1 to 5) | Mispronounced words | Rater | Date |
|---|---|---|---|---|---|
| Joana, system voice, pt-PT | not rated | not rated | not rated | not rated | not rated |

### Procedure for the fluent speaker

1. Open the 10 files in `media/voices/say-joana-pt_PT/` in order. Listen to each once, then once more.
2. Score naturalness from 1 (robotic, hard to follow) to 5 (sounds like a person).
3. Score the pt-PT accent from 1 (sounds Brazilian or foreign) to 5 (sounds like a native speaker from Portugal).
4. Write each mispronounced word with its line number. Check the price "1,30" and "pastel de nata" in particular.
5. Write your name and the date in the row. Do not average the two scores into one.

## Hosted candidates

None of these has been generated or priced. Each needs the owner's approval before any call.

| Provider | Status |
|---|---|
| ElevenLabs | price unverified, needs owner approval |
| OpenAI text-to-speech | price unverified, needs owner approval |
| Google Cloud text-to-speech | excluded by owner rule |

## Decision

Provisional default: the browser voice Joana (pt-PT) at rate 0.85, the rate set in the scenario file. This is pending the ratings above. No quality claim is made, because no one has listened and rated it. If the owner finds that Joana does not reach an accepted score, the next step is the paid gate: the owner chooses a hosted candidate after prices are checked.

Owner accept or reject: not yet given.

## Chunking check

Question: does audio start before the full reply has arrived?

Setup: `npm run timing:tts` runs `speakReply` in Node against a copy of the server on port 5190, with the real local model (llama-server, gemma-4-E4B-it-Q8_0), the café scenario and the learner line "Bom dia. Queria um café e um pastel de nata, por favor." The speech engine is a stand-in. It plays nothing and logs "audio start" with the sentence. Real audio start in a browser is measured in task 16. Machine load average at the run: about 5 (`uptime` 15:58, load averages 4.72 5.58 7.22).

Log of run 1:

```
     0 ms  request sent to http://127.0.0.1:5190/api/llm/stream, learner line: "Bom dia. Queria um café e um pastel de nata, por favor."
 10514 ms  first text delta: "Aqui"
 10617 ms  audio start (stand-in) "Aqui está."
 10738 ms  audio end   (stand-in) "Aqui está."
 10738 ms  audio start (stand-in) "Quer mais alguma coisa?"
 10979 ms  audio end   (stand-in) "Quer mais alguma coisa?"
 10979 ms  audio start (stand-in) "Pode pagar quando quiser."
 11220 ms  audio end   (stand-in) "Pode pagar quando quiser."
 11220 ms  reply complete: "Aqui está. Quer mais alguma coisa? Pode pagar quando quiser."

first delta        10513 ms
first sentence     10616 ms
first audio start  10616 ms  (stand-in)
reply complete     10875 ms
audio end          11219 ms  (stand-in)
first sentence was ready 259 ms before the reply completed
```

Run 2 (same setup, load average 5.02): first delta 6809 ms, first sentence 6918 ms, first audio start 6919 ms, reply complete 7052 ms. The first sentence was ready 134 ms before the reply completed.

Result: yes, the first sentence was ready before the reply completed, by 134 to 259 ms in these two runs. The gain is small for two reasons. The A2 reply is only two or three short sentences, and the model streams them within a few hundred milliseconds. Most of the wait (6.8 to 10.5 s) comes before the first text delta. The local model spends that time on hidden reasoning tokens that the stream route does not forward. Chunking does not shorten that wait. The wait is a finding for the owner: it is the main delay a learner would feel, and it is not caused by speech.

Side note: with `maxTokens: 120` the model used the whole budget on reasoning and returned no text, so the stream route answered 502 "Local model reply had no text". The timing script uses 1500. Any caller that sets a small `maxTokens` against this model will hit the same empty reply.
