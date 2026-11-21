import type { TtsProvider } from "../tts";

function pickVoice(voices: SpeechSynthesisVoice[], lang: string, name?: string) {
  if (name) {
    const named = voices.find((v) => v.name === name);
    if (named) return named;
  }
  const want = lang.toLowerCase();
  const prefix = want.split("-")[0];
  return (
    voices.find((v) => v.lang.toLowerCase().replace("_", "-") === want) ??
    voices.find((v) => v.lang.toLowerCase().replace("_", "-").split("-")[0] === prefix)
  );
}

export function createBrowserTts(): TtsProvider {
  return {
    kind: "tts",
    id: "tts-browser",
    label: "Browser speech synthesis",
    paid: false,
    speak(text, opts) {
      return new Promise<void>((resolve, reject) => {
        const synth = (globalThis as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
        if (!synth) {
          reject(new Error("Speech synthesis is not available in this browser"));
          return;
        }
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = opts.lang;
        const voice = pickVoice(synth.getVoices(), opts.lang, opts.voice);
        if (voice) utter.voice = voice;
        if (opts.rate !== undefined) utter.rate = opts.rate;
        const onAbort = () => {
          synth.cancel();
          reject(new DOMException("Speech was aborted", "AbortError"));
        };
        if (opts.signal?.aborted) {
          onAbort();
          return;
        }
        opts.signal?.addEventListener("abort", onAbort, { once: true });
        utter.onend = () => {
          opts.signal?.removeEventListener("abort", onAbort);
          resolve();
        };
        utter.onerror = (e) => {
          opts.signal?.removeEventListener("abort", onAbort);
          reject(new Error(`Speech synthesis failed: ${e.error}`));
        };
        synth.speak(utter);
      });
    },
  };
}
