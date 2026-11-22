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
          thinking: req.thinking,
        }),
        signal: req.signal,
      });
      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Local model request failed with ${res.status}`);
      if (typeof data.text !== "string") throw new Error("Local model reply had no text");
      return { text: data.text };
    },
    async completeStream(req: LlmRequest, onDelta: (text: string) => void) {
      const doFetch = opts.fetch ?? fetch;
      const res = await doFetch(`${base}/api/llm/stream`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "local",
          messages: req.messages,
          temperature: req.temperature,
          maxTokens: req.maxTokens,
          json: req.json,
          thinking: req.thinking,
        }),
        signal: req.signal,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Local model request failed with ${res.status}`);
      }
      if (!res.body) throw new Error("Local model stream had no body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const piece = decoder.decode(value, { stream: true });
        if (piece.length > 0) {
          text += piece;
          onDelta(piece);
        }
      }
      const tail = decoder.decode();
      if (tail.length > 0) {
        text += tail;
        onDelta(tail);
      }
      return { text };
    },
  };
}
