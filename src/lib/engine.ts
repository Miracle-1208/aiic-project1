import { openingMessages, scenario } from "./scenario";
import type {
  AssessmentQuality,
  DirectorAssessment,
  DirectorReply,
  DirectorTurn,
  GroupState,
  InfluenceEvent,
  Intent,
  Message,
  ScoreKey,
  ScoreState,
  SpeakerId,
  TurnAssessment,
} from "./types";

const SCORE_MAX: ScoreState = {
  contribution: 25,
  progress: 25,
  listening: 20,
  conflict: 15,
  structure: 15,
};

const SCORE_DELTA: Record<Intent, Partial<ScoreState>> = {
  criteria: { contribution: 5, progress: 4, listening: 1, structure: 4 },
  proposal: { contribution: 4, progress: 3, structure: 2 },
  challenge: { contribution: 2, progress: 2, listening: 3, conflict: 4 },
  integrate: { contribution: 3, progress: 6, listening: 5, conflict: 4, structure: 2 },
  time: { progress: 5, listening: 1, conflict: 1, structure: 3 },
  summary: { contribution: 2, progress: 6, listening: 4, conflict: 2, structure: 5 },
  support: { contribution: 1, progress: 2, listening: 3, conflict: 1 },
  general: { contribution: 1, progress: 1 },
};

const CONSENSUS_DELTA: Record<Intent, number> = {
  criteria: 9,
  proposal: 6,
  challenge: 3,
  integrate: 15,
  time: 9,
  summary: 18,
  support: 5,
  general: 1,
};

