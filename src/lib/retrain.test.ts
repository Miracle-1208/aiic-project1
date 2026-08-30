import { describe, expect, it } from "vitest";

import {
  bestRetrainAttempt,
  createRetrainAttempt,
  recommendedRetrainTurn,
  retrainAttemptsForTurn,
} from "./retrain";
import type { TurnAssessment } from "./types";

function assessment(
  quality: TurnAssessment["quality"],
  consensusDelta: number,
  progress: number,
): TurnAssessment {
  return {
    id: `assessment-${quality}`,
    turn: 2,
    source: "ai",
    intent: "integrate",
    quality,
    evidence: "结合两边意见",
    impactTitle: quality === "strong" ? "形成整合路径" : "尝试整合观点",
    impactDetail: "帮助团队继续比较方案。",
    suggestion: "补充先后顺序和验证节点。",
    criteriaAdded: [],
    finalistsAdded: [],
    unresolvedConflict: "",
    consensusDelta,
    scoreDeltas: {
      contribution: 2,
      progress,
      listening: 3,
      conflict: 2,
      structure: 2,
    },
  };
}

describe("targeted practice comparison", () => {
  it("marks a stronger revised turn as improved", () => {
    const attempt = createRetrainAttempt({
      targetTurn: 2,
      originalText: "我同意大家。",
      revisedText: "我建议保留双方共同点，并明确先后顺序和验证节点。",
      originalAssessment: assessment("developing", 3, 2),
      revisedAssessment: assessment("strong", 10, 6),
      completedAt: "2026-08-30T09:00:00.000Z",
      id: "retrain-1",
    });

    expect(attempt.improved).toBe(true);
    expect(attempt.impactDelta).toBeGreaterThan(0);
    expect(attempt.revisedQuality).toBe("strong");
  });

  it("keeps optional voice pace evidence in the comparison", () => {
    const attempt = createRetrainAttempt({
      targetTurn: 2,
      originalText: "原发言",
      revisedText: "重练发言",
      originalAssessment: assessment("developing", 3, 2),
      revisedAssessment: assessment("developing", 4, 3),
      originalVoiceMetric: {
        turn: 2,
        durationSeconds: 10,
        pauseCount: 1,
        characterCount: 30,
        charsPerMinute: 180,
      },
      revisedVoiceMetric: {
        turn: 2,
        durationSeconds: 12,
        pauseCount: 1,
        characterCount: 48,
        charsPerMinute: 240,
      },
    });

    expect(attempt.originalCharsPerMinute).toBe(180);
    expect(attempt.revisedCharsPerMinute).toBe(240);
  });

  it("keeps three chronological attempts for one challenge and finds the best", () => {
    const attempts = [1, 2, 3, 4].map((index) =>
      createRetrainAttempt({
        targetTurn: 2,
        originalText: "原发言",
        revisedText: `第 ${index} 次重练`,
        originalAssessment: assessment("developing", 3, 2),
        revisedAssessment: assessment(
          index === 3 ? "strong" : "developing",
          index === 3 ? 10 : index + 3,
          index === 3 ? 7 : index + 2,
        ),
        completedAt: `2026-08-30T09:0${index}:00.000Z`,
        id: `retrain-${index}`,
      }),
    );

    const challenge = retrainAttemptsForTurn([...attempts, attempts[3]], 2);

    expect(challenge.map((attempt) => attempt.id)).toEqual([
      "retrain-2",
      "retrain-3",
      "retrain-4",
    ]);
    expect(bestRetrainAttempt(challenge)?.id).toBe("retrain-3");
  });

  it("recommends the weakest low-impact turn first", () => {
    const stronger = assessment("developing", 5, 4);
    const weakest = {
      ...assessment("weak", 1, 0),
      id: "weakest",
      turn: 3,
    };

    expect(recommendedRetrainTurn([stronger, weakest])?.turn).toBe(3);
  });
});
