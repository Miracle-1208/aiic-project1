import type {
  DifficultyProfile,
  Participant,
  Scenario,
  ScenarioId,
  TrainingDifficulty,
} from "./types";

export const SCENARIO_IDS = [
  "campus-career-retention",
  "coffee-safety-crisis",
  "ai-study-beta",
] as const satisfies readonly ScenarioId[];

export const DIFFICULTY_IDS = [
  "guided",
  "standard",
  "pressure",
] as const satisfies readonly TrainingDifficulty[];

export const difficultyProfiles: DifficultyProfile[] = [
  {
    id: "guided",
    label: "入门陪练",
    shortLabel: "入门",
    description: "队友更愿意配合，发言不完整时会给你追问提示。",
    behavior: "以建设性追问为主，每轮通常只让一名候选人回应；允许用户逐步完善观点。",
    consensusMultiplier: 1.15,
    scoreMultiplier: 1.1,
    timeMultiplier: 1.15,
    initialConsensusDelta: 5,
  },
  {
    id: "standard",
    label: "真实群面",
    shortLabel: "标准",
    description: "观点冲突与协作并存，接近常见校园招聘群面。",
    behavior: "保持真实分歧，每轮选择一至两名最相关的候选人回应，并要求用户说明取舍。",
    consensusMultiplier: 1,
    scoreMultiplier: 1,
    timeMultiplier: 1,
    initialConsensusDelta: 0,
  },
  {
    id: "pressure",
    label: "高压挑战",
    shortLabel: "高压",
    description: "队友会追问证据、反驳假设，并持续施加收敛压力。",
    behavior: "优先挑战缺少证据的判断，紧扣限制条件，通常让两名不同立场候选人回应；不要轻易让步或快速形成共识。",
    consensusMultiplier: 0.72,
    scoreMultiplier: 0.82,
    timeMultiplier: 0.85,
    initialConsensusDelta: -6,
  },
];

