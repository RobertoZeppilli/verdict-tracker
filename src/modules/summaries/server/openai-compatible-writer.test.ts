import { describe, expect, it } from "vitest";
import type { SummaryRequest } from "../domain/summary-writer";
import { MAX_OUTPUT_TOKENS, type OpenAICompatibleOptions, openAICompatibleSummaryWriter } from "./openai-compatible-writer";

const request: SummaryRequest = { releaseId: "rel-1", model: "qwen3:8b", system: "s", prompt: "p" };

type Sent = { url: string; init: RequestInit };

// A server that answers with the given status and body, so the adapter is the only thing under test.
function server(status: number, body: unknown) {
  const sent: Sent[] = [];
  const fake: typeof fetch = async (url, init) => {
    sent.push({ url: String(url), init: init ?? {} });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  };
  return { sent, fetch: fake };
}

function completion(content: string | null, finish_reason = "stop", extra: object = {}) {
  return { choices: [{ finish_reason, message: { role: "assistant", content, ...extra } }] };
}

function write(status: number, body: unknown, options: Partial<OpenAICompatibleOptions> = {}) {
  const { fetch } = server(status, body);
  return openAICompatibleSummaryWriter({ baseUrl: "http://localhost:11434/v1", fetch, ...options })(request);
}

describe("openAICompatibleSummaryWriter", () => {
  it("sends the model, the system and the prompt to the chat completions, asking for the Summary's schema", async () => {
    const fake = server(200, completion('{"title":"ok"}'));
    await openAICompatibleSummaryWriter({ baseUrl: "http://localhost:11434/v1/", fetch: fake.fetch })(request);

    const [sent] = fake.sent;
    expect(sent?.url).toBe("http://localhost:11434/v1/chat/completions");
    expect(new Headers(sent?.init.headers).has("authorization")).toBe(false);
    const body: unknown = JSON.parse(String(sent?.init.body));
    expect(body).toMatchObject({
      model: "qwen3:8b",
      messages: [
        { role: "system", content: "s" },
        { role: "user", content: "p" },
      ],
      response_format: { type: "json_schema", json_schema: { schema: { type: "object" } } },
    });
  });

  it("sends the key as a bearer token when there is one", async () => {
    const fake = server(200, completion("{}"));
    await openAICompatibleSummaryWriter({ baseUrl: "https://example.test/v1", apiKey: "key-12345678", fetch: fake.fetch })(request);

    expect(new Headers(fake.sent[0]?.init.headers).get("authorization")).toBe("Bearer key-12345678");
  });

  it("returns the text of the answer and the tokens it reports", async () => {
    const body = { ...completion('{"title":"ok"}'), usage: { prompt_tokens: 12, completion_tokens: 3 } };
    expect(await write(200, body)).toEqual({
      type: "succeeded",
      text: '{"title":"ok"}',
      usage: { inputTokens: 12, outputTokens: 3 },
    });
  });

  it("refuses a body that is not JSON, or JSON that is not a chat completion", async () => {
    expect(await write(200, "<html>")).toMatchObject({ type: "errored" });
    expect(await write(200, { choices: [] })).toMatchObject({ type: "errored" });
  });

  it("refuses an answer the model declined to give", async () => {
    expect(await write(200, completion(null, "stop", { refusal: "no" }))).toMatchObject({
      type: "errored",
      message: "the model refused to answer",
    });
  });

  it("refuses an answer cut off by the token limit", async () => {
    expect(await write(200, completion('{"title":', "length"))).toMatchObject({ type: "errored" });
  });

  it("refuses an answer with no text at all", async () => {
    expect(await write(200, completion(""))).toMatchObject({ type: "errored" });
  });

  it("refuses notes longer than the declared context instead of summarizing half of them", async () => {
    const fake = server(200, completion("{}"));
    const long = { ...request, prompt: "x".repeat(30_000) };
    const result = await openAICompatibleSummaryWriter({ baseUrl: "http://x/v1", contextTokens: 8_192, fetch: fake.fetch })(long);

    expect(result).toMatchObject({ type: "errored", message: expect.stringContaining("OLLAMA_CONTEXT_LENGTH") });
    expect(fake.sent).toHaveLength(0);
  });

  it("sends notes that fit the declared context", async () => {
    const fits = { ...request, prompt: "x".repeat(3_000) };
    const fake = server(200, completion("{}"));
    await openAICompatibleSummaryWriter({ baseUrl: "http://x/v1", contextTokens: MAX_OUTPUT_TOKENS + 1_001, fetch: fake.fetch })(fits);

    expect(fake.sent).toHaveLength(1);
  });

  it("reads an exhausted quota as an exhausted credit", async () => {
    expect(await write(402, "payment required")).toMatchObject({ type: "credit_exhausted" });
    expect(await write(429, { error: { code: "insufficient_quota" } })).toMatchObject({ type: "credit_exhausted" });
  });

  it("reads another refusal of the request as its own failure", async () => {
    expect(await write(400, "bad request")).toMatchObject({ type: "errored" });
  });

  it("reads a wrong key, a missing model, a rate limit, a server error or a lost connection as a wait", async () => {
    for (const status of [401, 403, 404, 429, 500, 503]) {
      expect(await write(status, "no")).toMatchObject({ type: "unreachable" });
    }
    const down: typeof fetch = async () => {
      throw new Error("fetch failed");
    };
    expect(await write(200, "", { fetch: down })).toMatchObject({ type: "unreachable" });
  });

  // Issue #240: the message of a failure is stored and logged, and a log gets pasted into issues.
  it("keeps only the last four characters of the key in a failure", async () => {
    const apiKey = "sk-SECRETsecretSECRET-AB12";
    const result = await write(401, `invalid key ${apiKey}`, { apiKey });

    const message = "message" in result ? result.message : "";
    expect(message).not.toContain("SECRET");
    expect(message).toContain("…AB12");
  });
});
