import type { DirectorTurn, GroupState } from "./types";

export async function requestDirectorTurn(
  state: GroupState,
  userText: string,
  phase: "discussion" | "final_statement",
  signal: AbortSignal,
): Promise<DirectorTurn> {
  const response = await fetch("/api/director", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scenarioId: state.scenarioId ?? "campus-career-retention",
      difficulty: state.difficulty ?? "standard",
      phase,
      userText,
      state: {
        turn: state.turn,
        timeLeft: state.timeLeft,
        consensus: state.consensus,
        criteria: state.criteria,
        finalists: state.finalists,
        conflict: state.conflict,
        messages: state.messages.slice(-16).map((message) => ({
          speaker: message.speaker,
          content: message.content,
        })),
      },
    }),
    signal,
  });
  const data = (await response.json()) as DirectorTurn & { code?: string };
  if (!response.ok || !data.replies?.length || !data.assessment) {
    throw new Error(data.code || "AI_UNAVAILABLE");
  }
  return data;
}
