import { describe, expect, it } from "vitest";

import { createInitialState, finishSession } from "./engine";
import {
  TRAINING_HISTORY_KEY,
  appendRetrainAttempt,
  appendTrainingRecord,
  createTrainingRecord,
  dimensionPercent,
  parseTrainingHistory,
  persistTrainingHistory,
  readTrainingHistory,
  weakestDimension,
} from "./history";
import { createRetrainAttempt } from "./retrain";

function completedState() {
  return finishSession(
    createInitialState("ai-study-beta", "pressure"),
    "我们依据用户刚需、学习效果和交付确定性，选择个性化学习计划与错题诊断，并把隐私和验证偏差作为主要风险。",
  );
}

describe("training history", () => {
  it("creates a compact report record from a completed session", () => {
    const record = createTrainingRecord(
      completedState(),
      "2026-08-30T08:00:00.000Z",
      "session-1",
    );

    expect(record).toMatchObject({
      id: "session-1",
      scenarioId: "ai-study-beta",
      difficulty: "pressure",
    });
    expect(record.report.total).toBeGreaterThan(0);
    expect(record.report.dimensions).toHaveLength(5);
    expect(record.finalists).toEqual(
      expect.arrayContaining(["个性化学习计划", "错题诊断与知识图谱"]),
    );
  });

  it("ignores corrupt browser data instead of breaking the app", () => {
    expect(parseTrainingHistory("not-json")).toEqual([]);
    expect(parseTrainingHistory(JSON.stringify([{ id: "broken" }]))).toEqual([]);
  });

  it("persists, reads and orders records by completion time", () => {
    let stored: string | null = null;
    const storage = {
      getItem: (key: string) => (key === TRAINING_HISTORY_KEY ? stored : null),
      setItem: (key: string, value: string) => {
        if (key === TRAINING_HISTORY_KEY) stored = value;
      },
    };
    const older = createTrainingRecord(
      completedState(),
      "2026-08-29T08:00:00.000Z",
      "older",
    );
    const newer = createTrainingRecord(
      completedState(),
      "2026-08-30T08:00:00.000Z",
      "newer",
    );
    const records = appendTrainingRecord([older], newer);

    persistTrainingHistory(records, storage);

    expect(readTrainingHistory(storage).map((record) => record.id)).toEqual([
      "newer",
      "older",
    ]);
  });

  it("derives normalized trend values and the current weakest dimension", () => {
    const record = createTrainingRecord(
      completedState(),
      "2026-08-30T08:00:00.000Z",
      "session-1",
    );

    expect(dimensionPercent(record, "progress")).toBeGreaterThanOrEqual(0);
    expect(dimensionPercent(record, "progress")).toBeLessThanOrEqual(100);
    expect(weakestDimension([record])?.key).toBeTruthy();
  });

  it("stores a targeted-practice result inside its source session", () => {
    const state = completedState();
    const record = createTrainingRecord(
      state,
      "2026-08-30T08:00:00.000Z",
      "session-1",
    );
    const originalAssessment = state.assessments[0];
    const revisedAssessment = {
      ...originalAssessment,
      id: "revised-assessment",
      quality: "strong" as const,
      consensusDelta: originalAssessment.consensusDelta + 3,
    };
    const attempt = createRetrainAttempt({
      targetTurn: originalAssessment.turn,
      originalText: originalAssessment.evidence,
      revisedText: "重新组织后的发言",
      originalAssessment,
      revisedAssessment,
      completedAt: "2026-08-30T09:00:00.000Z",
      id: "retrain-1",
    });
    const updated = appendRetrainAttempt([record], record.id, attempt);

    expect(updated[0].retrainAttempts).toHaveLength(1);
    expect(
      parseTrainingHistory(JSON.stringify(updated))[0].retrainAttempts?.[0].id,
    ).toBe("retrain-1");
  });
});
