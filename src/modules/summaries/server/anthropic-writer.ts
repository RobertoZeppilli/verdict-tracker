import type Anthropic from "@anthropic-ai/sdk";
import { APIError } from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { SummaryContentSchema } from "../domain/summary-content";
import type { SummaryRequest, SummaryResult, SummaryWriter } from "../domain/summary-writer";

// A Summary is a small JSON object, but the model thinks before writing it and thinking counts here.
const MAX_TOKENS = 8_000;
// Reading release notes and quoting them back is extraction, not research: `high` buys nothing.
const EFFORT = "medium";
// The answer is decoded against the Summary's own schema, so it cannot come back as prose or inside
// a markdown fence. Lengths and counts survive only as hints: `parseSummaryOutput` still validates.
const FORMAT = zodOutputFormat(SummaryContentSchema);

export type MessageParams = Anthropic.Messages.MessageCreateParamsNonStreaming;

// Only what the adapter reads of a message: the SDK's own type is assignable to it, which
// `createSummaryWriter` proves, so the tests can answer with plain objects.
export type WrittenMessage = {
  content: readonly { type: string }[];
  stop_reason: string | null;
  usage?: { input_tokens: number; output_tokens: number };
};

export type MessagesClient = { create(body: MessageParams): Promise<WrittenMessage> };

// The real Messages API behind the `SummaryWriter` port (ADR 0011), same contract as the fake.
export function anthropicSummaryWriter(messages: MessagesClient): SummaryWriter {
  return async (request) => {
    let message: WrittenMessage;
    try {
      message = await messages.create(toParams(request));
    } catch (error) {
      return failure(error);
    }
    return toSummaryResult(message);
  };
}

function toParams(request: SummaryRequest): MessageParams {
  return {
    model: request.model,
    max_tokens: MAX_TOKENS,
    output_config: { effort: EFFORT, format: FORMAT },
    system: request.system,
    messages: [{ role: "user", content: request.prompt }],
  };
}

// Anything shaped like an Anthropic key, reduced to a hint (issue #240): the message of a failure is
// stored and logged, and a log gets pasted into issues. The last four characters say **which** key,
// as the Slack webhook's hint does.
const ANTHROPIC_KEY = /sk-ant-[\w-]+/g;

function withoutKey(text: string): string {
  return text.replace(ANTHROPIC_KEY, (key) => `sk-ant-…${key.slice(-4)}`);
}

function failure(error: unknown): SummaryResult {
  const message = withoutKey(error instanceof Error ? error.message : String(error));
  // 402 is the credit balance; the API also refuses with a 400 whose message names it.
  if (error instanceof APIError && (error.status === 402 || /credit balance/i.test(error.message))) {
    return { type: "credit_exhausted", message };
  }
  // Any other 4xx is this request's fault, except a rate limit and a key that is wrong or not allowed:
  // those would fail every Summary in the queue for something none of them did. The SDK already
  // retried the rest.
  const status = error instanceof APIError ? error.status : undefined;
  const notTheRequest = [401, 403, 429];
  if (status !== undefined && status >= 400 && status < 500 && !notTheRequest.includes(status)) {
    return { type: "errored", message };
  }
  return { type: "unreachable", message };
}

function toSummaryResult(message: WrittenMessage): SummaryResult {
  // A refusal or a cut-off answer is not a Summary: the text would be partial JSON at best.
  if (message.stop_reason === "refusal") return { type: "errored", message: "the model refused to answer" };
  if (message.stop_reason === "max_tokens") {
    return { type: "errored", message: `the answer hit the ${MAX_TOKENS} token limit` };
  }
  const text = message.content.map(blockText).join("");
  if (text.trim() === "") return { type: "errored", message: "the model answered without any text" };
  const usage = message.usage;
  if (usage === undefined) return { type: "succeeded", text };
  return { type: "succeeded", text, usage: { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens } };
}

function blockText(block: { type: string }): string {
  return block.type === "text" && "text" in block && typeof block.text === "string" ? block.text : "";
}
