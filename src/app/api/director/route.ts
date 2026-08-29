import {
  DirectorRequestSchema,
  generateDirectorTurn,
  getDirectorConfig,
} from "@/lib/director";

export const runtime = "nodejs";
export const maxDuration = 30;

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 15;
const requestBuckets = new Map<string, number[]>();

function clientIdentifier(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function isRateLimited(request: Request) {
  const now = Date.now();
  const identifier = clientIdentifier(request);
  const recent = (requestBuckets.get(identifier) ?? []).filter(
    (timestamp) => now - timestamp < WINDOW_MS,
  );
  recent.push(now);
  requestBuckets.set(identifier, recent);
  return recent.length > MAX_REQUESTS_PER_WINDOW;
}

export async function GET() {
  return Response.json(getDirectorConfig());
}

export async function POST(request: Request) {
  if (!getDirectorConfig().configured) {
    return Response.json(
      {
        code: "AI_NOT_CONFIGURED",
        message: "Live AI is not configured; use the deterministic fallback.",
      },
      { status: 503 },
    );
  }

  if (isRateLimited(request)) {
    return Response.json(
      { code: "RATE_LIMITED", message: "Please wait before sending another turn." },
      { status: 429 },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 30_000) {
    return Response.json(
      { code: "PAYLOAD_TOO_LARGE", message: "Request payload is too large." },
      { status: 413 },
    );
  }

  let rawPayload: unknown;
  try {
    rawPayload = await request.json();
  } catch {
    return Response.json(
      { code: "INVALID_REQUEST", message: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const payload = DirectorRequestSchema.safeParse(rawPayload);
  if (!payload.success) {
    return Response.json(
      { code: "INVALID_REQUEST", message: "Invalid group interview state." },
      { status: 400 },
    );
  }

  try {
    const result = await generateDirectorTurn(payload.data);
    return Response.json({ mode: "live", ...result });
  } catch (error) {
    console.error(
      "[group-lab-director] request failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return Response.json(
      {
        code: "AI_UNAVAILABLE",
        message: "Live AI is temporarily unavailable; use the deterministic fallback.",
      },
      { status: 502 },
    );
  }
}
