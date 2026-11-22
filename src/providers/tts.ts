export interface TtsProvider {
  kind: "tts";
  id: string;
  label: string;
  paid: boolean;
  /** Resolves when the audio ends. */
  speak(
    text: string,
    opts: { lang: string; voice?: string; rate?: number; signal?: AbortSignal },
  ): Promise<void>;
}