export const scenarios: Scenario[] = [
  {
    id: "campus-career-retention",
    category: "资源分配",
    caseNumber: "CASE 01",
    accent: "#5b7cfa",
    title: "大学生求职 App 留存提升方案",
    company: "星桥科技 · 产品管培生群面",
    brief:
      "星桥是一款面向大学生的求职 App。过去三个月，新用户次日留存从 42% 下降到 29%。团队希望在秋招高峰前完成一次关键改进。",
    goal: "在讨论时间内从 5 个方案中选择 2 个，形成统一建议并说明选择标准、核心理由和主要风险。",
    timeLimit: 8 * 60,
    selectionCount: 2,
    initialConsensus: 28,
    initialConflict: "短期修复，还是长期用户价值？",
    constraints: [
      "总预算不超过 50 万元",
      "6 周内至少上线一个方案",
      "最终必须由一名成员代表小组陈述",
    ],
    facts: [
      { label: "次日留存", value: "29% ↓13pt" },
      { label: "可用预算", value: "50 万元" },
      { label: "上线窗口", value: "6 周" },
    ],
    options: [
      {
        id: "onboarding",
        title: "优化新用户引导",
        description: "缩短注册流程，根据求职目标生成首日任务。",
        cost: "18 万",
        cycle: "4 周",
        signal: "首日任务完成率仅 31%",
      },
      {
        id: "recommendation",
        title: "升级岗位推荐",
        description: "增加专业、城市和求职阶段特征，重做推荐策略。",
        cost: "32 万",
        cycle: "8 周",
        signal: "推荐岗位点击率下降 9%",
      },
      {
        id: "mentor",
        title: "上线学长咨询",
        description: "引入认证学长，提供 15 分钟求职咨询。",
        cost: "38 万",
        cycle: "6 周",
        signal: "访谈中呼声最高，但供给不稳定",
      },
      {
        id: "notification",
        title: "修复消息提醒",
        description: "修复安卓端职位提醒延迟和重复推送问题。",
        cost: "8 万",
        cycle: "2 周",
        signal: "安卓用户投诉量增长 2.4 倍",
      },
      {
        id: "open-day",
        title: "举办企业开放日",
        description: "联合 20 家企业进行直播宣讲和岗位答疑。",
        cost: "25 万",
        cycle: "5 周",
        signal: "过往活动拉新强，但次周回访低",
      },
    ],
    referenceCriteria: [
      { label: "用户影响", keywords: ["用户", "留存", "价值", "体验"] },
      { label: "投入产出比", keywords: ["成本", "预算", "投入", "收益"] },
      { label: "实施确定性", keywords: ["时间", "周期", "上线", "落地"] },
      { label: "长期价值", keywords: ["长期", "持续", "未来"] },
    ],
    optionAliases: {
      onboarding: ["优化新用户引导", "新用户引导", "新手引导", "注册流程"],
      recommendation: ["升级岗位推荐", "岗位推荐", "推荐策略"],
      mentor: ["上线学长咨询", "学长咨询", "学长服务"],
      notification: ["修复消息提醒", "消息提醒", "提醒故障", "安卓提醒"],
      "open-day": ["举办企业开放日", "企业开放日", "开放日", "直播宣讲"],
    },
    participantStances: {
      cheng: "修复提醒 + 新手引导",
      lin: "学长咨询 + 企业开放日",
      zhou: "岗位推荐 + 消息提醒",
    },
    openingMessages: [
      {
        speaker: "cheng",
        content:
          "我先抛个结论：优先修复消息提醒，再优化新用户引导。两个方案一共 26 万，6 周内都能上线，也能直接处理眼前的留存问题。",
      },
      {
        speaker: "lin",
        content:
          "我想先保留不同意见。访谈里学生最想要学长咨询，或许留存下降的根因不是流程，而是缺少持续获得帮助的理由。",
      },
      {
        speaker: "zhou",
        content:
          "我们还没有统一评价标准。是看短期留存提升、长期用户价值，还是实施确定性？如果标准不清楚，现在投票会比较早。",
      },
    ],
    quickActions: [
      "我们先统一评价标准：用户影响、成本和上线周期。",
      "我想结合两边意见，先解决确定性问题，再验证长期需求。",
      "时间过半了，我们先锁定一个确定性最高的方案。",
    ],
    fallbackFinalists: ["修复消息提醒", "优化新用户引导"],
  },
  {
    id: "coffee-safety-crisis",
    category: "危机决策",
    caseNumber: "CASE 02",
    accent: "#e65f3c",
    title: "连锁咖啡食品安全危机处置",
    company: "青禾咖啡 · 运营管培生群面",
    brief:
      "青禾咖啡因一批原料标签缺失登上负面热搜，涉及 12 家门店。内部初检尚未发现明确致害证据，但消费者质疑持续扩大，管理层需要立即决定处置组合。",
    goal: "在决策窗口内从 5 项行动中选择 2 项优先执行，兼顾消费者安全、信息透明和经营连续性。",
    timeLimit: 8 * 60,
    selectionCount: 2,
    initialConsensus: 22,
    initialConflict: "先控制经营风险，还是先公开回应消费者？",
    constraints: [
      "首轮处置预算不超过 80 万元",
      "12 小时内必须有一项对外行动",
      "不得把尚未确认的信息当作调查结论",
    ],
    facts: [
      { label: "舆情位置", value: "热搜第 3" },
      { label: "涉及门店", value: "12 家" },
      { label: "决策窗口", value: "12 小时" },
    ],
    options: [
      {
        id: "close-audit",
        title: "暂停涉事门店并自查",
        description: "暂停 12 家涉事门店营业，封存相关批次并完成内部排查。",
        cost: "12 万",
        cycle: "24 小时",
        signal: "相关批次标签记录不完整",
      },
      {
        id: "third-party-test",
        title: "委托第三方全链路检测",
        description: "委托独立机构检查原料、冷链和门店操作环节。",
        cost: "28 万",
        cycle: "5 天",
        signal: "内部初检未覆盖冷链环节",
      },
      {
        id: "public-update",
        title: "公开说明并滚动通报",
        description: "说明已知事实、当前行动和下一次信息更新时间。",
        cost: "8 万",
        cycle: "6 小时",
        signal: "官方账号已经沉默 18 小时",
      },
      {
        id: "refund",
        title: "启动全量退款补偿",
        description: "向相关批次订单用户退款并发放补偿券。",
        cost: "55 万",
        cycle: "48 小时",
        signal: "相关订单约 3.1 万单",
      },
      {
        id: "replace-supplier",
        title: "启动供应商追责与替换",
        description: "暂停问题供应商，寻找替代原料并启动合同追责。",
        cost: "35 万",
        cycle: "3 周",
        signal: "问题批次集中于 1 家供应商",
      },
    ],
    referenceCriteria: [
      { label: "消费者安全", keywords: ["安全", "消费者", "用户", "健康"] },
      { label: "响应速度", keywords: ["速度", "时间", "及时", "窗口", "小时"] },
      { label: "信息透明", keywords: ["透明", "公开", "沟通", "舆情", "信任"] },
      { label: "资源成本", keywords: ["成本", "预算", "资源", "经营"] },
      { label: "长期治理", keywords: ["长期", "供应链", "复发", "追责", "治理"] },
    ],
    optionAliases: {
      "close-audit": ["暂停涉事门店并自查", "暂停门店", "门店自查", "封存批次"],
      "third-party-test": ["委托第三方全链路检测", "第三方检测", "独立检测", "全链路检测"],
      "public-update": ["公开说明并滚动通报", "公开说明", "滚动通报", "对外回应"],
      refund: ["启动全量退款补偿", "退款补偿", "全量退款", "补偿券"],
      "replace-supplier": ["启动供应商追责与替换", "供应商追责", "替换供应商", "暂停供应商"],
    },
    participantStances: {
      cheng: "暂停门店 + 公开通报",
      lin: "退款补偿 + 公开通报",
      zhou: "第三方检测 + 供应商追责",
    },
    openingMessages: [
      {
        speaker: "cheng",
        content:
          "先暂停 12 家涉事门店，同时在 6 小时内公开说明。现在最重要的是立即止损，不能继续沉默。",
      },
      {
        speaker: "lin",
        content:
          "只停店可能不足以恢复信任。相关用户已经担心健康风险，我倾向公开说明并同步启动退款补偿。",
      },
      {
        speaker: "zhou",
        content:
          "我们不能在原因未明时直接定性。第三方检测能补齐证据，但它需要 5 天，如何满足 12 小时对外行动的限制？",
      },
    ],
    quickActions: [
      "我们先按消费者安全、响应速度、信息透明和预算约束统一标准。",
      "可以先做不依赖调查结论的公开行动，同时保留第三方验证。",
      "时间有限，我们先锁定 12 小时内必须执行的一项行动。",
    ],
    fallbackFinalists: ["公开说明并滚动通报", "暂停涉事门店并自查"],
  },
  {
    id: "ai-study-beta",
    category: "产品策划",
    caseNumber: "CASE 03",
    accent: "#0f9f88",
    title: "大学生 AI 学习助手首版规划",
    company: "知行智能 · 产品经理群面",
    brief:
      "知行智能准备面向大学生推出 AI 学习助手。团队只有一个开发小组，需要在 8 周内做出可验证的首版产品，并为下一轮融资证明真实学习价值。",
    goal: "从 5 个功能中选择 2 个进入首版，说明目标用户、价值链路、验证指标和最需要控制的风险。",
    timeLimit: 9 * 60,
    selectionCount: 2,
    initialConsensus: 25,
    initialConflict: "优先做高频刚需，还是打造更强的产品差异化？",
    constraints: [
      "首版研发预算不超过 45 万元",
      "8 周内至少交付一个完整价值闭环",
      "必须包含可验证学习效果的设计",
    ],
    facts: [
      { label: "研发预算", value: "45 万元" },
      { label: "交付周期", value: "8 周" },
      { label: "核心目标", value: "验证学习价值" },
    ],
    options: [
      {
        id: "knowledge-map",
        title: "错题诊断与知识图谱",
        description: "识别薄弱知识点，把错题整理为可回顾的个人知识图谱。",
        cost: "24 万",
        cycle: "7 周",
        signal: "68% 受访者不会系统整理错题",
      },
      {
        id: "study-plan",
        title: "个性化学习计划",
        description: "根据课程、考试日期和可用时间生成每周学习计划。",
        cost: "18 万",
        cycle: "5 周",
        signal: "现有试用者周计划完成率仅 22%",
      },
      {
        id: "ai-explain",
        title: "AI 题目讲解",
        description: "针对题目分步骤讲解，并允许用户追问关键推理。",
        cost: "30 万",
        cycle: "8 周",
        signal: "需求呼声最高，但内容审核成本高",
      },
      {
        id: "study-room",
        title: "同伴自习室",
        description: "提供组队打卡、专注计时和阶段复盘。",
        cost: "12 万",
        cycle: "4 周",
        signal: "小规模社群留存高，但活跃波动明显",
      },
      {
        id: "teacher-report",
        title: "教师学习报告",
        description: "向合作院校输出班级学习进度和共性薄弱点。",
        cost: "20 万",
        cycle: "6 周",
        signal: "院校有付费意愿，但学生担心数据隐私",
      },
    ],
    referenceCriteria: [
      { label: "用户刚需", keywords: ["用户", "刚需", "高频", "需求", "学生"] },
      { label: "学习效果", keywords: ["效果", "学习", "提升", "验证", "指标"] },
      { label: "实施确定性", keywords: ["时间", "周期", "开发", "上线", "交付"] },
      { label: "投入产出比", keywords: ["成本", "预算", "投入", "收益"] },
      { label: "产品风险", keywords: ["风险", "审核", "隐私", "准确"] },
    ],
    optionAliases: {
      "knowledge-map": ["错题诊断与知识图谱", "错题诊断", "知识图谱", "错题整理"],
      "study-plan": ["个性化学习计划", "学习计划", "每周计划"],
      "ai-explain": ["AI 题目讲解", "AI讲解", "题目讲解", "分步讲解"],
      "study-room": ["同伴自习室", "自习室", "组队打卡"],
      "teacher-report": ["教师学习报告", "教师报告", "班级报告"],
    },
    participantStances: {
      cheng: "学习计划 + 同伴自习室",
      lin: "AI 讲解 + 错题诊断",
      zhou: "错题诊断 + 教师报告",
    },
    openingMessages: [
      {
        speaker: "cheng",
        content:
          "首版要尽快跑通闭环，我建议个性化学习计划配合同伴自习室，两项合计 30 万，5 周内就能上线。",
      },
      {
        speaker: "lin",
        content:
          "但学生最直接的需求是遇到题目时获得有效帮助。没有 AI 讲解，产品可能很难体现真正的学习价值。",
      },
      {
        speaker: "zhou",
        content:
          "我们需要先定义什么叫学习价值。是使用频率、计划完成率，还是薄弱知识点改善？不同指标会导向完全不同的功能组合。",
      },
    ],
    quickActions: [
      "我们先按用户刚需、学习效果、研发成本和交付确定性统一标准。",
      "我想兼顾快速上线和学习价值，先形成闭环，再验证高成本能力。",
      "时间过半了，我们先明确首版必须验证的一个核心指标。",
    ],
    fallbackFinalists: ["个性化学习计划", "错题诊断与知识图谱"],
  },
];

