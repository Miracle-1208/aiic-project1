import { describe, expect, it } from "vitest";

import { buildExpressionReport } from "./voice";

describe("voice expression report", () => {
  it("returns no expression section when the user only typed", () => {
    expect(buildExpressionReport([])).toBeUndefined();
  });

  it("summarizes multiple spoken turns using weighted duration", () => {
    const report = buildExpressionReport([
      {
        turn: 1,
        durationSeconds: 30,
        pauseCount: 2,
        characterCount: 100,
        charsPerMinute: 200,
      },
      {
        turn: 2,
        durationSeconds: 20,
        pauseCount: 1,
        characterCount: 100,
        charsPerMinute: 300,
      },
    ]);

    expect(report).toMatchObject({
      voiceTurns: 2,
      totalSeconds: 50,
      averageCharsPerMinute: 240,
      pauseCount: 3,
      paceLabel: "稳健",
    });
  });

  it("gives a concrete pacing suggestion for very fast delivery", () => {
    const report = buildExpressionReport([
      {
        turn: 1,
        durationSeconds: 10,
        pauseCount: 0,
        characterCount: 80,
        charsPerMinute: 480,
      },
    ]);

    expect(report?.paceLabel).toBe("过快");
    expect(report?.suggestion).toContain("结论—理由—动作");
  });
});
