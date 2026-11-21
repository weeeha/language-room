import type { LlmProvider } from "./llm";
import { guardProvider } from "./paid-guard";
import type { SttProvider } from "./stt";
import type { TtsProvider } from "./tts";
import { createClaudeLlm } from "./adapters/llm-claude";
import { createLocalLlm } from "./adapters/llm-local";
import { createHostedStt } from "./adapters/stt-hosted";
import { createBrowserStt } from "./adapters/stt-browser";
import { createHostedTts } from "./adapters/tts-hosted";
import { createBrowserTts } from "./adapters/tts-browser";

export interface ProviderConfig {
  paidProviders?: string;
}

export interface Providers {
  stt: SttProvider[];
  llm: LlmProvider[];
  tts: TtsProvider[];
}

/** Every provider is wrapped by the guard. Free ones come first. */
export function getProviders(config: ProviderConfig): Providers {
  const flag = () => config.paidProviders;
  return {
    stt: [createBrowserStt(), createHostedStt()].map((p) => guardProvider(p, flag)),
    llm: [createLocalLlm(), createClaudeLlm()].map((p) => guardProvider(p, flag)),
    tts: [createBrowserTts(), createHostedTts()].map((p) => guardProvider(p, flag)),
  };
}
