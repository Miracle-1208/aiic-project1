import { describe, expect, it } from "vitest";

import {
  applyUserTurn,
  classifyIntent,
  createInitialState,
  finishSession,
  formatTime,
} from "./engine";

describe("group interview engine", () => {
  it("classifies the collaboration actions that drive the group state", () => {
    expect(classifyIntent("我们先统一评价标准，再逐项比较")).toBe("criteria");
    expect(classifyIntent("我想结合两边的意见，保留共同点")).toBe("integrate");
    expect(classifyIntent("时间不多了，我们应该开始收敛")).toBe("time");
    expect(classifyIntent("我不同意，现在的方案还有预算风险")).toBe("challenge");
  });

  it("turns a useful user contribution into visible group-state changes", () => {
    const initial = createInitialState();
    const next = applyUserTurn(
      initial,
      "我们先统一评价标准：用户影响、预算成本和上线周期。",
    );

    expect(next.turn).toBe(1);
    expect(next.consensus).toBeGreaterThan(initial.consensus);
    expect(next.criteria).toEqual(
      expect.arrayContaining(["用户影响", "投入产出比", "实施确定性"]),
    );
    expect(next.messages.length).toBeGreaterThan(initial.messages.length);
    expect(next.influence.at(-1)?.title).toBe("建立共同标准");
  });

  it("keeps score dimensions within the declared 100-point ceiling", () => {
    let state = createInitialState();
    for (let index = 0; index < 12; index += 1) {
      state = applyUserTurn(
        state,
        "我想结合大家的意见，同时处理短期问题和长期风险。",
      );
    }
    state = finishSession(
      state,
      "我们依据用户影响、投入产出和上线周期，最终选择消息提醒与新手引导，并保留用户验证作为风险控制。",
    );

    expect(Object.values(state.scores).reduce((sum, value) => sum + value, 0)).toBeLessThanOrEqual(100);
    expect(state.consensus).toBeLessThanOrEqual(100);
    expect(state.finalists).toEqual(
      expect.arrayContaining(["修复消息提醒", "优化新用户引导"]),
    );
  });

  it("formats the interview timer consistently", () => {
    expect(formatTime(480)).toBe("08:00");
    expect(formatTime(65)).toBe("01:05");
  });
});