function nowLabel() {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function message(
  speaker: SpeakerId,
  content: string,
  turn: number,
  intent?: Intent,
): Message {
  return {
    id: `${turn}-${speaker}-${content.slice(0, 8)}`,
    speaker,
    content,
    turn,
    intent,
    createdAt: nowLabel(),
  };
}

function influence(
  turn: number,
  title: string,
  detail: string,
  tone: InfluenceEvent["tone"] = "positive",
  evidence?: string,
  suggestion?: string,
  source?: InfluenceEvent["source"],
): InfluenceEvent {
  return {
    id: `event-${turn}-${title}`,
    turn,
    title,
    detail,
    tone,
    evidence,
    suggestion,
    source,
  };
}

function clampScores(current: ScoreState, delta: Partial<ScoreState>): ScoreState {
  return (Object.keys(current) as ScoreKey[]).reduce<ScoreState>(
    (next, key) => {
      next[key] = Math.min(SCORE_MAX[key], current[key] + (delta[key] ?? 0));
      return next;
    },
    { ...current },
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function completeScoreDelta(delta: Partial<ScoreState>): ScoreState {
  return {
    contribution: delta.contribution ?? 0,
    progress: delta.progress ?? 0,
    listening: delta.listening ?? 0,
    conflict: delta.conflict ?? 0,
    structure: delta.structure ?? 0,
  };
}

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

export function classifyIntent(rawText: string): Intent {
  const text = rawText.toLowerCase();

  if (includesAny(text, ["总结", "结论", "最终", "归纳", "代表小组"])) return "summary";
  if (includesAny(text, ["结合", "整合", "兼顾", "共同点", "折中", "吸收", "保留你的"])) {
    return "integrate";
  }
  if (includesAny(text, ["时间", "还剩", "推进", "收敛", "投票", "节奏"])) return "time";
  if (
    includesAny(text, [
      "标准",
      "维度",
      "优先级",
      "评价",
      "衡量",
      "目标是",
      "依据",
      "比较",
      "对比",
    ])
  ) {
    return "criteria";
  }
  if (includesAny(text, ["不同意", "反对", "但是", "风险", "问题是", "为什么", "质疑"])) {
    return "challenge";
  }
  if (
    includesAny(text, [
      "新用户引导",
      "岗位推荐",
      "学长咨询",
      "消息提醒",
      "企业开放日",
      "我建议",
      "我选择",
      "方案",
    ])
  ) {
    return "proposal";
  }
  if (includesAny(text, ["同意", "赞成", "支持", "认可", "有道理"])) return "support";
  return "general";
}

function extractCriteria(text: string): string[] {
  const criteria: string[] = [];
  if (includesAny(text, ["用户", "留存", "价值", "体验"])) criteria.push("用户影响");
  if (includesAny(text, ["成本", "预算", "投入", "收益"])) criteria.push("投入产出比");
  if (includesAny(text, ["时间", "周期", "上线", "落地"])) criteria.push("实施确定性");
  if (includesAny(text, ["长期", "持续", "未来"])) criteria.push("长期价值");
  return criteria.length ? criteria : ["用户价值 × 可落地性"];
}

function extractOptions(text: string): string[] {
  const aliases: Record<string, string[]> = {
    onboarding: ["优化新用户引导", "新用户引导", "新手引导", "注册流程"],
    recommendation: ["升级岗位推荐", "岗位推荐", "推荐策略"],
    mentor: ["上线学长咨询", "学长咨询", "学长服务"],
    notification: ["修复消息提醒", "消息提醒", "提醒故障", "安卓提醒"],
    "open-day": ["举办企业开放日", "企业开放日", "开放日", "直播宣讲"],
  };
  return scenario.options
    .filter((option) => aliases[option.id].some((alias) => text.includes(alias)))
    .map((option) => option.title);
}

function unique(items: string[]) {
  return [...new Set(items)];
}

function fallbackDirectorResponses(intent: Intent, turn: number, text: string): Message[] {
  const optionNames = extractOptions(text);
  const selected = optionNames.join("和") || "这两个方向";

  const responses: Record<Intent, Array<[SpeakerId, string]>> = {
    criteria: [
      [
        "zhou",
        "这个推进方式我认同。建议把标准压缩成三项：对留存的直接影响、投入产出比、6 周内的实施确定性，然后逐项比较。",
      ],
      [
        "lin",
        "可以，我补充一点：除了短期数据，也要看学生是否获得持续回来的理由，否则可能只是把流失往后推。",
      ],
    ],
    proposal: [
      [
        "cheng",
        `我支持把${selected}放进最终候选，但我们最好马上说明为什么暂时不选另外三个，避免结论像拍脑袋。`,
      ],
      [
        "zhou",
        "我先保留一半意见。方案本身可以，但需要用预算和上线周期验证；岗位推荐的 8 周周期尤其可能超出限制。",
      ],
    ],
    challenge: [
      [
        "lin",
        "这个风险提醒很关键。我愿意调整原来的立场，但希望最终方案里保留一个验证动作，确认我们没有忽略用户真正需要的长期帮助。",
      ],
      [
        "cheng",
        "我接受质疑。为了不让讨论停住，我们可以先锁定确定性最高的一个方案，再比较第二个名额。",
      ],
    ],
    integrate: [
      [
        "lin",
        "这个整合比简单投票更好：先修复明确故障，再用低成本实验验证长期需求。我可以接受不把学长咨询直接作为第一期。",
      ],
      [
        "zhou",
        "这样基本解决了我对证据不足的担忧。建议最终陈述里把‘快速修复 + 小步验证’说成一组策略，而不是两个孤立功能。",
      ],
    ],
    time: [
      [
        "cheng",
        "收到，我们开始收敛。我建议每个人只说一个必须保留的判断，然后由你把标准和结论串起来。",
      ],
      [
        "zhou",
        "我最后保留一个风险：不要为了赶时间跳过预算核算。除此之外，可以进入结论。",
      ],
    ],
    summary: [
      [
        "cheng",
        "这个总结已经把选择标准、方案和风险串起来了。我建议就按这个结构进入最终陈述。",
      ],
      ["lin", "我同意，尤其是保留后续用户验证这一点，能回应我们前面的主要分歧。"],
    ],
    support: [
      [
        "zhou",
        "支持可以，但我想请你再往前一步：你认可的是结论，还是对方采用的判断标准？把这一点说清楚会更有推动作用。",
      ],
    ],
    general: [
      [
        turn % 2 === 0 ? "lin" : "zhou",
        turn % 2 === 0
          ? "我理解你的方向。能不能再明确一下，这个判断主要解决短期留存，还是长期使用价值？"
          : "我还没看出它如何帮助我们在五个方案中做取舍。建议补一个标准或具体选择。",
      ],
    ],
  };

  const count = intent === "support" || intent === "general" ? 1 : turn % 3 === 0 ? 2 : 1;
  return responses[intent]
    .slice(0, count)
    .map(([speaker, content], index) => message(speaker, content, turn + index / 10, intent));
}

function directorResponses(
  intent: Intent,
  turn: number,
  text: string,
  replies?: DirectorReply[],
): Message[] {
  const validReplies = replies
    ?.filter(
      (reply) =>
        ["cheng", "lin", "zhou"].includes(reply.speaker) &&
        reply.content.trim().length > 0,
    )
    .slice(0, 2);

  if (!validReplies?.length) {
    return fallbackDirectorResponses(intent, turn, text);
  }

  return validReplies.map((reply, index) =>
    message(reply.speaker, reply.content.trim(), turn + index / 10, intent),
  );
}

const INTENT_FEEDBACK: Record<
  Intent,
  { title: string; detail: string; suggestion: string; quality: AssessmentQuality }
> = {
  criteria: {
    title: "建立共同标准",
    detail: "你把讨论从个人偏好拉回到一套可共同使用的判断尺度。",
    suggestion: "下一次把标准压缩为三项，并明确它们的优先顺序。",
    quality: "strong",
  },
  proposal: {
    title: "提出可比较方案",
    detail: "你给出了明确选择，帮助小组减少了仍需讨论的选项。",
    suggestion: "补充不选择其他方案的理由，让取舍更有说服力。",
    quality: "developing",
  },
  challenge: {
    title: "暴露方案风险",
    detail: "你没有直接附和，而是让团队处理一个尚未回答的问题。",
    suggestion: "质疑后紧接一个验证办法，避免团队停留在否定阶段。",
    quality: "developing",
  },
  integrate: {
    title: "整合对立意见",
    detail: "你保留了不同观点中的有效部分，共识出现明显提升。",
    suggestion: "进一步明确整合方案的先后顺序和验证节点。",
    quality: "strong",
  },
  time: {
    title: "接管讨论节奏",
    detail: "你提醒团队收敛，避免在截止前仍停留在发散状态。",
    suggestion: "时间提醒后立即给出下一步动作和负责人。",
    quality: "strong",
  },
  summary: {
    title: "形成阶段结论",
    detail: "你把零散观点整理成可以继续决策的结构。",
    suggestion: "总结时同时覆盖标准、选择、理由和风险。",
    quality: "strong",
  },
  support: {
    title: "回应他人观点",
    detail: "你表达了支持，但尚未清楚说明支持的理由和新增价值。",
    suggestion: "先复述对方的关键判断，再补充一个新的证据或取舍。",
    quality: "developing",
  },
  general: {
    title: "发言尚未形成增量",
    detail: "这次发言参与了讨论，但对方案或协作状态的改变较少。",
    suggestion: "下一句话至少补充一个判断标准、具体方案或推进动作。",
    quality: "weak",
  },
};

function fallbackAssessment(text: string, intent: Intent): DirectorAssessment {
  const feedback = INTENT_FEEDBACK[intent];
  return {
    intent,
    quality: feedback.quality,
    evidence: text.slice(0, 100),
    impactTitle: feedback.title,
    impactDetail: feedback.detail,
    suggestion: feedback.suggestion,
    criteriaAdded: intent === "criteria" ? extractCriteria(text) : [],
    finalistsAdded: extractOptions(text),
    unresolvedConflict: "",
    consensusDelta: CONSENSUS_DELTA[intent],
    scoreDeltas: completeScoreDelta(SCORE_DELTA[intent]),
  };
}

function fallbackFinalAssessment(statement: string): DirectorAssessment {
  const includesRisk = includesAny(statement, ["风险", "验证", "控制", "避免"]);
  return {
    intent: "summary",
    quality: includesRisk ? "strong" : "developing",
    evidence: statement.slice(0, 100),
    impactTitle: "完成小组陈述",
    impactDetail: includesRisk
      ? "你把选择标准、方案、理由和风险控制放进了同一叙事。"
      : "你交付了小组结论，但风险控制还可以表达得更明确。",
    suggestion: includesRisk
      ? "下一轮继续压缩表达，用一句话先交付结论。"
      : "在结尾补充一个主要风险和对应的验证动作。",
    criteriaAdded: extractCriteria(statement),
    finalistsAdded: extractOptions(statement),
    unresolvedConflict: "",
    consensusDelta: includesRisk ? 12 : 7,
    scoreDeltas: {
      contribution: 3,
      progress: 5,
      listening: 3,
      conflict: includesRisk ? 3 : 1,
      structure: includesRisk ? 6 : 4,
    },
  };
}

function materializeAssessment(
  text: string,
  turn: number,
  fallback: DirectorAssessment,
  supplied?: DirectorAssessment,
): TurnAssessment {
  const assessment = supplied ?? fallback;
  const allowedOptions = new Set(scenario.options.map((option) => option.title));
  const source = supplied ? "ai" : "fallback";
  const evidence = text.includes(assessment.evidence.trim())
    ? assessment.evidence.trim()
    : text.slice(0, 100);
  const proposedSuggestion = assessment.suggestion
    .trim()
    .replace(/^(?:下一步|建议)\s*[：:，,]?\s*/, "")
    .slice(0, 140);
  const suggestionNumbers = proposedSuggestion.match(
    /\d+(?:\.\d+)?(?:周|天|人|次|万|%|％)|[一二三四五六七八九十百]+(?:周|天|人|次|万)/g,
  );
  const suggestionIntroducesNumbers = suggestionNumbers?.some(
    (number) => !text.includes(number),
  );
  const strongConsensusFloor: Record<Intent, number> = {
    criteria: 5,
    proposal: 3,
    challenge: 0,
    integrate: 8,
    time: 5,
    summary: 8,
    support: 2,
    general: 0,
  };
  const consensusFloor = assessment.quality === "strong" ? strongConsensusFloor[assessment.intent] : -4;
  const scoreDeltas = (Object.keys(fallback.scoreDeltas) as ScoreKey[]).reduce<ScoreState>(
    (next, key) => {
      next[key] = clamp(Number(assessment.scoreDeltas[key]) || 0, 0, 6);
      return next;
    },
    { ...fallback.scoreDeltas },
  );

  return {
    ...assessment,
    id: `assessment-${turn}-${source}`,
    turn,
    source,
    evidence,
    impactTitle: assessment.impactTitle.trim().slice(0, 30) || fallback.impactTitle,
    impactDetail: assessment.impactDetail.trim().slice(0, 140) || fallback.impactDetail,
    suggestion:
      !proposedSuggestion || suggestionIntroducesNumbers
        ? fallback.suggestion
        : proposedSuggestion,
    criteriaAdded: unique(assessment.criteriaAdded.map((item) => item.trim()).filter(Boolean)).slice(
      0,
      4,
    ),
    finalistsAdded: unique(
      assessment.finalistsAdded.map((item) => item.trim()).filter((item) => allowedOptions.has(item)),
    ).slice(0, 3),
    unresolvedConflict: assessment.unresolvedConflict.trim().slice(0, 120),
    consensusDelta: clamp(
      Math.max(Number(assessment.consensusDelta) || 0, consensusFloor),
      -4,
      18,
    ),
    scoreDeltas,
  };
}

function eventFromAssessment(assessment: TurnAssessment): InfluenceEvent {
  const tone: InfluenceEvent["tone"] =
    assessment.quality === "strong"
      ? "positive"
      : assessment.quality === "weak"
        ? "warning"
        : "neutral";
  return influence(
    assessment.turn,
    assessment.impactTitle,
    assessment.impactDetail,
    tone,
    assessment.evidence,
    assessment.suggestion,
    assessment.source,
  );
}

export function createInitialState(): GroupState {
  return {
    turn: 0,
    timeLeft: 8 * 60,
    consensus: 28,
    criteria: [],
    finalists: [],
    conflict: "短期修复，还是长期用户价值？",
    messages: openingMessages.map((item, index) =>
      message(item.speaker, item.content, 0 + index / 10),
    ),
    influence: [],
    assessments: [],
    scores: {
      contribution: 5,
      progress: 4,
      listening: 3,
      conflict: 2,
      structure: 3,
    },
    finalStatement: "",
  };
}

export function applyUserTurn(
  state: GroupState,
  rawText: string,
  directorTurn?: DirectorTurn,
): GroupState {
  const text = rawText.trim();
  if (!text) return state;

  const turn = state.turn + 1;
  const fallback = fallbackAssessment(text, classifyIntent(text));
  const assessment = materializeAssessment(text, turn, fallback, directorTurn?.assessment);
  const intent = assessment.intent;
  const userMessage = message("user", text, turn, intent);
  const aiMessages = directorResponses(intent, turn, text, directorTurn?.replies);
  const inferredCriteria = intent === "criteria" ? extractCriteria(text) : [];
  const criteria = unique([
    ...state.criteria,
    ...inferredCriteria,
    ...assessment.criteriaAdded,
  ]).slice(-8);
  const proposedOptions = unique([...extractOptions(text), ...assessment.finalistsAdded]);
  const finalists =
    proposedOptions.length > 0
      ? unique([...state.finalists, ...proposedOptions]).slice(-3)
      : intent === "integrate" && state.finalists.length === 0
        ? ["修复消息提醒", "优化新用户引导"]
        : state.finalists;

  const conflict = assessment.unresolvedConflict
    ? assessment.unresolvedConflict
    : intent === "integrate" || intent === "summary"
      ? "如何同时兼顾快速修复与长期验证？"
      : intent === "challenge"
        ? "新提出的风险是否会改变当前选择？"
        : state.conflict;

  return {
    ...state,
    turn,
    consensus: clamp(state.consensus + assessment.consensusDelta, 8, 94),
    criteria,
    finalists,
    conflict,
    messages: [...state.messages, userMessage, ...aiMessages],
    influence: [...state.influence, eventFromAssessment(assessment)],
    assessments: [...(state.assessments ?? []), assessment],
    scores: clampScores(state.scores, assessment.scoreDeltas),
  };
}

export function finishSession(
  state: GroupState,
  rawStatement: string,
  directorTurn?: DirectorTurn,
): GroupState {
  const statement = rawStatement.trim();
  if (!statement) return state;

  const turn = state.turn + 1;
  const assessment = materializeAssessment(
    statement,
    turn,
    fallbackFinalAssessment(statement),
    directorTurn?.assessment,
  );

  const finalOptions = unique([
    ...state.finalists,
    ...extractOptions(statement),
    ...assessment.finalistsAdded,
  ]);

  return {
    ...state,
    turn,
    consensus: clamp(state.consensus + Math.max(0, assessment.consensusDelta), 8, 96),
    finalStatement: statement,
    criteria: unique([...state.criteria, ...assessment.criteriaAdded]).slice(-8),
    finalists:
      finalOptions.length >= 2
        ? finalOptions.slice(0, 2)
        : unique([...finalOptions, "修复消息提醒", "优化新用户引导"]).slice(0, 2),
    messages: [
      ...state.messages,
      message("user", statement, turn, assessment.intent),
      message(
        "system",
        "群面结束。系统正在把你的发言与团队状态变化对应起来。",
        turn + 0.1,
      ),
    ],
    influence: [...state.influence, eventFromAssessment(assessment)],
    assessments: [...(state.assessments ?? []), assessment],
    scores: clampScores(state.scores, assessment.scoreDeltas),
  };
}

export function tick(state: GroupState): GroupState {
  return state.timeLeft <= 0 ? state : { ...state, timeLeft: state.timeLeft - 1 };
}

export function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const rest = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}
