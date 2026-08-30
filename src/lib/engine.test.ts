import { describe, expect, it } from "vitest";

import {
  applyUserTurn,
  classifyIntent,
  createInitialState,
  finishSession,
  formatTime,
  restoreTurnSnapshot,
} from "./engine";
import { scenarios } from "./scenario";
import type { Scenario } from "./types";

describe("group interview engine", () => {
  it("classifies the collaboration actions that drive the group state", () => {
    expect(classifyIntent("我们先统一评价标准：用户影响、预算和上线周期")).toBe(
      "criteria",
    );
    expect(
      classifyIntent(
        "结合程野关注的留存和林乔强调的长期价值，先修复消息提醒，再验证优化新用户引导。",
      ),
    ).toBe("integrate");
    expect(classifyIntent("时间不多了，我们先锁定修复消息提醒并开始收敛")).toBe(
      "time",
    );
    expect(classifyIntent("我不同意，现在的方案还有预算风险")).toBe("general");
    expect(
      classifyIntent(
        "我质疑只做短期修复，因为它可能牺牲长期用户价值，这个风险要用留存变化验证。",
      ),
    ).toBe("challenge");
    expect(
      classifyIntent(
        "我反对只修复消息提醒，因为短期留存和长期用户价值的风险仍未验证。",
      ),
    ).toBe("challenge");
    expect(classifyIntent("我们结合一下")).toBe("general");
  });

  it("does not reward a challenge made from one dictionary entity", () => {
    const initial = createInitialState();
    const next = applyUserTurn(
      initial,
      "我不同意，现在的方案还有预算风险",
    );

    expect(next.assessments.at(-1)).toMatchObject({
      intent: "general",
      consensusDelta: 0,
    });
    expect(next.consensus).toBe(initial.consensus);
  });

  it("does not let collaboration keywords move the team without case substance", () => {
    const initial = createInitialState();
    const next = applyUserTurn(initial, "我们结合一下");

    expect(next.consensus).toBe(initial.consensus);
    expect(next.criteria).toEqual([]);
    expect(next.finalists).toEqual([]);
    expect(next.assessments.at(-1)).toMatchObject({
      intent: "general",
      consensusDelta: 0,
    });
    expect(next.influence.at(-1)).toMatchObject({
      evidence: "我们结合一下",
      consensusDelta: 0,
    });
    expect(next.influence.at(-1)?.noProgressReason).toMatch(/程野|林乔|周可/);
  });

  it("rejects an AI integrate label when its grounded quote is still empty", () => {
    const initial = createInitialState();
    const next = applyUserTurn(initial, "我们结合一下。", {
      replies: [{ speaker: "cheng", content: "请先说明要结合哪两种主张。" }],
      assessment: {
        intent: "integrate",
        quality: "strong",
        evidence: "我们结合一下",
        impactTitle: "错误整合",
        impactDetail: "模型错误地把动作词当作团队推进。",
        suggestion: "补充具体主张。",
        criteriaAdded: [],
        finalistsAdded: [],
        unresolvedConflict: "",
        consensusDelta: 18,
        scoreDeltas: {
          contribution: 6,
          progress: 6,
          listening: 6,
          conflict: 6,
          structure: 6,
        },
      },
    });

    expect(next.assessments.at(-1)).toMatchObject({
      source: "fallback",
      intent: "general",
      consensusDelta: 0,
    });
    expect(next.consensus).toBe(initial.consensus);
  });

  it("only rewards integration that names real positions and real options", () => {
    const initial = createInitialState();
    const next = applyUserTurn(
      initial,
      "结合程野关注的留存和林乔强调的长期价值，先做修复消息提醒，再验证优化新用户引导。",
    );

    expect(next.assessments.at(-1)?.intent).toBe("integrate");
    expect(next.consensus).toBeGreaterThan(initial.consensus);
    expect(next.finalists).toEqual(
      expect.arrayContaining(["修复消息提醒", "优化新用户引导"]),
    );
  });

  it("does not invent shared criteria when the user only says the word standard", () => {
    const initial = createInitialState();
    const next = applyUserTurn(initial, "我们先统一评价标准，再逐项比较。");

    expect(next.criteria).toEqual([]);
  });

  it("does not silently fill fallback finalists for an option-free integration", () => {
    const initial = createInitialState();
    const next = applyUserTurn(
      initial,
      "我们结合短期修复和长期用户价值，先回应当前分歧再决定方案。",
    );

    expect(next.assessments.at(-1)?.intent).toBe("integrate");
    expect(next.finalists).toEqual([]);
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

  it("attaches a completed voice capture to the submitted turn", () => {
    const initial = createInitialState();
    const next = applyUserTurn(
      initial,
      "我们先比较用户影响、预算和上线周期。",
      undefined,
      { durationSeconds: 12, pauseCount: 2 },
    );

    expect(next.voiceMetrics).toEqual([
      expect.objectContaining({
        turn: 1,
        durationSeconds: 12,
        pauseCount: 2,
      }),
    ]);
    expect(next.voiceMetrics[0].characterCount).toBeGreaterThan(0);
    expect(next.voiceMetrics[0].charsPerMinute).toBeGreaterThan(0);
  });

  it("restores the exact discussion state before a selected turn", () => {
    const initial = createInitialState();
    const first = applyUserTurn(
      initial,
      "我们先统一用户影响、预算和周期三项标准。",
    );
    const second = applyUserTurn(
      first,
      "我建议结合大家意见，先比较两个最可行方案。",
    );
    const restored = restoreTurnSnapshot(second, 2);

    expect(second.turnSnapshots.map((snapshot) => snapshot.targetTurn)).toEqual([
      1,
      2,
    ]);
    expect(restored).toMatchObject({
      turn: 1,
      consensus: first.consensus,
      conflict: first.conflict,
      finalStatement: "",
    });
    expect(restored?.messages).toEqual(first.messages);
    expect(restored?.turnSnapshots).toHaveLength(1);
  });

  it("uses live replies and evidence while keeping score changes bounded", () => {
    const initial = createInitialState();
    const next = applyUserTurn(
      initial,
      "我建议先按用户影响和上线周期比较。",
      {
        replies: [
          {
            speaker: "zhou",
            content: "标准可以，但还需要把预算约束放进同一张比较表。",
          },
        ],
        assessment: {
          intent: "criteria",
          quality: "strong",
          evidence: "用户影响和上线周期",
          impactTitle: "建立比较框架",
          impactDetail: "你把两个判断维度带入讨论，团队可以据此比较方案。",
          suggestion: "下一步补上预算维度并说明三个标准的优先级。",
          criteriaAdded: ["用户影响", "实施确定性"],
          finalistsAdded: [],
          unresolvedConflict: "三个标准如何排序？",
          consensusDelta: 11,
          scoreDeltas: {
            contribution: 5,
            progress: 4,
            listening: 1,
            conflict: 0,
            structure: 4,
          },
        },
      },
    );

    expect(next.messages.at(-1)).toMatchObject({
      speaker: "zhou",
      content: "标准可以，但还需要把预算约束放进同一张比较表。",
    });
    expect(next.criteria).toEqual(
      expect.arrayContaining(["用户影响", "实施确定性"]),
    );
    expect(next.assessments.at(-1)).toMatchObject({
      source: "ai",
      evidence: "用户影响和上线周期",
      impactTitle: "建立比较框架",
    });
    expect(next.influence.at(-1)?.suggestion).toBe("补上预算维度并说明三个标准的优先级。");
  });

  it("accepts AI evidence when only whitespace differs from the user quote", () => {
    const initial = createInitialState();
    const next = applyUserTurn(
      initial,
      "我建议先按用户影响和上线周期比较。",
      {
        replies: [{ speaker: "zhou", content: "可以，再补上预算约束。" }],
        assessment: {
          intent: "criteria",
          quality: "strong",
          evidence: "用户影响  和\n上线周期",
          impactTitle: "建立比较框架",
          impactDetail: "用户给出了两个可比较维度。",
          suggestion: "补上预算维度。",
          criteriaAdded: ["用户影响", "实施确定性"],
          finalistsAdded: [],
          unresolvedConflict: "三个标准如何排序？",
          consensusDelta: 8,
          scoreDeltas: {
            contribution: 4,
            progress: 4,
            listening: 1,
            conflict: 0,
            structure: 4,
          },
        },
      },
    );

    expect(next.assessments.at(-1)).toMatchObject({
      source: "ai",
      evidence: "用户影响和上线周期",
    });
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

  it("includes a spoken final statement in the expression evidence", () => {
    const initial = applyUserTurn(
      createInitialState(),
      "我们先按用户影响和上线周期比较。",
    );
    const finished = finishSession(
      initial,
      "我们依据用户影响和上线周期，选择消息提醒与新用户引导，并保留用户验证控制风险。",
      undefined,
      { durationSeconds: 24, pauseCount: 2 },
    );

    expect(finished.voiceMetrics.at(-1)).toMatchObject({
      turn: 2,
      durationSeconds: 24,
      pauseCount: 2,
    });
  });

  it("creates independent case state for every scenario and difficulty", () => {
    const guided = createInitialState("coffee-safety-crisis", "guided");
    const pressure = createInitialState("coffee-safety-crisis", "pressure");

    expect(guided.scenarioId).toBe("coffee-safety-crisis");
    expect(guided.messages[0].content).toContain("12 家涉事门店");
    expect(guided.conflict).toContain("公开回应消费者");
    expect(guided.timeLeft).toBeGreaterThan(pressure.timeLeft);
    expect(guided.consensus).toBeGreaterThan(pressure.consensus);
  });

  it("uses a complete custom scenario throughout classification and state changes", () => {
    const customScenario: Scenario = {
      ...scenarios[0],
      id: "custom-product-role",
      title: "定制岗位题",
      optionAliases: {
        ...scenarios[0].optionAliases,
        notification: ["专属提醒方案"],
      },
    };
    const initial = createInitialState(customScenario, "standard");
    const next = applyUserTurn(initial, "我建议选择专属提醒方案。" );

    expect(initial.scenario.title).toBe("定制岗位题");
    expect(next.finalists).toContain("修复消息提醒");
    expect(next.messages.at(-1)?.content).toBeTruthy();
  });

  it("extracts finalists from the selected case instead of the default case", () => {
    const initial = createInitialState("ai-study-beta", "standard");
    const next = applyUserTurn(
      initial,
      "我建议首版先做个性化学习计划和错题诊断，形成可以验证学习效果的闭环。",
    );

    expect(next.finalists).toEqual(
      expect.arrayContaining(["个性化学习计划", "错题诊断与知识图谱"]),
    );
    expect(next.finalists).not.toContain("修复消息提醒");
  });

  it("makes high-pressure scoring and consensus growth stricter", () => {
    const userText = "我想兼顾两边意见，先公开说明，同时保留第三方检测。";
    const directorTurn = {
      replies: [
        {
          speaker: "zhou" as const,
          content: "可以，但还需要说明两个动作的先后顺序和判断节点。",
        },
      ],
      assessment: {
        intent: "integrate" as const,
        quality: "strong" as const,
        evidence: "先公开说明，同时保留第三方检测",
        impactTitle: "整合应急与验证",
        impactDetail: "你把即时回应和事实验证放入同一条行动路径。",
        suggestion: "明确两个行动的先后顺序和调整条件。",
        criteriaAdded: [],
        finalistsAdded: ["公开说明并滚动通报", "委托第三方全链路检测"],
        unresolvedConflict: "两个行动如何衔接？",
        consensusDelta: 12,
        scoreDeltas: {
          contribution: 4,
          progress: 5,
          listening: 5,
          conflict: 4,
          structure: 3,
        },
      },
    };
    const guided = createInitialState("coffee-safety-crisis", "guided");
    const pressure = createInitialState("coffee-safety-crisis", "pressure");
    const guidedNext = applyUserTurn(guided, userText, directorTurn);
    const pressureNext = applyUserTurn(pressure, userText, directorTurn);
    const total = (scores: typeof guided.scores) =>
      Object.values(scores).reduce((sum, value) => sum + value, 0);

    expect(guidedNext.consensus - guided.consensus).toBeGreaterThan(
      pressureNext.consensus - pressure.consensus,
    );
    expect(total(guidedNext.scores) - total(guided.scores)).toBeGreaterThan(
      total(pressureNext.scores) - total(pressure.scores),
    );
  });

  it("locks pressure consensus when the latest candidate objection is unanswered", () => {
    const userText =
      "我们先按消费者安全、响应速度、信息透明和预算约束建立标准。";
    const directorTurn = {
      replies: [
        {
          speaker: "zhou" as const,
          content: "标准可以，但还需要先回应第三方检测和对外行动的冲突。",
        },
      ],
      assessment: {
        intent: "criteria" as const,
        quality: "strong" as const,
        evidence: "消费者安全、响应速度、信息透明和预算约束",
        impactTitle: "建立危机处置标准",
        impactDetail: "用户建立了共同判断标准。",
        suggestion: "下一步回应候选人的具体反对。",
        criteriaAdded: ["消费者安全", "响应速度", "信息透明", "资源成本"],
        finalistsAdded: [],
        unresolvedConflict: "标准如何应用到方案？",
        consensusDelta: 12,
        scoreDeltas: {
          contribution: 4,
          progress: 4,
          listening: 2,
          conflict: 2,
          structure: 4,
        },
      },
    };
    const pressure = createInitialState("coffee-safety-crisis", "pressure");
    const guided = createInitialState("coffee-safety-crisis", "guided");
    const pressureNext = applyUserTurn(pressure, userText, directorTurn);
    const guidedNext = applyUserTurn(guided, userText, directorTurn);

    expect(pressureNext.consensus).toBeLessThanOrEqual(pressure.consensus);
    expect(pressureNext.assessments.at(-1)?.consensusDelta).toBeLessThanOrEqual(0);
    expect(pressureNext.influence.at(-1)?.noProgressReason).toMatch(/林乔|周可/);
    expect(pressureNext.conflict).toMatch(/退款补偿|第三方检测|原因未明/);
    expect(guidedNext.consensus).toBeGreaterThan(guided.consensus);
  });

  it("allows pressure consensus after the latest objections are answered", () => {
    const initial = createInitialState("coffee-safety-crisis", "pressure");
    const next = applyUserTurn(
      initial,
      "我回应林乔的退款补偿和周可的第三方检测：先公开说明并滚动通报，同时委托第三方全链路检测，先满足对外行动再验证原因。",
    );

    expect(next.assessments.at(-1)?.intent).toBe("integrate");
    expect(next.assessments.at(-1)?.consensusDelta).toBeGreaterThan(0);
    expect(next.consensus).toBeGreaterThan(initial.consensus);
  });

  it("does not cite an older opening objection after a newer reply replaced it", () => {
    const initial = createInitialState("coffee-safety-crisis", "guided");
    const first = applyUserTurn(
      initial,
      "我们先按消费者安全、响应速度、信息透明和预算约束建立标准。",
    );
    const second = applyUserTurn(first, "我们先继续讨论。");

    expect(second.influence.at(-1)?.noProgressReason).toContain(first.conflict);
    expect(second.influence.at(-1)?.noProgressReason).not.toMatch(/原因未明|退款补偿/);
  });

  it("does not fill final options that the final statement never named", () => {
    const initial = createInitialState();
    const finished = finishSession(
      initial,
      "我们最终按用户影响、预算和上线周期判断，并重点控制长期风险和验证质量。",
    );

    expect(finished.finalists).toEqual([]);
    for (const fallback of initial.scenario.fallbackFinalists) {
      expect(finished.finalists).not.toContain(fallback);
    }
  });

  it("keeps AI coaching grounded when it introduces a new numeric commitment", () => {
    const initial = createInitialState();
    const statement =
      "我们依据用户影响、投入产出和上线周期，选择消息提醒与新用户引导，并持续验证长期需求。";
    const next = finishSession(initial, statement, {
      replies: [
        {
          speaker: "cheng",
          content: "结论清楚，我同意按这个结构完成陈述。",
        },
      ],
      assessment: {
        intent: "summary",
        quality: "strong",
        evidence: "选择消息提醒与新用户引导",
        impactTitle: "交付小组结论",
        impactDetail: "你完成了方案选择并说明了后续验证方向。",
        suggestion: "两周后增加一次回访问卷。",
        criteriaAdded: ["用户影响", "投入产出比", "实施确定性"],
        finalistsAdded: ["修复消息提醒", "优化新用户引导"],
        unresolvedConflict: "",
        consensusDelta: 18,
        scoreDeltas: {
          contribution: 4,
          progress: 6,
          listening: 3,
          conflict: 2,
          structure: 6,
        },
      },
    });

    expect(next.assessments.at(-1)?.source).toBe("ai");
    expect(next.assessments.at(-1)?.suggestion).not.toContain("两周");
    expect(next.finalists).toEqual(
      expect.arrayContaining(["修复消息提醒", "优化新用户引导"]),
    );
  });

  it("falls back to grounded local assessment when AI evidence is not user text", () => {
    const initial = createInitialState();
    const next = applyUserTurn(
      initial,
      "我们先按用户影响、预算和上线周期建立评价标准。",
      {
        replies: [{ speaker: "zhou", content: "可以继续比较三个维度的优先级。" }],
        assessment: {
          intent: "challenge",
          quality: "strong",
          evidence: "这句话并不是用户说的",
          impactTitle: "错误评估",
          impactDetail: "错误地引用了其他内容。",
          suggestion: "继续说明理由。",
          criteriaAdded: [],
          finalistsAdded: [],
          unresolvedConflict: "",
          consensusDelta: 12,
          scoreDeltas: {
            contribution: 6,
            progress: 6,
            listening: 6,
            conflict: 6,
            structure: 6,
          },
        },
      },
    );

    expect(next.assessments.at(-1)).toMatchObject({
      source: "fallback",
      intent: "criteria",
      impactTitle: "建立共同标准",
    });
    expect(next.consensus - initial.consensus).toBe(9);
    expect(next.assessments.at(-1)?.consensusDelta).not.toBe(12);
  });

  it("keeps empty agreement and unverifiable challenge from gaining consensus", () => {
    const initial = createInitialState();
    const support = applyUserTurn(initial, "我同意大家。", {
      replies: [{ speaker: "cheng", content: "那请说明你同意的具体判断。" }],
      assessment: {
        intent: "support",
        quality: "strong",
        evidence: "我同意大家",
        impactTitle: "表达支持",
        impactDetail: "用户表示同意。",
        suggestion: "补充具体理由。",
        criteriaAdded: [],
        finalistsAdded: [],
        unresolvedConflict: initial.conflict,
        consensusDelta: 10,
        scoreDeltas: {
          contribution: 3,
          progress: 3,
          listening: 4,
          conflict: 1,
          structure: 2,
        },
      },
    });
    const challenge = applyUserTurn(initial, "这个方案我有疑问。", {
      replies: [{ speaker: "zhou", content: "请说明可以验证的具体风险。" }],
      assessment: {
        intent: "challenge",
        quality: "strong",
        evidence: "这个方案我有疑问",
        impactTitle: "提出质疑",
        impactDetail: "用户提出了疑问。",
        suggestion: "补充具体风险。",
        criteriaAdded: [],
        finalistsAdded: [],
        unresolvedConflict: initial.conflict,
        consensusDelta: 10,
        scoreDeltas: {
          contribution: 3,
          progress: 3,
          listening: 3,
          conflict: 4,
          structure: 2,
        },
      },
    });

    expect(support.consensus).toBe(initial.consensus);
    expect(challenge.consensus).toBeLessThanOrEqual(initial.consensus);
  });

  it("formats the interview timer consistently", () => {
    expect(formatTime(480)).toBe("08:00");
    expect(formatTime(65)).toBe("01:05");
  });
});
