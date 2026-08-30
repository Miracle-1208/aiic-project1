import { describe, expect, it } from "vitest";

import {
  bestRetrainAttempt,
  createRetrainAttempt,
  recommendedRetrainTurn,
  retrainAttemptsForTurn,
  scoreRetrainText,
} from "./retrain";
import { scenarios } from "./scenario";
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
    expect(bestRetrainAttempt(challenge)?.id).toBe("retrain-4");
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

  it("ranks a complete integrated answer above a short AI-favored answer", () => {
    const scenario = scenarios[0];
    const texts = [
      "我同意先处理消息提醒和新用户引导，因为它们更快，也更便宜。",
      "周可提出标准不清、林乔担心长期价值，我建议把标准按优先级排为：先看六周内能否直接改善留存，再看预算效率，最后保留长期价值验证。基于这个顺序，先修复消息提醒并同步优化新用户引导，两周后用提醒到达率和次日留存决定是否继续投入。",
      "我先整合两位的关注点：程野强调六周内见效，林乔担心长期价值，周可要求统一标准。建议按直接留存影响、交付确定性、预算效率依次判断：第一阶段用8万元在两周内修复消息提醒，并同步启动18万元的新用户引导；第2周检查提醒到达率，第4周检查首日任务完成率和次日留存。若次日改善但七日留存不动，再用剩余24万元做限定人数的学长咨询实验。这样结论、顺序和验证节点都明确。",
    ];
    const attempts = texts.map((revisedText, index) =>
      createRetrainAttempt({
        targetTurn: 1,
        originalText: "我建议先统一标准，再比较消息提醒和新用户引导。",
        revisedText,
        originalAssessment: assessment("strong", 9, 5),
        revisedAssessment: assessment(
          "strong",
          [20, 18, 1][index],
          [10, 9, 0][index],
        ),
        scenario,
        completedAt: `2026-08-30T10:0${index}:00.000Z`,
        id: `calibrated-${index + 1}`,
      }),
    );

    expect(scoreRetrainText(texts[2], scenario).total).toBeGreaterThan(
      scoreRetrainText(texts[0], scenario).total,
    );
    expect(bestRetrainAttempt(attempts)?.id).toBe("calibrated-3");
  });
});
