import {
  ScenarioGeneratorRequestSchema,
  generateCustomScenario,
  getDirectorConfig,
} from "@/lib/director";

export const runtime = "nodejs";
export const maxDuration = 45;

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 5;
const requestBuckets = new Map<string, number[]>();

function isRateLimited(request: Request) {
  const now = Date.now();
  const identifier =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const recent = (requestBuckets.get(identifier) ?? []).filter(
    (timestamp) => now - timestamp < WINDOW_MS,
  );
  recent.push(now);
  requestBuckets.set(identifier, recent);
  return recent.length > MAX_REQUESTS_PER_WINDOW;
}

export async function POST(request: Request) {
  if (!getDirectorConfig().configured) {
    return Response.json(
      { code: "AI_NOT_CONFIGURED", message: "AI generator is not configured." },
      { status: 503 },
    );
  }
  if (isRateLimited(request)) {
    return Response.json(
      { code: "RATE_LIMITED", message: "Please wait before generating again." },
      { status: 429 },
    );
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 10_000) {
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
  const payload = ScenarioGeneratorRequestSchema.safeParse(rawPayload);
  if (!payload.success) {
    return Response.json(
      { code: "INVALID_REQUEST", message: "Invalid scenario generator input." },
      { status: 400 },
    );
  }

  try {
    const scenario = await generateCustomScenario(payload.data);
    return Response.json({ scenario });
  } catch (error) {
    console.error(
      "[group-lab-scenario-generator] request failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return Response.json(
      { code: "AI_UNAVAILABLE", message: "Scenario generation is unavailable." },
      { status: 502 },
    );
  }
}
