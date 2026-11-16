import Anthropic from "@anthropic-ai/sdk";
import type { SummaryWriter } from "../domain/summary-writer";
import { anthropicSummaryWriter } from "./anthropic-writer";

// The key comes from the caller, not from `@/env/server`: importing the module must not require
// an environment. Without a key there is no writer, and the app says so instead of failing.
export function createSummaryWriter(apiKey: string | undefined): SummaryWriter | null {
  if (apiKey === undefined) return null;
  const client = new Anthropic({ apiKey });
  return anthropicSummaryWriter({ create: (body) => client.messages.create(body) });
}
