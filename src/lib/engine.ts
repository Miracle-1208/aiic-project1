import { getDifficulty, getScenario } from "./scenario";
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
  Scenario,
  ScenarioId,
  SpeakerId,
  TrainingDifficulty,
  TurnSnapshot,
  TurnAssessment,
  VoiceCapture,
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
  support: 0,
  general: 0,
};

type IntentContext = Pick<
  GroupState,
  "conflict" | "criteria" | "finalists" | "messages"
>;

type CandidateSpeaker = Extract<SpeakerId, "cheng" | "lin" | "zhou">;

type CandidateStance = {
  speaker: CandidateSpeaker;
  speakerName: string;
  content: string;
  quote: string;
};

const CANDIDATE_NAMES: Record<CandidateSpeaker, string> = {
  cheng: "程野",
  lin: "林乔",
  zhou: "周可",
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
  consensusDelta?: number,
  noProgressReason?: string,
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
    consensusDelta,
    noProgressReason,
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

function normalizeForMatch(text: string) {
  return text.toLowerCase().replace(/\s+/g, "");
}

function includesNormalized(text: string, fragment: string) {
  const normalizedFragment = normalizeForMatch(fragment);
  return (
    normalizedFragment.length > 0 &&
    normalizeForMatch(text).includes(normalizedFragment)
  );
}

function extractCriteria(text: string, selectedScenario: Scenario): string[] {
  return selectedScenario.referenceCriteria
    .filter((criterion) =>
      criterion.keywords.some((keyword) => includesNormalized(text, keyword)),
    )
    .map((criterion) => criterion.label);
}

function extractOptions(text: string, selectedScenario: Scenario): string[] {
  return selectedScenario.options
    .filter((option) =>
      (selectedScenario.optionAliases[option.id] ?? [option.title]).some((alias) =>
        includesNormalized(text, alias),
      ),
    )
    .map((option) => option.title);
}

function matchedCaseTerms(text: string, selectedScenario: Scenario) {
  const terms = [
    ...selectedScenario.referenceCriteria.flatMap((criterion) =>
      criterion.keywords,
    ),
    ...Object.values(selectedScenario.optionAliases).flat(),
  ];
  return new Set(
    terms
      .filter((term) => includesNormalized(text, term))
      .map(normalizeForMatch),
  );
}

function distinctCaseEntityCount(text: string, selectedScenario: Scenario) {
  return new Set([
    ...extractCriteria(text, selectedScenario).map((item) => `criterion:${item}`),
    ...extractOptions(text, selectedScenario).map((item) => `option:${item}`),
  ]).size;
}

function isCandidateSpeaker(speaker: SpeakerId): speaker is CandidateSpeaker {
  return speaker === "cheng" || speaker === "lin" || speaker === "zhou";
}

function recentCandidateMessages(
  selectedScenario: Scenario,
  context: IntentContext | undefined,
  limit: number,
) {
  const source = context?.messages.length
    ? context.messages
    : selectedScenario.openingMessages;
  const candidates = source
    .filter((item) => isCandidateSpeaker(item.speaker))
    .map((item) => ({
      speaker: item.speaker as CandidateSpeaker,
      content: item.content,
      turn: "turn" in item ? item.turn : 0,
    }));
  const latestTurn = Math.floor(candidates.at(-1)?.turn ?? 0);
  return candidates
    .filter((item) => Math.floor(item.turn) === latestTurn)
    .slice(-limit);
}

function conflictPhrases(conflict: string) {
  return conflict
    .split(/[，,。！？!?；;、]|还是|或者|或是|\bvs\b/gi)
    .map((item) => item.trim().replace(/^(?:如何|是否|怎样|怎么)/, ""))
    .filter((item) => normalizeForMatch(item).length >= 4);
}

function mentionsConflict(text: string, conflict: string) {
  return conflictPhrases(conflict).some((phrase) => includesNormalized(text, phrase));
}

function sharesConflictPhrase(text: string, other: string, conflict: string) {
  return conflictPhrases(conflict).some(
    (phrase) =>
      includesNormalized(text, phrase) && includesNormalized(other, phrase),
  );
}

function candidatePositionCount(text: string, selectedScenario: Scenario) {
  const participantNames = [
    ["cheng", "程野"],
    ["lin", "林乔"],
    ["zhou", "周可"],
  ] as const;
  const entityTerms = [
    ...selectedScenario.referenceCriteria.flatMap((criterion) => criterion.keywords),
    ...Object.values(selectedScenario.optionAliases).flat(),
  ]
    .map(normalizeForMatch)
    .filter((term) => term.length >= 2);
  const normalizedText = normalizeForMatch(text);

  return participantNames.filter(([, name]) => {
    const nameIndex = normalizedText.indexOf(name);
    if (nameIndex < 0) return false;
    const window = normalizedText.slice(
      Math.max(0, nameIndex - 12),
      nameIndex + name.length + 18,
    );
    return entityTerms.some((term) => window.includes(term));
  }).length;
}

function hasVerifiableRisk(
  text: string,
  selectedScenario: Scenario,
  context?: IntentContext,
) {
  const recentCandidate = recentCandidateMessages(
    selectedScenario,
    context,
    1,
  )[0];
  return (
    mentionsConflict(text, context?.conflict ?? selectedScenario.initialConflict) ||
    Boolean(recentCandidate && anchorEvidence(text, recentCandidate.content)) ||
    distinctCaseEntityCount(text, selectedScenario) >= 2
  );
}

function intentSignals(
  rawText: string,
  selectedScenario: Scenario,
  context?: IntentContext,
) {
  const text = rawText.toLowerCase();
  const options = extractOptions(text, selectedScenario);
  const criteria = extractCriteria(text, selectedScenario);
  const conflict = context?.conflict ?? selectedScenario.initialConflict;
  const conflictMentioned = mentionsConflict(text, conflict);
  const positionCount = candidatePositionCount(text, selectedScenario);
  const hasCaseEntity =
    options.length > 0 ||
    criteria.length > 0 ||
    conflictMentioned ||
    positionCount > 0;
  const summaryAction = includesAny(text, [
    "总结",
    "结论",
    "最终",
    "归纳",
    "代表小组",
  ]);
  const integrationAction = includesAny(text, [
    "结合",
    "整合",
    "兼顾",
    "共同点",
    "折中",
    "吸收",
    "保留你的",
  ]) || /先.+再/.test(text);
  const timeAction = includesAny(text, [
    "时间",
    "还剩",
    "推进",
    "收敛",
    "投票",
    "节奏",
  ]);
  const criteriaAction = includesAny(text, [
    "标准",
    "维度",
    "优先级",
    "评价",
    "衡量",
    "目标是",
    "依据",
    "比较",
    "对比",
  ]);
  const challengeAction = includesAny(text, [
    "不同意",
    "反对",
    "但是",
    "风险",
    "问题是",
    "为什么",
    "质疑",
    "疑问",
  ]);
  const proposalAction = includesAny(text, [
    "我建议",
    "建议",
    "我选择",
    "选择",
    "优先",
    "方案",
    "先做",
  ]);
  const supportAction = includesAny(text, ["同意", "赞成", "支持", "认可", "有道理"]);

  return {
    criteria,
    options,
    summary: summaryAction && (options.length > 0 || criteria.length > 0),
    integrate:
      integrationAction &&
      (options.length >= 2 || positionCount >= 2 || conflictMentioned),
    time:
      timeAction &&
      (options.length > 0 ||
        criteria.some((item) => item !== "实施确定性") ||
        conflictMentioned ||
        positionCount > 0 ||
        includesAny(text, ["周期", "上线", "落地", "交付"])),
    criteriaIntent: criteriaAction && criteria.length > 0,
    challenge:
      challengeAction && hasVerifiableRisk(text, selectedScenario, context),
    proposal: proposalAction && options.length > 0,
    support: supportAction && !challengeAction && hasCaseEntity,
  };
}

export function classifyIntent(
  rawText: string,
  scenarioOrId: Scenario | ScenarioId = "campus-career-retention",
  context?: IntentContext,
): Intent {
  const selectedScenario =
    typeof scenarioOrId === "string" ? getScenario(scenarioOrId) : scenarioOrId;
  const signals = intentSignals(rawText, selectedScenario, context);

  if (signals.summary) return "summary";
  if (signals.integrate) return "integrate";
  if (signals.time) return "time";
  if (signals.criteriaIntent) return "criteria";
  if (signals.challenge) return "challenge";
  if (signals.proposal) return "proposal";
  if (signals.support) return "support";
  return "general";
}

function unique(items: string[]) {
  return [...new Set(items)];
}

function fallbackDirectorResponses(
  intent: Intent,
  turn: number,
  text: string,
  selectedScenario: Scenario,
  difficulty: TrainingDifficulty,
): Message[] {
  const optionNames = extractOptions(text, selectedScenario);
  const selected = optionNames.join("和") || "这两个方向";
  const coreCriteria = selectedScenario.referenceCriteria
    .slice(0, 3)
    .map((criterion) => criterion.label)
    .join("、");
  const keyConstraint = selectedScenario.constraints[0];

  const responses: Record<Intent, Array<[SpeakerId, string]>> = {
    criteria: [
      [
        "zhou",
        `这个推进方式可以。建议把标准压缩为${coreCriteria}，然后让每个方案都接受同一套比较。`,
      ],
      [
        "lin",
        "我同意统一标准，但希望保留对长期影响和受影响用户的考虑，不要只看最容易量化的指标。",
      ],
    ],
    proposal: [
      [
        "cheng",
        `我支持把${selected}放进最终候选，但我们最好马上说明为什么暂时不选另外三个，避免结论像拍脑袋。`,
      ],
      [
        "zhou",
        `我先保留一半意见。方案可以，但必须逐项对照限制条件，尤其是“${keyConstraint}”，不能只看方向是否吸引人。`,
      ],
    ],
    challenge: [
      [
        "lin",
        "这个风险提醒很关键。我愿意调整原来的立场，但希望最终方案里保留一个验证动作，确认我们没有忽略真正的受影响对象。",
      ],
      [
        "cheng",
        "我接受质疑。为了不让讨论停住，我们可以先锁定确定性最高的一个方案，再比较第二个名额。",
      ],
    ],
    integrate: [
      [
        "lin",
        "这个整合比简单投票更好：先处理确定性高的问题，再用验证动作保留另一种观点的价值。",
      ],
      [
        "zhou",
        "这样基本解决了我对证据不足的担忧。建议再说清先后顺序、验证节点和什么情况下需要调整。",
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

  const count =
    difficulty === "pressure"
      ? 2
      : difficulty === "guided" || intent === "support" || intent === "general"
        ? 1
        : turn % 3 === 0
          ? 2
          : 1;
  return responses[intent]
    .slice(0, count)
    .map(([speaker, content], index) => message(speaker, content, turn + index / 10, intent));
}

function pressureBlockedResponses(
  intent: Intent,
  turn: number,
  conflict: string,
  pressureStance?: CandidateStance,
): Message[] {
  const primarySpeaker = pressureStance?.speaker ?? "zhou";
  const secondarySpeaker: CandidateSpeaker =
    primarySpeaker === "cheng" ? "zhou" : "cheng";
  const pressureQuote = pressureStance?.quote
    .replace(/^(?:(?:这个|方案|标准|方向|做法)?可以|我同意(?:统一标准)?)[，,、；;：:]?(?:但|但是)?/, "")
    .trim();
  const primaryContent = pressureStance
    ? `我刚才的反对还没有被回应：“${pressureQuote || pressureStance.quote}”。请先直接处理这条分歧。`
    : `这轮还没有处理当前分歧：“${conflict}”。请先明确回应其中一边的具体主张。`;
  const secondaryContent = pressureStance
    ? `先不要把这轮发言当作已经完成推进。请先回应${pressureStance.speakerName}的这条反对，再谈方案收敛。`
    : `现在还不能进入收敛。请先说明你如何处理当前未解冲突，再提出下一步。`;

  return [
    message(primarySpeaker, primaryContent, turn, intent),
    message(secondarySpeaker, secondaryContent, turn + 0.1, intent),
  ];
}

function directorResponses(
  intent: Intent,
  turn: number,
  text: string,
  selectedScenario: Scenario,
  difficulty: TrainingDifficulty,
  replies?: DirectorReply[],
  pressureBlock?: {
    conflict: string;
    stance?: CandidateStance;
  },
): Message[] {
  const validReplies = replies
    ?.filter(
      (reply) =>
        ["cheng", "lin", "zhou"].includes(reply.speaker) &&
        reply.content.trim().length > 0,
    )
    .slice(0, 2);

  if (!validReplies?.length) {
    if (pressureBlock) {
      return pressureBlockedResponses(
        intent,
        turn,
        pressureBlock.conflict,
        pressureBlock.stance,
      );
    }
    return fallbackDirectorResponses(intent, turn, text, selectedScenario, difficulty);
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

function fallbackAssessment(
  text: string,
  intent: Intent,
  selectedScenario: Scenario,
): DirectorAssessment {
  const feedback = INTENT_FEEDBACK[intent];
  return {
    intent,
    quality: feedback.quality,
    evidence: text.slice(0, 100),
    impactTitle: feedback.title,
    impactDetail: feedback.detail,
    suggestion: feedback.suggestion,
    criteriaAdded: intent === "criteria" ? extractCriteria(text, selectedScenario) : [],
    finalistsAdded: extractOptions(text, selectedScenario),
    unresolvedConflict: "",
    consensusDelta: CONSENSUS_DELTA[intent],
    scoreDeltas: completeScoreDelta(SCORE_DELTA[intent]),
  };
}

function fallbackFinalAssessment(
  statement: string,
  selectedScenario: Scenario,
): DirectorAssessment {
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
    criteriaAdded: extractCriteria(statement, selectedScenario),
    finalistsAdded: extractOptions(statement, selectedScenario),
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

function compactEvidenceText(value: string) {
  let normalized = "";
  const sourceIndexes: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (/\s/.test(character)) continue;
    normalized += character.toLowerCase();
    sourceIndexes.push(index);
  }
  return { normalized, sourceIndexes };
}

function anchorEvidence(text: string, suppliedEvidence: string) {
  const evidence = compactEvidenceText(suppliedEvidence.trim()).normalized;
  const source = compactEvidenceText(text);
  if (!evidence || !source.normalized) return undefined;

  const exactIndex = source.normalized.indexOf(evidence);
  if (exactIndex >= 0) {
    const start = source.sourceIndexes[exactIndex];
    const end = source.sourceIndexes[exactIndex + evidence.length - 1];
    return text.slice(start, end + 1).trim();
  }

  let previous = new Array(evidence.length + 1).fill(0) as number[];
  let bestLength = 0;
  let bestSourceEnd = 0;
  for (let sourceIndex = 1; sourceIndex <= source.normalized.length; sourceIndex += 1) {
    const current = new Array(evidence.length + 1).fill(0) as number[];
    for (let evidenceIndex = 1; evidenceIndex <= evidence.length; evidenceIndex += 1) {
      if (
        source.normalized[sourceIndex - 1] === evidence[evidenceIndex - 1]
      ) {
        current[evidenceIndex] = previous[evidenceIndex - 1] + 1;
        if (current[evidenceIndex] > bestLength) {
          bestLength = current[evidenceIndex];
          bestSourceEnd = sourceIndex;
        }
      }
    }
    previous = current;
  }
  if (bestLength < 8) return undefined;
  const start = source.sourceIndexes[bestSourceEnd - bestLength];
  const end = source.sourceIndexes[bestSourceEnd - 1];
  return text.slice(start, end + 1).trim();
}

function objectionQuote(content: string) {
  const clauses = content
    .split(/[。！？；]/)
    .map((item) => item.trim())
    .filter((item) => normalizeForMatch(item).length >= 8);
  const objection = clauses.find((item) =>
    /反对|不同意|但是|但|风险|担心|质疑|问题|不足|还没有|不能|不稳定|未|如何/.test(
      item,
    ),
  );
  const quote = (objection ?? clauses[0] ?? content.trim()).slice(0, 72);
  return `${quote}${(objection ?? clauses[0] ?? content.trim()).length > 72 ? "…" : ""}`;
}

function isSpecificObjection(
  content: string,
  conflict: string,
  selectedScenario: Scenario,
) {
  const challengesPosition =
    /反对|不同意|但是|但|风险|担心|质疑|问题|不足|还没有|不能|不稳定|未|如何/.test(
      content,
    );
  return (
    challengesPosition &&
    (matchedCaseTerms(content, selectedScenario).size > 0 ||
      mentionsConflict(content, conflict) ||
      normalizeForMatch(content).length >= 8)
  );
}

export function unresolvedPressureStance(
  text: string,
  state: GroupState,
  selectedScenario: Scenario = state.scenario ?? getScenario(state.scenarioId),
): CandidateStance | undefined {
  const userTerms = matchedCaseTerms(text, selectedScenario);
  const recentObjections = recentCandidateMessages(
    selectedScenario,
    state,
    2,
  )
    .reverse()
    .filter((item) =>
      isSpecificObjection(item.content, state.conflict, selectedScenario),
    );

  const missing = recentObjections.find((item) => {
    const stanceTerms = matchedCaseTerms(item.content, selectedScenario);
    const sharesCaseTerm = [...stanceTerms].some((term) => userTerms.has(term));
    const quotesStance = Boolean(anchorEvidence(text, item.content));
    const addressesConflict = sharesConflictPhrase(
      text,
      item.content,
      state.conflict,
    );
    return !sharesCaseTerm && !quotesStance && !addressesConflict;
  });

  if (!missing) return undefined;
  return {
    speaker: missing.speaker,
    speakerName: CANDIDATE_NAMES[missing.speaker],
    content: missing.content,
    quote: objectionQuote(missing.content),
  };
}

function groundedUnresolvedConflict(
  proposedConflict: string,
  text: string,
  state: GroupState,
  selectedScenario: Scenario,
  pressureStance?: CandidateStance,
) {
  if (pressureStance) return pressureStance.quote;
  const proposed = proposedConflict.trim().slice(0, 120);
  if (!proposed) return "";

  const userAnchor = anchorEvidence(text, proposed);
  if (userAnchor) return userAnchor.slice(0, 120);

  for (const candidate of recentCandidateMessages(selectedScenario, state, 2)) {
    const candidateAnchor = anchorEvidence(candidate.content, proposed);
    if (candidateAnchor) return candidateAnchor.slice(0, 120);
  }
  return "";
}

function intentIsGrounded(
  text: string,
  intent: Intent,
  fallbackIntent: Intent,
  selectedScenario: Scenario,
  context?: IntentContext,
) {
  if (intent === "general") return true;
  if (fallbackIntent === "summary" && intent === "summary") return true;
  const signals = intentSignals(text, selectedScenario, context);
  const grounded: Record<Exclude<Intent, "general">, boolean> = {
    criteria: signals.criteriaIntent,
    proposal: signals.proposal,
    challenge: signals.challenge,
    integrate: signals.integrate,
    time: signals.time,
    summary: signals.summary,
    support: signals.support,
  };
  return grounded[intent];
}

function materializeAssessment(
  text: string,
  turn: number,
  fallback: DirectorAssessment,
  selectedScenario: Scenario,
  difficulty: TrainingDifficulty,
  supplied?: DirectorAssessment,
  context?: GroupState,
): TurnAssessment {
  const suppliedEvidence = supplied?.evidence.trim() ?? "";
  const anchoredSuppliedEvidence = supplied
    ? anchorEvidence(text, suppliedEvidence)
    : undefined;
  const suppliedIsGrounded = Boolean(
    supplied &&
      anchoredSuppliedEvidence &&
      intentIsGrounded(
        text,
        supplied.intent,
        fallback.intent,
        selectedScenario,
        context,
      ),
  );
  const assessment = suppliedIsGrounded && supplied ? supplied : fallback;
  const groundedCriteria = new Set(extractCriteria(text, selectedScenario));
  const groundedOptions = new Set(extractOptions(text, selectedScenario));
  const difficultyProfile = getDifficulty(difficulty);
  const source = suppliedIsGrounded ? "ai" : "fallback";
  const evidence =
    (source === "ai" ? anchoredSuppliedEvidence : anchorEvidence(text, assessment.evidence)) ??
    text.slice(0, 100);
  const proposedSuggestion = assessment.suggestion
    .trim()
    .replace(/^(?:下一步|建议)\s*[：:，,]?\s*/, "")
    .slice(0, 140);
  const suggestionNumbers = proposedSuggestion.match(
    /\d+(?:\.\d+)?(?:周|天|人|次|万|%|％)|[一二三四五六七八九十百]+(?:周|天|人|次|万)/g,
  );
  const suggestionIntroducesNumbers = suggestionNumbers?.some(
    (number) => !includesNormalized(text, number),
  );
  const strongConsensusFloor: Record<Intent, number> = {
    criteria: 5,
    proposal: 3,
    challenge: 0,
    integrate: 8,
    time: 5,
    summary: 8,
    support: 0,
    general: 0,
  };
  const consensusFloor = assessment.quality === "strong" ? strongConsensusFloor[assessment.intent] : -4;
  const scoreDeltas = (Object.keys(fallback.scoreDeltas) as ScoreKey[]).reduce<ScoreState>(
    (next, key) => {
      next[key] = clamp(
        Math.round((Number(assessment.scoreDeltas[key]) || 0) * difficultyProfile.scoreMultiplier),
        0,
        6,
      );
      return next;
    },
    { ...fallback.scoreDeltas },
  );
  let consensusDelta = clamp(
    Math.round(
      Math.max(Number(assessment.consensusDelta) || 0, consensusFloor) *
        difficultyProfile.consensusMultiplier,
    ),
    -4,
    18,
  );
  if (assessment.intent === "support" || assessment.intent === "general") {
    consensusDelta = Math.min(0, consensusDelta);
  }
  if (
    assessment.intent === "challenge" &&
    !hasVerifiableRisk(text, selectedScenario, context)
  ) {
    consensusDelta = Math.min(0, consensusDelta);
  }
  const pressureStance =
    difficulty === "pressure" && context
      ? unresolvedPressureStance(text, context, selectedScenario)
      : undefined;
  if (pressureStance) {
    consensusDelta = Math.min(0, consensusDelta);
    scoreDeltas.progress = 0;
    scoreDeltas.contribution = Math.min(1, scoreDeltas.contribution);
    scoreDeltas.listening = Math.min(2, scoreDeltas.listening);
    scoreDeltas.conflict = Math.min(2, scoreDeltas.conflict);
  }

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
    criteriaAdded: unique(
      assessment.criteriaAdded
        .map((item) => item.trim())
        .filter((item) => groundedCriteria.has(item)),
    ).slice(0, 4),
    finalistsAdded: unique(
      assessment.finalistsAdded
        .map((item) => item.trim())
        .filter((item) => groundedOptions.has(item)),
    ).slice(0, 3),
    unresolvedConflict: context
      ? groundedUnresolvedConflict(
          assessment.unresolvedConflict,
          text,
          context,
          selectedScenario,
          pressureStance,
        )
      : "",
    consensusDelta,
    scoreDeltas,
  };
}

function unaddressedStanceReason(
  text: string,
  state: GroupState,
  selectedScenario: Scenario,
) {
  const missing = unresolvedPressureStance(text, state, selectedScenario);
  if (missing) {
    return `尚未回应${missing.speakerName}的具体反对：“${missing.quote}”`;
  }
  return `尚未回应当前分歧：“${state.conflict}”`;
}

function eventFromAssessment(
  assessment: TurnAssessment,
  text: string,
  state: GroupState,
  selectedScenario: Scenario,
): InfluenceEvent {
  const tone: InfluenceEvent["tone"] =
    assessment.consensusDelta > 0
      ? "positive"
      : assessment.consensusDelta < 0 || assessment.quality === "weak"
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
    assessment.consensusDelta,
    assessment.consensusDelta <= 0
      ? unaddressedStanceReason(text, state, selectedScenario)
      : undefined,
  );
}

export function createInitialState(
  scenarioOrId: Scenario | ScenarioId = "campus-career-retention",
  difficulty: TrainingDifficulty = "standard",
): GroupState {
  const selectedScenario =
    typeof scenarioOrId === "string" ? getScenario(scenarioOrId) : scenarioOrId;
  const difficultyProfile = getDifficulty(difficulty);
  return {
    scenarioId: selectedScenario.id,
    scenario: selectedScenario,
    difficulty: difficultyProfile.id,
    turn: 0,
    timeLeft:
      Math.round((selectedScenario.timeLimit * difficultyProfile.timeMultiplier) / 30) * 30,
    consensus: clamp(
      selectedScenario.initialConsensus + difficultyProfile.initialConsensusDelta,
      8,
      50,
    ),
    criteria: [],
    finalists: [],
    conflict: selectedScenario.initialConflict,
    messages: selectedScenario.openingMessages.map((item, index) =>
      message(item.speaker, item.content, 0 + index / 10),
    ),
    influence: [],
    assessments: [],
    voiceMetrics: [],
    turnSnapshots: [],
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

function createTurnSnapshot(state: GroupState, targetTurn: number): TurnSnapshot {
  return {
    targetTurn,
    turn: state.turn,
    timeLeft: state.timeLeft,
    consensus: state.consensus,
    criteria: [...state.criteria],
    finalists: [...state.finalists],
    conflict: state.conflict,
    messages: [...state.messages],
    influence: [...state.influence],
    assessments: [...(state.assessments ?? [])],
    voiceMetrics: [...(state.voiceMetrics ?? [])],
    scores: { ...state.scores },
  };
}

export function restoreTurnSnapshot(
  completedState: GroupState,
  targetTurn: number,
): GroupState | undefined {
  const snapshot = (completedState.turnSnapshots ?? []).find(
    (item) => item.targetTurn === targetTurn,
  );
  if (!snapshot) return undefined;
  return {
    scenarioId: completedState.scenarioId,
    scenario: completedState.scenario ?? getScenario(completedState.scenarioId),
    difficulty: completedState.difficulty,
    turn: snapshot.turn,
    timeLeft: snapshot.timeLeft,
    consensus: snapshot.consensus,
    criteria: [...snapshot.criteria],
    finalists: [...snapshot.finalists],
    conflict: snapshot.conflict,
    messages: [...snapshot.messages],
    influence: [...snapshot.influence],
    assessments: [...snapshot.assessments],
    voiceMetrics: [...snapshot.voiceMetrics],
    turnSnapshots: (completedState.turnSnapshots ?? []).filter(
      (item) => item.targetTurn < targetTurn,
    ),
    scores: { ...snapshot.scores },
    finalStatement: "",
  };
}

function createVoiceMetric(
  text: string,
  turn: number,
  voiceCapture?: VoiceCapture,
) {
  if (!voiceCapture) return undefined;
  const durationSeconds = Math.max(1, Math.round(voiceCapture.durationSeconds));
  const characterCount = text.replace(/\s/g, "").length;
  return {
    turn,
    durationSeconds,
    pauseCount: Math.max(0, Math.round(voiceCapture.pauseCount)),
    characterCount,
    charsPerMinute: Math.round((characterCount / durationSeconds) * 60),
  };
}

export function applyUserTurn(
  state: GroupState,
  rawText: string,
  directorTurn?: DirectorTurn,
  voiceCapture?: VoiceCapture,
): GroupState {
  const text = rawText.trim();
  if (!text) return state;

  const scenarioId = state.scenarioId ?? "campus-career-retention";
  const difficulty = state.difficulty ?? "standard";
  const selectedScenario = state.scenario ?? getScenario(scenarioId);
  const turn = state.turn + 1;
  const fallback = fallbackAssessment(
    text,
    classifyIntent(text, selectedScenario, state),
    selectedScenario,
  );
  const assessment = materializeAssessment(
    text,
    turn,
    fallback,
    selectedScenario,
    difficulty,
    directorTurn?.assessment,
    state,
  );
  const intent = assessment.intent;
  const userMessage = message("user", text, turn, intent);
  const pressureStance =
    difficulty === "pressure"
      ? unresolvedPressureStance(text, state, selectedScenario)
      : undefined;
  const pressureBlock =
    difficulty === "pressure" &&
    (pressureStance || assessment.consensusDelta <= 0)
      ? { conflict: state.conflict, stance: pressureStance }
      : undefined;
  const aiMessages = directorResponses(
    intent,
    turn,
    text,
    selectedScenario,
    difficulty,
    directorTurn?.replies,
    pressureBlock,
  );
  const voiceMetric = createVoiceMetric(text, turn, voiceCapture);
  const inferredCriteria =
    intent === "criteria" ? extractCriteria(text, selectedScenario) : [];
  const criteria = unique([
    ...state.criteria,
    ...inferredCriteria,
    ...assessment.criteriaAdded,
  ]).slice(-8);
  const proposedOptions = unique([
    ...extractOptions(text, selectedScenario),
    ...assessment.finalistsAdded,
  ]);
  const finalists =
    proposedOptions.length > 0
      ? unique([...state.finalists, ...proposedOptions]).slice(-3)
      : state.finalists;

  const conflict = assessment.unresolvedConflict || state.conflict;

  return {
    ...state,
    turn,
    consensus: clamp(state.consensus + assessment.consensusDelta, 8, 94),
    criteria,
    finalists,
    conflict,
    messages: [...state.messages, userMessage, ...aiMessages],
    influence: [
      ...state.influence,
      eventFromAssessment(assessment, text, state, selectedScenario),
    ],
    assessments: [...(state.assessments ?? []), assessment],
    voiceMetrics: voiceMetric
      ? [...(state.voiceMetrics ?? []), voiceMetric]
      : (state.voiceMetrics ?? []),
    turnSnapshots: [
      ...(state.turnSnapshots ?? []),
      createTurnSnapshot(state, turn),
    ],
    scores: clampScores(state.scores, assessment.scoreDeltas),
  };
}

export function finishSession(
  state: GroupState,
  rawStatement: string,
  directorTurn?: DirectorTurn,
  voiceCapture?: VoiceCapture,
): GroupState {
  const statement = rawStatement.trim();
  if (!statement) return state;

  const scenarioId = state.scenarioId ?? "campus-career-retention";
  const difficulty = state.difficulty ?? "standard";
  const selectedScenario = state.scenario ?? getScenario(scenarioId);
  const turn = state.turn + 1;
  const assessment = materializeAssessment(
    statement,
    turn,
    fallbackFinalAssessment(statement, selectedScenario),
    selectedScenario,
    difficulty,
    directorTurn?.assessment,
    state,
  );
  const voiceMetric = createVoiceMetric(statement, turn, voiceCapture);

  const finalOptions = unique([
    ...state.finalists,
    ...extractOptions(statement, selectedScenario),
    ...assessment.finalistsAdded,
  ]);

  return {
    ...state,
    turn,
    consensus: clamp(state.consensus + Math.max(0, assessment.consensusDelta), 8, 96),
    finalStatement: statement,
    criteria: unique([...state.criteria, ...assessment.criteriaAdded]).slice(-8),
    finalists: finalOptions.slice(0, selectedScenario.selectionCount),
    messages: [
      ...state.messages,
      message("user", statement, turn, assessment.intent),
      message(
        "system",
        "群面结束。系统正在把你的发言与团队状态变化对应起来。",
        turn + 0.1,
      ),
    ],
    influence: [
      ...state.influence,
      eventFromAssessment(assessment, statement, state, selectedScenario),
    ],
    assessments: [...(state.assessments ?? []), assessment],
    voiceMetrics: voiceMetric
      ? [...(state.voiceMetrics ?? []), voiceMetric]
      : (state.voiceMetrics ?? []),
    turnSnapshots: [
      ...(state.turnSnapshots ?? []),
      createTurnSnapshot(state, turn),
    ],
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
