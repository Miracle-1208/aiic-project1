import { openingMessages, scenario } from "./scenario";
import type {
  DirectorReply,
  GroupState,
  InfluenceEvent,
  Intent,
  Message,
  ScoreKey,
  ScoreState,
  SpeakerId,
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
): InfluenceEvent {
  return {
    id: `event-${turn}-${title}`,
    turn,
    title,
    detail,
    tone,
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

function eventForIntent(intent: Intent, turn: number): InfluenceEvent {
  const events: Record<Intent, [string, string, InfluenceEvent["tone"]]> = {
    criteria: ["建立共同标准", "你把讨论从个人偏好拉回到一套可共同使用的判断尺度。", "positive"],
    proposal: ["提出可比较方案", "你给出了明确选择，帮助小组减少了仍需讨论的选项。", "positive"],
    challenge: ["暴露方案风险", "你没有直接附和，而是让团队处理一个尚未回答的问题。", "neutral"],
    integrate: ["整合对立意见", "你保留了不同观点中的有效部分，共识出现明显提升。", "positive"],
    time: ["接管讨论节奏", "你提醒团队收敛，避免在截止前仍停留在发散状态。", "positive"],
    summary: ["形成阶段结论", "你把零散观点整理成可以继续决策的结构。", "positive"],
    support: ["回应他人观点", "你表达了支持，但还可以进一步说明支持的理由和增量。", "neutral"],
    general: ["发言尚未形成增量", "这次发言参与了讨论，但对方案或协作状态的改变较少。", "warning"],
  };
  const [title, detail, tone] = events[intent];
  return influence(turn, title, detail, tone);
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
  directorReplies?: DirectorReply[],
): GroupState {
  const text = rawText.trim();
  if (!text) return state;

  const turn = state.turn + 1;
  const intent = classifyIntent(text);
  const userMessage = message("user", text, turn, intent);
  const aiMessages = directorResponses(intent, turn, text, directorReplies);
  const criteria = intent === "criteria" ? unique([...state.criteria, ...extractCriteria(text)]) : state.criteria;
  const proposedOptions = extractOptions(text);
  const finalists =
    proposedOptions.length > 0
      ? unique([...state.finalists, ...proposedOptions]).slice(-3)
      : intent === "integrate" && state.finalists.length === 0
        ? ["修复消息提醒", "优化新用户引导"]
        : state.finalists;

  const conflict =
    intent === "integrate" || intent === "summary"
      ? "如何同时兼顾快速修复与长期验证？"
      : intent === "challenge"
        ? "新提出的风险是否会改变当前选择？"
        : state.conflict;

  return {
    ...state,
    turn,
    consensus: Math.min(94, state.consensus + CONSENSUS_DELTA[intent]),
    criteria,
    finalists,
    conflict,
    messages: [...state.messages, userMessage, ...aiMessages],
    influence: [...state.influence, eventForIntent(intent, turn)],
    scores: clampScores(state.scores, SCORE_DELTA[intent]),
  };
}

export function finishSession(state: GroupState, rawStatement: string): GroupState {
  const statement = rawStatement.trim();
  if (!statement) return state;

  const turn = state.turn + 1;
  const finishDelta: Partial<ScoreState> = {
    contribution: 3,
    progress: 5,
    listening: 3,
    conflict: 2,
    structure: 6,
  };

  const finalOptions = unique([...state.finalists, ...extractOptions(statement)]);

  return {
    ...state,
    turn,
    consensus: Math.max(86, state.consensus),
    finalStatement: statement,
    finalists:
      finalOptions.length >= 2
        ? finalOptions.slice(0, 2)
        : unique([...finalOptions, "修复消息提醒", "优化新用户引导"]).slice(0, 2),
    messages: [
      ...state.messages,
      message("user", statement, turn, "summary"),
      message(
        "system",
        "群面结束。系统正在把你的发言与团队状态变化对应起来。",
        turn + 0.1,
      ),
    ],
    influence: [
      ...state.influence,
      influence(
        turn,
        "完成小组陈述",
        "你代表小组交付了结论，并将选择标准、方案与风险放进同一叙事。",
      ),
    ],
    scores: clampScores(state.scores, finishDelta),
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
