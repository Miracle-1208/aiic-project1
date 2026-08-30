import type {
  RetrainAttempt,
  RetrainRubricScore,
  Scenario,
  TurnSnapshot,
  TurnAssessment,
  VoiceTurnMetric,
} from "./types";

export type RetrainContext = Pick<
  TurnSnapshot,
  "conflict" | "criteria" | "finalists" | "messages"
>;

export const RETRAIN_CHALLENGE_LIMIT = 3;

export const RETRAIN_RUBRIC_ITEMS = [
  { key: "listeningIntegration", label: "回应整合", max: 25 },
  { key: "conclusionPriority", label: "结论优先级", max: 25 },
  { key: "evidenceConstraints", label: "数据与限制", max: 20 },
  { key: "actionValidation", label: "行动与验证", max: 20 },
  { key: "clarity", label: "简洁清楚", max: 10 },
] as const satisfies ReadonlyArray<{
  key: keyof Omit<RetrainRubricScore, "total">;
  label: string;
  max: number;
}>;

export function assessmentImpact(assessment: TurnAssessment) {
  return (
    assessment.consensusDelta +
    Object.values(assessment.scoreDeltas).reduce((sum, value) => sum + value, 0)
  );
}

function normalizeForMatch(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[“”‘’'"`，,。！？!?；;：:（）()【】\[\]]/g, "");
}

function includesNormalized(text: string, phrase: string) {
  const normalizedPhrase = normalizeForMatch(phrase);
  return (
    normalizedPhrase.length > 0 &&
    normalizeForMatch(text).includes(normalizedPhrase)
  );
}

function mentionedOptions(text: string, scenario?: Scenario) {
  if (!scenario) return [];
  return scenario.options.filter((option) =>
    (scenario.optionAliases[option.id] ?? [option.title]).some((alias) =>
      includesNormalized(text, alias),
    ),
  );
}

function mentionedCriteria(text: string, scenario?: Scenario) {
  if (!scenario) return [];
  return scenario.referenceCriteria.filter((criterion) =>
    criterion.keywords.some((keyword) => includesNormalized(text, keyword)),
  );
}

function longestSharedSubstringLength(left: string, right: string) {
  const a = normalizeForMatch(left);
  const b = normalizeForMatch(right);
  if (!a || !b) return 0;
  let previous = new Array(b.length + 1).fill(0) as number[];
  let best = 0;
  for (let leftIndex = 1; leftIndex <= a.length; leftIndex += 1) {
    const current = new Array(b.length + 1).fill(0) as number[];
    for (let rightIndex = 1; rightIndex <= b.length; rightIndex += 1) {
      if (a[leftIndex - 1] === b[rightIndex - 1]) {
        current[rightIndex] = previous[rightIndex - 1] + 1;
        best = Math.max(best, current[rightIndex]);
      }
    }
    previous = current;
  }
  return best;
}

function resolveContext(
  scenario?: Scenario,
  snapshot?: RetrainContext,
): RetrainContext {
  if (snapshot) return snapshot;
  if (!scenario) {
    return { conflict: "", criteria: [], finalists: [], messages: [] };
  }
  return {
    conflict: scenario.initialConflict,
    criteria: [],
    finalists: [],
    messages: scenario.openingMessages.map((item, index) => ({
      id: `opening-${item.speaker}`,
      speaker: item.speaker,
      content: item.content,
      turn: 0,
      createdAt: `00:0${index}`,
    })),
  };
}

function conflictMatchCount(text: string, conflict: string) {
  return conflict
    .split(/[，,。！？!?；;、]|还是|或者|或是|\bvs\b/gi)
    .map((item) => item.trim().replace(/^(?:如何|是否|怎样|怎么)/, ""))
    .filter((item) => normalizeForMatch(item).length >= 4)
    .filter((item) => includesNormalized(text, item)).length;
}

function referencedLiveClaims(
  text: string,
  context: RetrainContext,
  scenario?: Scenario,
) {
  const userOptions = new Set(mentionedOptions(text, scenario).map((item) => item.title));
  const userCriteria = new Set(mentionedCriteria(text, scenario).map((item) => item.label));
  return context.messages
    .filter((message) => ["cheng", "lin", "zhou"].includes(message.speaker))
    .slice(-2)
    .filter((message) => {
      const sharesOption = mentionedOptions(message.content, scenario).some((option) =>
        userOptions.has(option.title),
      );
      const sharesCriterion = mentionedCriteria(message.content, scenario).some(
        (criterion) => userCriteria.has(criterion.label),
      );
      return (
        sharesOption ||
        sharesCriterion ||
        longestSharedSubstringLength(text, message.content) >= 6
      );
    }).length;
}

function canonicalNumberToken(token: string) {
  return normalizeForMatch(token).replace(/万元/g, "万").replace(/％/g, "%");
}

function numericTokens(text: string) {
  return (
    text.match(
      /\d+(?:\.\d+)?\s*(?:%|％|pt|倍|万元?|万|周|天|小时|分钟|家|单|人)?|[一二三四五六七八九十百两]+\s*(?:万元?|万|周|天|小时|分钟|家|单|人)/g,
    ) ?? []
  );
}

function realCaseNumbers(text: string, scenario?: Scenario) {
  if (!scenario) return [];
  const corpus = [
    scenario.brief,
    scenario.goal,
    ...scenario.constraints,
    ...scenario.facts.flatMap((fact) => [fact.label, fact.value]),
    ...scenario.options.flatMap((option) => [
      option.cost,
      option.cycle,
      option.signal,
    ]),
  ].join(" ");
  const caseNumbers = new Set(
    numericTokens(corpus).map(canonicalNumberToken),
  );
  return numericTokens(text).filter((token) =>
    caseNumbers.has(canonicalNumberToken(token)),
  );
}

function factualPhraseCount(text: string, scenario?: Scenario) {
  if (!scenario) return 0;
  const phrases = [
    ...scenario.facts.flatMap((fact) => [fact.label, fact.value]),
    ...scenario.options.flatMap((option) => [
      option.cost,
      option.cycle,
      option.signal,
    ]),
    ...scenario.constraints,
  ];
  return phrases.filter((phrase) => includesNormalized(text, phrase)).length;
}

export function scoreRetrainText(
  rawText: string,
  scenario?: Scenario,
  snapshot?: RetrainContext,
): RetrainRubricScore {
  const text = rawText.trim();
  const context = resolveContext(scenario, snapshot);
  const claimCount = referencedLiveClaims(text, context, scenario);
  const conflictMatches = conflictMatchCount(text, context.conflict);
  const integratesViews =
    /整合|结合|兼顾|保留|既.+也|一方面.+另一方面|先.+再/.test(text);
  const listeningIntegration = Math.min(
    25,
    (claimCount >= 2 ? 16 : claimCount === 1 ? 8 : 0) +
      (conflictMatches >= 2 ? 9 : conflictMatches === 1 ? 5 : 0) +
      (integratesViews && (claimCount >= 2 || conflictMatches >= 2) ? 4 : 0),
  );

  const options = mentionedOptions(text, scenario);
  const hasConclusion = /建议|选择|优先|结论|决定|主方案|先做|先修复|先上线/.test(
    text,
  );
  const hasPriority = /优先级|依次|第一|第二|先.+再|阶段|顺序/.test(text);
  const conclusionPriority =
    options.length === 0
      ? 0
      : Math.min(
          25,
          (options.length >= 2 ? 17 : 9) +
            (hasConclusion ? 4 : 0) +
            (hasPriority && options.length >= 2 ? 4 : 0),
        );

  const validNumbers = realCaseNumbers(text, scenario);
  const factualMatches = factualPhraseCount(text, scenario);
  const evidenceConstraints = Math.min(
    20,
    (validNumbers.length >= 3
      ? 16
      : validNumbers.length === 2
        ? 12
        : validNumbers.length === 1
          ? 7
          : 0) + (factualMatches > 0 ? 4 : 0),
  );

  const relatesToConflict = conflictMatches > 0 || claimCount > 0;
  const hasAction = /实施|启动|处理|修复|优化|上线|选择|优先|投入/.test(text);
  const hasValidation = /检查|验证|监测|评估|观察|复盘|指标|是否下降|是否改善/.test(
    text,
  );
  const hasDecisionCondition = /如果|若|否则|决定是否|达到.+则|再用|再开展|再评估/.test(
    text,
  );
  const actionValidation = relatesToConflict
    ? Math.min(
        20,
        (hasAction ? 6 : 0) +
          (hasValidation ? 6 : 0) +
          (options.length > 0 ? 4 : 0) +
          (hasDecisionCondition ? 4 : 0),
      )
    : 0;

  const sentenceCount = text
    .split(/[。！？；]/)
    .map((sentence) => sentence.trim())
    .filter(Boolean).length;
  const lengthScore =
    text.length >= 55 && text.length <= 220
      ? 4
      : text.length >= 30 && text.length <= 320
        ? 2
        : text.length >= 15
          ? 1
          : 0;
  const sentenceScore =
    sentenceCount >= 2 && sentenceCount <= 5
      ? 3
      : sentenceCount === 1
        ? 1
        : sentenceCount > 5
          ? 2
          : 0;
  const structureScore = /：|先.+再|第一|第二|阶段|依次|分别/.test(text)
    ? 3
    : 0;
  const clarity = Math.min(10, lengthScore + sentenceScore + structureScore);
  const total =
    listeningIntegration +
    conclusionPriority +
    evidenceConstraints +
    actionValidation +
    clarity;

  return {
    listeningIntegration,
    conclusionPriority,
    evidenceConstraints,
    actionValidation,
    clarity,
    total,
  };
}

export function retrainRubricReason(score: RetrainRubricScore) {
  const strongest = RETRAIN_RUBRIC_ITEMS.map((item) => ({
    ...item,
    value: score[item.key],
    ratio: score[item.key] / item.max,
  }))
    .sort((left, right) => right.ratio - left.ratio || right.value - left.value)
    .slice(0, 2)
    .map((item) => `“${item.label}”${item.value}/${item.max}`);
  return `这版在${strongest.join("和")}上最完整，因此被选为当前最佳。`;
}

export function retrainAttemptsForTurn(
  attempts: RetrainAttempt[],
  targetTurn: number,
) {
  return [...new Map(attempts.map((attempt) => [attempt.id, attempt])).values()]
    .filter((attempt) => attempt.targetTurn === targetTurn)
    .sort((left, right) => left.completedAt.localeCompare(right.completedAt))
    .slice(-RETRAIN_CHALLENGE_LIMIT);
}

export function recommendedRetrainTurn(assessments: TurnAssessment[]) {
  const qualityRank = { weak: 1, developing: 2, strong: 3 };
  return [...assessments].sort((left, right) => {
    const qualityDelta = qualityRank[left.quality] - qualityRank[right.quality];
    if (qualityDelta !== 0) return qualityDelta;
    const impactDelta = assessmentImpact(left) - assessmentImpact(right);
    if (impactDelta !== 0) return impactDelta;
    return left.turn - right.turn;
  })[0];
}

export function bestRetrainAttempt(attempts: RetrainAttempt[]) {
  const hasRubric = attempts.some((attempt) => attempt.revisedRubric);
  return attempts.reduce<RetrainAttempt | undefined>((best, attempt) => {
    if (!best) return attempt;
    if (hasRubric) {
      const attemptRubric = attempt.revisedRubric?.total ?? -1;
      const bestRubric = best.revisedRubric?.total ?? -1;
      if (attemptRubric !== bestRubric) {
        return attemptRubric > bestRubric ? attempt : best;
      }
      const tieBreakKeys: Array<keyof Omit<RetrainRubricScore, "total">> = [
        "listeningIntegration",
        "actionValidation",
        "evidenceConstraints",
        "conclusionPriority",
        "clarity",
      ];
      for (const key of tieBreakKeys) {
        const attemptValue = attempt.revisedRubric?.[key] ?? -1;
        const bestValue = best.revisedRubric?.[key] ?? -1;
        if (attemptValue !== bestValue) {
          return attemptValue > bestValue ? attempt : best;
        }
      }
      if (attempt.revisedText.length !== best.revisedText.length) {
        return attempt.revisedText.length > best.revisedText.length
          ? attempt
          : best;
      }
      return attempt.completedAt > best.completedAt ? attempt : best;
    }
    if (attempt.revisedImpactScore !== best.revisedImpactScore) {
      return attempt.revisedImpactScore > best.revisedImpactScore ? attempt : best;
    }
    if (attempt.revisedConsensusDelta !== best.revisedConsensusDelta) {
      return attempt.revisedConsensusDelta > best.revisedConsensusDelta
        ? attempt
        : best;
    }
    return attempt.completedAt > best.completedAt ? attempt : best;
  }, undefined);
}

export function createRetrainAttempt({
  targetTurn,
  originalText,
  revisedText,
  originalAssessment,
  revisedAssessment,
  originalVoiceMetric,
  revisedVoiceMetric,
  scenario,
  snapshot,
  completedAt = new Date().toISOString(),
  id = `retrain-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
}: {
  targetTurn: number;
  originalText: string;
  revisedText: string;
  originalAssessment: TurnAssessment;
  revisedAssessment: TurnAssessment;
  originalVoiceMetric?: VoiceTurnMetric;
  revisedVoiceMetric?: VoiceTurnMetric;
  scenario?: Scenario;
  snapshot?: RetrainContext;
  completedAt?: string;
  id?: string;
}): RetrainAttempt {
  const originalImpactScore = assessmentImpact(originalAssessment);
  const revisedImpactScore = assessmentImpact(revisedAssessment);
  const impactDelta = revisedImpactScore - originalImpactScore;
  const originalRubric = scoreRetrainText(originalText, scenario, snapshot);
  const revisedRubric = scoreRetrainText(revisedText, scenario, snapshot);
  return {
    id,
    completedAt,
    targetTurn,
    originalText,
    revisedText,
    originalQuality: originalAssessment.quality,
    revisedQuality: revisedAssessment.quality,
    originalImpactTitle: originalAssessment.impactTitle,
    revisedImpactTitle: revisedAssessment.impactTitle,
    originalImpactScore,
    revisedImpactScore,
    impactDelta,
    originalConsensusDelta: originalAssessment.consensusDelta,
    revisedConsensusDelta: revisedAssessment.consensusDelta,
    suggestion: revisedAssessment.suggestion,
    improved: revisedRubric.total > originalRubric.total,
    originalCharsPerMinute: originalVoiceMetric?.charsPerMinute,
    revisedCharsPerMinute: revisedVoiceMetric?.charsPerMinute,
    originalRubric,
    revisedRubric,
  };
}
