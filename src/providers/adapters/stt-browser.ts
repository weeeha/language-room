import type { SttProvider, SttResult } from "../stt";

export class SttNoSpeechError extends Error {
  constructor() {
    super("No speech was heard");
    this.name = "SttNoSpeechError";
  }
}

export class SttPermissionError extends Error {
  constructor() {
    super("Microphone permission was denied");
    this.name = "SttPermissionError";
  }
}

interface RecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface RecognitionEventLike {
  results: ArrayLike<ArrayLike<RecognitionAlternative>>;
}
interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => RecognitionLike;

function findCtor(): RecognitionCtor | undefined {
  const g = globalThis as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return g.SpeechRecognition ?? g.webkitSpeechRecognition;
}

export function createBrowserStt(): SttProvider {
  let active: RecognitionLike | null = null;
  return {
    stop() {
      active?.stop();
    },
    kind: "stt",
    id: "stt-browser",
    label: "Browser speech recognition",
    paid: false,
    listenOnce(opts) {
      return new Promise<SttResult>((resolve, reject) => {
        const Ctor = findCtor();
        if (!Ctor) {
          reject(new Error("Speech recognition is not available in this browser"));
          return;
        }
        const rec = new Ctor();
        active = rec;
        rec.lang = opts.lang;
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        rec.continuous = false;
        let settled = false;
        const done = (fn: () => void) => {
          if (settled) return;
          settled = true;
          if (active === rec) active = null;
          opts.signal?.removeEventListener("abort", onAbort);
          fn();
        };
        const onAbort = () => {
          rec.abort();
          done(() => reject(new DOMException("Listening was aborted", "AbortError")));
        };
        if (opts.signal?.aborted) {
          onAbort();
          return;
        }
        opts.signal?.addEventListener("abort", onAbort);
        rec.onresult = (e) => {
          const alt = e.results[0]?.[0];
          if (!alt) return;
          done(() => resolve({ text: alt.transcript.trim(), confidence: alt.confidence }));
        };
        rec.onerror = (e) => {
          done(() => {
            if (e.error === "no-speech") reject(new SttNoSpeechError());
            else if (e.error === "not-allowed" || e.error === "service-not-allowed") {
              reject(new SttPermissionError());
            } else reject(new Error(`Speech recognition failed: ${e.error}`));
          });
        };
        rec.onend = () => {
          done(() => reject(new SttNoSpeechError()));
        };
        rec.start();
      });
    },
  };
}
