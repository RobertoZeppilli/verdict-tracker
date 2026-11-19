import { z } from "zod";
import { SummaryContentSchema } from "../domain/summary-content";
import type { SummaryRequest, SummaryResult, SummaryWriter } from "../domain/summary-writer";

// Issue #280: one writer for every model that speaks the chat completions of OpenAI: Ollama on
// `http://localhost:11434/v1` and the remote providers alike. Same contract as the Anthropic one.

// The cap on the answer, and what a declared context keeps free for it.
export const MAX_OUTPUT_TOKENS = 8_000;
// A token is rarely shorter than three characters of release notes, so this over-counts: a prompt
// it lets through fits, and one it stops would at worst have fitted just.
const CHARACTERS_PER_TOKEN = 3;

// Ollama honours it; a provider that ignores it still gets the JSON the system prompt asks for,
// and `parseSummaryOutput` validates either way.
const RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: { name: "summary", schema: z.toJSONSchema(SummaryContentSchema), strict: true },
};

export type OpenAICompatibleOptions = {
  baseUrl: string;
  apiKey?: string;
  // The context the model runs with. Ollama's compatible API cannot raise it per request and cuts a
  // longer prompt silently, so a Summary of half the notes would look complete.
  contextTokens?: number;
  fetch?: typeof fetch;
};

const CompletionSchema = z.object({
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullish(),
        message: z.object({ content: z.string().nullish(), refusal: z.string().nullish() }),
      }),
    )
    .min(1),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }).nullish(),
});

export function openAICompatibleSummaryWriter(options: OpenAICompatibleOptions): SummaryWriter {
  const send = options.fetch ?? fetch;
  const url = `${options.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const hide = (text: string) => withoutKey(text, options.apiKey);

  return async (request) => {
    const tooLong = overContext(request, options.contextTokens);
    if (tooLong !== null) return { type: "errored", message: tooLong };

    let response: Response;
    try {
      response = await send(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(options.apiKey === undefined ? {} : { authorization: `Bearer ${options.apiKey}` }),
        },
        body: JSON.stringify(toBody(request)),
      });
    } catch (error) {
      return { type: "unreachable", message: hide(error instanceof Error ? error.message : String(error)) };
    }
    const body = await response.text().catch(() => "");
    if (!response.ok) return failure(response.status, hide(`${response.status} ${body}`.trim()));
    return toSummaryResult(body);
  };
}

function toBody(request: SummaryRequest) {
  return {
    model: request.model,
    max_tokens: MAX_OUTPUT_TOKENS,
    response_format: RESPONSE_FORMAT,
    messages: [
      { role: "system", content: request.system },
      { role: "user", content: request.prompt },
    ],
  };
}

function overContext(request: SummaryRequest, contextTokens: number | undefined): string | null {
  if (contextTokens === undefined) return null;
  const estimate = Math.ceil((request.system.length + request.prompt.length) / CHARACTERS_PER_TOKEN);
  if (estimate + MAX_OUTPUT_TOKENS <= contextTokens) return null;
  return `the notes need about ${estimate + MAX_OUTPUT_TOKENS} tokens of context and the model has ${contextTokens}: raise the context (OLLAMA_CONTEXT_LENGTH for Ollama) and try again`;
}

// The status says whose fault it is. A missing model, a wrong key, a rate limit or a server that is
// down would fail every Summary in the queue for something none of them did: the run waits instead.
function failure(status: number, message: string): SummaryResult {
  if (status === 402 || /credit balance|insufficient_quota/i.test(message)) return { type: "credit_exhausted", message };
  const notTheRequest = [401, 403, 404, 408, 429];
  if (status >= 400 && status < 500 && !notTheRequest.includes(status)) return { type: "errored", message };
  return { type: "unreachable", message };
}

function toSummaryResult(body: string): SummaryResult {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return { type: "errored", message: "the server answered with something that is not JSON" };
  }
  const parsed = CompletionSchema.safeParse(json);
  if (!parsed.success) return { type: "errored", message: "the server answered without a chat completion" };
  const [choice] = parsed.data.choices;
  if (choice === undefined) return { type: "errored", message: "the server answered without a choice" };
  if (choice.message.refusal) return { type: "errored", message: "the model refused to answer" };
  if (choice.finish_reason === "length") {
    return { type: "errored", message: `the answer hit the ${MAX_OUTPUT_TOKENS} token limit` };
  }
  const text = choice.message.content ?? "";
  if (text.trim() === "") return { type: "errored", message: "the model answered without any text" };
  const usage = parsed.data.usage;
  if (!usage) return { type: "succeeded", text };
  return { type: "succeeded", text, usage: { inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens } };
}

// Issue #240 again: a failure's message is stored and logged, and a log gets pasted into issues.
function withoutKey(text: string, key: string | undefined): string {
  if (key === undefined || key.length < 8) return text;
  return text.replaceAll(key, `…${key.slice(-4)}`);
}
