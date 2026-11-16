// One Messages API request per Release (ADR 0011): the Summary is written while the reader waits.
export type SummaryRequest = { releaseId: string; model: string; system: string; prompt: string };

// What the request billed. Optional because only the real API reports it, and nothing in the
// pipeline decides anything on it: it is there to price a model on measured tokens (#57).
export type SummaryUsage = { inputTokens: number; outputTokens: number };

export type SummaryResult =
  | { type: "succeeded"; text: string; usage?: SummaryUsage }
  // The request's own fault, or an answer that is not a Summary: the Summary is `failed`.
  | { type: "errored"; message: string }
  // Not the Release's fault: the credit ran out, the key was refused, or the API could not be
  // reached after the SDK's own retries. The Summary goes back to waiting and the run stops, rather than spend the queue.
  | { type: "credit_exhausted"; message: string }
  | { type: "unreachable"; message: string };

// The Messages API as the pipeline sees it; tests pass a fake. It never throws for an answer.
export type SummaryWriter = (request: SummaryRequest) => Promise<SummaryResult>;
