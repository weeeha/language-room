import type { SttProvider, SttResult } from "../stt";
import { SttNoSpeechError, SttPermissionError } from "./stt-browser";

export const MAX_RECORDING_MS = 30_000;

/** Free. Records the microphone, sends the audio to the local server, which runs whisper.cpp. */
export function createLocalWhisperStt(): SttProvider {
  let recorder: MediaRecorder | null = null;
  return {
    kind: "stt",
    id: "stt-whisper-local",
    label: "Local Whisper",
    paid: false,
    stop() {
      if (recorder && recorder.state !== "inactive") recorder.stop();
    },
    async listenOnce(opts): Promise<SttResult> {
      if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Recording is not available in this browser");
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        throw new SttPermissionError();
      }
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream);
      recorder = rec;
      const blob = await new Promise<Blob>((resolve, reject) => {
        const timer = setTimeout(() => {
          if (rec.state !== "inactive") rec.stop();
        }, MAX_RECORDING_MS);
        const finish = () => {
          clearTimeout(timer);
          opts.signal?.removeEventListener("abort", onAbort);
          stream.getTracks().forEach((t) => t.stop());
          if (recorder === rec) recorder = null;
        };
        const onAbort = () => {
          rec.onstop = null;
          if (rec.state !== "inactive") rec.stop();
          finish();
          reject(new DOMException("Listening was aborted", "AbortError"));
        };
        if (opts.signal?.aborted) {
          onAbort();
          return;
        }
        opts.signal?.addEventListener("abort", onAbort);
        rec.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        rec.onerror = () => {
          finish();
          reject(new Error("Recording failed"));
        };
        rec.onstop = () => {
          finish();
          resolve(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
        };
        rec.start();
      });
      if (blob.size === 0) throw new SttNoSpeechError();
      const res = await fetch(`/api/stt/local?lang=${encodeURIComponent(opts.lang.slice(0, 2).toLowerCase())}`, {
        method: "POST",
        headers: { "content-type": blob.type || "application/octet-stream" },
        body: blob,
        signal: opts.signal,
      });
      const data = (await res.json().catch(() => ({}))) as SttResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Local Whisper failed with ${res.status}`);
      if (!data.text || !data.text.trim()) throw new SttNoSpeechError();
      return { text: data.text.trim(), words: data.words };
    },
  };
}
