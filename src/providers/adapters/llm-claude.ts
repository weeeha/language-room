import type { LlmProvider, LlmRequest } from "../llm";

/** Paid. Only handed out wrapped in guardProvider. */
export function createClaudeLlm(): LlmProvider {
  return {
    kind: "llm",
    id: "llm-claude",
    label: "Claude (paid)",
    paid: true,
    async complete(req: LlmRequest) {
      const res = await fetch("/api/llm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "claude",
          messages: req.messages,
          temperature: req.temperature,
          maxTokens: req.maxTokens,
          json: req.json,
        }),
        signal: req.signal,
      });
      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Claude request failed with ${res.status}`);
      if (typeof data.text !== "string") throw new Error("Claude reply had no text");
      return { text: data.text };
    },
  };
}
