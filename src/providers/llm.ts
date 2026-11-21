export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmRequest {
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  signal?: AbortSignal;
}

export interface LlmProvider {
  kind: "llm";
  id: string;
  label: string;
  paid: boolean;
  complete(req: LlmRequest): Promise<{ text: string }>;
}
