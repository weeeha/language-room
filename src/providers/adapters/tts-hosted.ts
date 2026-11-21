import type { TtsProvider } from "../tts";

/** Paid stub. The server answers 501 in this build. */
export function createHostedTts(): TtsProvider {
  return {
    kind: "tts",
    id: "tts-hosted",
    label: "Hosted text to speech (paid)",
    paid: true,
    async speak(text, opts) {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, lang: opts.lang, voice: opts.voice, rate: opts.rate }),
        signal: opts.signal,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Hosted TTS failed with ${res.status}`);
      }
    },
  };
}
