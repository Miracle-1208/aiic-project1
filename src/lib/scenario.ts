import type { Participant, Scenario } from "./types";

export const scenario: Scenario = {
  id: "campus-career-retention",
  title: "大学生求职 App 留存提升方案",
  company: "星桥科技 · 产品管培生群面",
  brief:
    "星桥是一款面向大学生的求职 App。过去三个月，新用户次日留存从 42% 下降到 29%。团队希望在秋招高峰前完成一次关键改进。",
  goal: "在 8 分钟内从 5 个方案中选择 2 个，形成统一建议并说明选择标准、核心理由和主要风险。",
  constraints: ["总预算不超过 50 万元", "6 周内至少上线一个方案", "最终必须由一名成员代表小组陈述"],
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
};

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
    stance: "修复提醒 + 新手引导",
  },
  {
    id: "lin",
    name: "林乔",
    initials: "LQ",
    role: "候选人 03",
    style: "用户共情型",
    accent: "#12a594",
    softAccent: "#e9faf7",
    stance: "学长咨询 + 企业开放日",
  },
  {
    id: "zhou",
    name: "周可",
    initials: "ZK",
    role: "候选人 04",
    style: "数据质疑型",
    accent: "#a66bf0",
    softAccent: "#f6efff",
    stance: "岗位推荐 + 消息提醒",
  },
];

export const openingMessages = [
  {
    speaker: "cheng" as const,
    content:
      "我先抛个结论：优先修复消息提醒，再优化新用户引导。两个方案一共 26 万，6 周内都能上线，也能直接处理眼前的留存问题。",
  },
  {
    speaker: "lin" as const,
    content:
      "我想先保留不同意见。访谈里学生最想要学长咨询，或许留存下降的根因不是流程，而是缺少持续获得帮助的理由。",
  },
  {
    speaker: "zhou" as const,
    content:
      "我们还没有统一评价标准。是看短期留存提升、长期用户价值，还是实施确定性？如果标准不清楚，现在投票会比较早。",
  },
];
