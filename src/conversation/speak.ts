import type { LlmProvider, LlmRequest } from "../providers/llm";
import type { TtsProvider } from "../providers/tts";
import { createSentenceChunker } from "./chunker";

export interface SpeakTimings {
  requestAt: number;
  firstDeltaAt: number | null;
  firstSentenceAt: number | null;
  firstAudioStartAt: number | null;
  replyCompleteAt: number;
  audioEndAt: number | null;
}

export interface SpeakOptions {
  lang: string;
  voice?: string;
  rate?: number;
  signal?: AbortSignal;
  onText?: (fullSoFar: string) => void;
  onTtsError?: (e: unknown) => void;
}

function abortError(): DOMException {
  return new DOMException("Reply was aborted", "AbortError");
}

/**
 * Streams the character reply and speaks it one sentence at a time, starting with
 * the first complete sentence. If speech fails, the text still comes back whole.
 */
export async function speakReply(
  deps: { llm: LlmProvider; tts: TtsProvider; now?: () => number },
  req: LlmRequest,
  opts: SpeakOptions,
): Promise<{ text: string; timings: SpeakTimings }> {
  const now = deps.now ?? (() => performance.now());
  const timings: SpeakTimings = {
    requestAt: now(),
    firstDeltaAt: null,
    firstSentenceAt: null,
    firstAudioStartAt: null,
    replyCompleteAt: 0,
    audioEndAt: null,
  };

  const speechCtl = new AbortController();
  const onAbort = () => speechCtl.abort();
  if (opts.signal?.aborted) throw abortError();
  opts.signal?.addEventListener("abort", onAbort, { once: true });

  let speechFailed = false;
  let queue: Promise<void> = Promise.resolve();

  function enqueue(sentence: string): void {
    if (timings.firstSentenceAt === null) timings.firstSentenceAt = now();
    queue = queue.then(async () => {
      if (speechFailed || speechCtl.signal.aborted) return;
      if (timings.firstAudioStartAt === null) timings.firstAudioStartAt = now();
      try {
        await deps.tts.speak(sentence, {
          lang: opts.lang,
          voice: opts.voice,
          rate: opts.rate,
          signal: speechCtl.signal,
        });
        timings.audioEndAt = now();
      } catch (e) {
        if (speechCtl.signal.aborted) return;
        speechFailed = true;
        opts.onTtsError?.(e);
      }
    });
  }

  const chunker = createSentenceChunker(enqueue);
  let soFar = "";
  const onDelta = (d: string) => {
    if (d.length === 0) return;
    if (timings.firstDeltaAt === null) timings.firstDeltaAt = now();
    soFar += d;
    opts.onText?.(soFar);
    chunker.push(d);
  };

  try {
    let text: string;
    if (deps.llm.completeStream) {
      text = (await deps.llm.completeStream({ ...req, signal: req.signal ?? speechCtl.signal }, onDelta)).text;
    } else {
      text = (await deps.llm.complete({ ...req, signal: req.signal ?? speechCtl.signal })).text;
      opts.onText?.(text);
      chunker.push(text);
    }
    if (opts.signal?.aborted) throw abortError();
    timings.replyCompleteAt = now();
    chunker.flush();
    await queue;
    if (opts.signal?.aborted) throw abortError();
    return { text, timings };
  } catch (e) {
    speechCtl.abort();
    await queue;
    if (opts.signal?.aborted) throw abortError();
    throw e;
  } finally {
    opts.signal?.removeEventListener("abort", onAbort);
  }
}
