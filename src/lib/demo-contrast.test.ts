import { describe, expect, it } from "vitest";

import { buildContrastLines } from "./demo-contrast";
import { getScenario } from "./scenario";

describe("buildContrastLines", () => {
  it("builds a grounded campus comparison line from real candidate positions and options", () => {
    const scenario = getScenario("campus-career-retention");
    const lines = buildContrastLines(scenario);
    const mentionedOptions = scenario.options.filter((option) =>
      lines.grounded.includes(option.title),
    );

    expect(lines.grounded).toContain("程野");
    expect(lines.grounded).toContain("林乔");
    expect(lines.grounded).toContain("修复消息提醒");
    expect(mentionedOptions.length).toBeGreaterThanOrEqual(2);
    expect(lines.grounded).toMatch(/结合|先.+再/);
  });

  it("keeps the fixed vague line free of every scenario option title", () => {
    const scenario = getScenario("campus-career-retention");
    const lines = buildContrastLines(scenario);

    expect(lines.vague).toBe("我们结合一下大家意见，先总结再推进。");
    scenario.options.forEach((option) => {
      expect(lines.vague).not.toContain(option.title);
    });
  });
});
