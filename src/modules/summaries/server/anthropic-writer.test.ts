import { APIError } from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import type { SummaryRequest } from "../domain/summary-writer";
import { anthropicSummaryWriter, type MessageParams, type WrittenMessage } from "./anthropic-writer";

const request: SummaryRequest = { releaseId: "rel-1", model: "claude-opus-5", system: "s", prompt: "p" };

const answered = { type: "text", text: '{"title":"ok"}' };

// A client that answers with the message it is given, so the adapter is the only thing under test.
function client(answer: WrittenMessage | Error) {
  const sent: MessageParams[] = [];
  return {
    sent,
    async create(body: MessageParams) {
      sent.push(body);
      if (answer instanceof Error) throw answer;
      return answer;
    },
  };
}

function write(answer: WrittenMessage | Error) {
  return anthropicSummaryWriter(client(answer))(request);
}

function apiError(status: number, type: string, message: string) {
  return new APIError(status, { type: "error", error: { type, message } }, message, undefined);
}

function answeredWith(stop_reason: string | null, content: { type: string }[] = [answered]): WrittenMessage {
  return { stop_reason, content };
}

describe("anthropicSummaryWriter", () => {
  it("sends the Release's model, system and prompt", async () => {
    const messages = client(answeredWith("end_turn"));
    await anthropicSummaryWriter(messages)(request);

    expect(messages.sent).toEqual([
      expect.objectContaining({ model: "claude-opus-5", system: "s", messages: [{ role: "user", content: "p" }] }),
    ]);
  });

  // Haiku 4.5 and the models before it wanted `thinking: { budget_tokens }` and refused `effort`;
  // every model the app can use today is the other way round (#57), so the shape is pinned here.
  it("configures the thinking with the effort, and never with a token budget", async () => {
    const messages = client(answeredWith("end_turn"));
    await anthropicSummaryWriter(messages)({ ...request, model: "claude-haiku-5-5" });

    const [sent] = messages.sent;
    expect(sent?.output_config).toMatchObject({ effort: "medium" });
    expect(sent?.output_config).toHaveProperty("format");
    expect(sent).not.toHaveProperty("thinking");
  });

  it("returns the text of the answer", async () => {
    expect(await write(answeredWith("end_turn"))).toEqual({ type: "succeeded", text: '{"title":"ok"}' });
  });

  it("carries the tokens the request billed, when it reports them", async () => {
    const message = { ...answeredWith("end_turn"), usage: { input_tokens: 12, output_tokens: 3 } };
    expect(await write(message)).toMatchObject({ usage: { inputTokens: 12, outputTokens: 3 } });
  });

  it("reads a billing error as an exhausted credit", async () => {
    expect(await write(apiError(402, "billing_error", "low"))).toMatchObject({ type: "credit_exhausted" });
    expect(await write(apiError(400, "invalid_request_error", "Your credit balance is too low"))).toMatchObject({
      type: "credit_exhausted",
    });
  });

  it("reads another refusal of the request as its own failure", async () => {
    expect(await write(apiError(400, "invalid_request_error", "bad"))).toMatchObject({ type: "errored" });
  });

  it("reads a wrong or forbidden key as a wait, so the queue is not failed for it", async () => {
    expect(await write(apiError(401, "authentication_error", "invalid x-api-key"))).toMatchObject({ type: "unreachable" });
    expect(await write(apiError(403, "permission_error", "forbidden"))).toMatchObject({ type: "unreachable" });
  });

  it("reads a rate limit, an overload or a lost connection as a wait", async () => {
    expect(await write(apiError(429, "rate_limit_error", "slow down"))).toMatchObject({ type: "unreachable" });
    expect(await write(apiError(529, "overloaded_error", "busy"))).toMatchObject({ type: "unreachable" });
    expect(await write(new Error("fetch failed"))).toMatchObject({ type: "unreachable" });
  });

  it("refuses an answer cut off by the token limit", async () => {
    expect(await write(answeredWith("max_tokens"))).toMatchObject({ type: "errored" });
  });

  it("refuses an answer the model declined to give", async () => {
    expect(await write(answeredWith("refusal"))).toMatchObject({ type: "errored" });
  });

  it("refuses an answer with no text at all", async () => {
    expect(await write(answeredWith("end_turn", [{ type: "thinking" }]))).toMatchObject({ type: "errored" });
  });
});
