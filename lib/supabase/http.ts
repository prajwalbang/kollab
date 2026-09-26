import "server-only";

export class HttpError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

export function appOrigin() {
  const configured = process.env.APP_ORIGIN;
  if (!configured && process.env.NODE_ENV === "production")
    throw new Error("APP_ORIGIN must be configured.");
  const url = new URL(configured || "http://localhost:3000");
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) || url.username || url.password || url.search || url.hash || url.pathname !== "/")
    throw new Error("Invalid application origin.");
  return url.origin;
}

export function requireSameOrigin(request: Request) {
  // Trust configuration, never Host/X-Forwarded-Host supplied by the requester.
  const fetchSite = request.headers.get("sec-fetch-site");
  if (request.headers.get("origin") !== appOrigin() || (fetchSite && fetchSite !== "same-origin"))
    throw new HttpError("Request origin not allowed.", 403);
}

export async function readJson(request: Request, maxBytes = 16384): Promise<unknown> {
  requireSameOrigin(request);
  const mediaType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json") throw new HttpError("JSON required.", 415);
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxBytes))
    throw new HttpError("Request too large.", 413);
  // Bound streamed bodies too; Content-Length is not trustworthy.
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError("Request body required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) { await reader.cancel(); throw new HttpError("Request too large.", 413); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new HttpError("Invalid JSON."); }
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: {
    "Cache-Control": "private, no-store, max-age=0", "Vary": "Cookie", "Pragma": "no-cache",
    "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
  } });
}

export function publicError(error: unknown, fallback = "Could not complete the request. Please retry.") {
  return json({ error: error instanceof HttpError ? error.message : fallback }, error instanceof HttpError ? error.status : 503);
}
