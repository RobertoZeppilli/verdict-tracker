// Whether a request comes from Verdict itself (issue #239, rule in docs/DECISIONI.md): with no login
// and the Developer's own Anthropic key behind it, any page open in the browser could otherwise start
// a Detection or a Summary, by posting to `localhost` (CSRF) or through a domain of its own that
// resolves to `127.0.0.1` (DNS rebinding, which the Host header gives away).
export type RequestFacts = {
  method: string;
  host: string | null;
  origin: string | null;
  referer: string | null;
  port: string;
};

const READ_METHODS = new Set(["GET", "HEAD"]);

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function isTrustedRequest({ method, host, origin, referer, port }: RequestFacts): boolean {
  if (host !== `localhost:${port}` && host !== `127.0.0.1:${port}`) return false;
  if (READ_METHODS.has(method.toUpperCase())) return true;
  const sender = origin ?? (referer === null ? null : originOf(referer));
  return sender === `http://${host}`;
}
