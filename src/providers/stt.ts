export interface SttWord {
  text: string;
  confidence: number; // 0..1
}

export interface SttResult {
  text: string;
  confidence?: number;
  words?: SttWord[];
}

export interface SttProvider {
  kind: "stt";
  id: string;
  label: string;
  paid: boolean;
  listenOnce(opts: { lang: string; signal?: AbortSignal }): Promise<SttResult>;
  /** Ends the current listen early. The pending listenOnce then resolves with what was heard. */
  stop?(): void;
}