export const participants: Participant[] = [
  {
    id: "user",
    name: "你",
    initials: "YOU",
    role: "候选人 01",
    style: "等待你定义角色",
    accent: "#5b7cfa",
    softAccent: "#eef2ff",
    stance: "尚未表态",
  },
  {
    id: "cheng",
    name: "程野",
    initials: "CY",
    role: "候选人 02",
    style: "结果推进型",
    accent: "#f9735b",
    softAccent: "#fff1ed",
    stance: scenarios[0].participantStances.cheng,
  },
  {
    id: "lin",
    name: "林乔",
    initials: "LQ",
    role: "候选人 03",
    style: "用户共情型",
    accent: "#12a594",
    softAccent: "#e9faf7",
    stance: scenarios[0].participantStances.lin,
  },
  {
    id: "zhou",
    name: "周可",
    initials: "ZK",
    role: "候选人 04",
    style: "数据质疑型",
    accent: "#a66bf0",
    softAccent: "#f6efff",
    stance: scenarios[0].participantStances.zhou,
  },
];

export const scenario = scenarios[0];
export const openingMessages = scenario.openingMessages;

export function getScenario(id: ScenarioId | string | undefined): Scenario {
  return scenarios.find((item) => item.id === id) ?? scenarios[0];
}

export function getDifficulty(
  id: TrainingDifficulty | string | undefined,
): DifficultyProfile {
  return difficultyProfiles.find((item) => item.id === id) ?? difficultyProfiles[1];
}

export function getParticipantsForScenario(
  scenarioOrId: Scenario | ScenarioId,
): Participant[] {
  const selectedScenario =
    typeof scenarioOrId === "string" ? getScenario(scenarioOrId) : scenarioOrId;
  return participants.map((participant) => {
    if (participant.id === "user") return participant;
    return {
      ...participant,
      stance: selectedScenario.participantStances[participant.id],
    };
  });
}
