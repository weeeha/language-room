import type { LlmProvider, LlmRequest } from "../llm";

export interface LocalLlmOptions {
  fetch?: typeof fetch;
  baseUrl?: string;
}

export function createLocalLlm(opts: LocalLlmOptions = {}): LlmProvider {
  const base = opts.baseUrl ?? "";
  return {
    kind: "llm",
    id: "llm-local",
    label: "Local model",
    paid: false,
    async complete(req: LlmRequest) {
      const doFetch = opts.fetch ?? fetch;
      const res = await doFetch(`${base}/api/llm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "local",
          messages: req.messages,
          temperature: req.temperature,
          maxTokens: req.maxTokens,
          json: req.json,
        }),
        signal: req.signal,
      });
      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Local model request failed with ${res.status}`);
      if (typeof data.text !== "string") throw new Error("Local model reply had no text");
      return { text: data.text };
    },
  };
}
