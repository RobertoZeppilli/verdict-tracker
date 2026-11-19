import type { SummaryWriter } from "../domain/summary-writer";
import { openAICompatibleSummaryWriter } from "./openai-compatible-writer";

export type ModelConfig = { url: string; model?: string; key?: string; contextTokens?: number };

// The configuration comes from the caller, not from `@/env/server`: importing the module must not
// require an environment. Without a model there is no writer, and the app says so instead of failing.
export function createSummaryWriter(config: ModelConfig): { model: string; write: SummaryWriter } | null {
  if (config.model === undefined) return null;
  const write = openAICompatibleSummaryWriter({ baseUrl: config.url, apiKey: config.key, contextTokens: config.contextTokens });
  return { model: config.model, write };
}
