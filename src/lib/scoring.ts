import type { DimensionReport, GroupState, ScoreKey, SessionReport } from "./types";

const META: Record<ScoreKey, { label: string; max: number; summary: string }> = {
  contribution: {
    label: "有效贡献",
    max: 25,
    summary: "是否带来新标准、新信息或明确方案",
  },
  progress: {
    label: "推动进展",
    max: 25,
    summary: "是否帮助团队从发散走向可交付结论",
  },
  listening: {
    label: "倾听整合",
    max: 20,
    summary: "是否回应并吸收他人的有效观点",
  },
  conflict: {
    label: "冲突处理",
    max: 15,
    summary: "是否让分歧产生信息，而不是变成人际对抗",
  },
  structure: {
    label: "结构节奏",
    max: 15,
    summary: "是否建立标准、控制时间并清楚总结",
  },
};

export function buildReport(state: GroupState): SessionReport {
  const keys = Object.keys(META) as ScoreKey[];
  const dimensions: DimensionReport[] = keys.map((key) => ({
    key,
    label: META[key].label,
    score: state.scores[key],
    max: META[key].max,
    summary: META[key].summary,
  }));
  const total = dimensions.reduce((sum, item) => sum + item.score, 0);
  const ranked = [...dimensions].sort(
    (a, b) => b.score / b.max - a.score / a.max,
  );
  const strengthDimension = ranked[0];
  const focusDimension = ranked[ranked.length - 1];
  const bestEvent = [...state.influence]
    .reverse()
    .find((event) => event.tone === "positive");

  return {
    total,
    level: total >= 85 ? "团队催化者" : total >= 70 ? "可靠推进者" : "积极参与者",
    dimensions,
    strength: `你的“${strengthDimension.label}”最突出。${strengthDimension.summary}。`,
    focus: `下一轮只练一个动作：在发言前先复述一条他人观点，再补充你的增量，以提升“${focusDimension.label}”。`,
    evidence:
      bestEvent?.detail ?? "你已经参与讨论；下一轮需要让每次发言都对应一次可观察的团队状态变化。",
  };
}
