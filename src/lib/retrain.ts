import type {
  RetrainAttempt,
  RetrainRubricScore,
  Scenario,
  TurnAssessment,
  VoiceTurnMetric,
} from "./types";

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

function optionMentionCount(text: string, scenario?: Scenario) {
  if (!scenario) return 0;
  return scenario.options.filter((option) =>
    (scenario.optionAliases[option.id] ?? [option.title]).some((alias) =>
      text.includes(alias),
    ),
  ).length;
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

export function scoreRetrainText(
  rawText: string,
  scenario?: Scenario,
): RetrainRubricScore {
  const text = rawText.trim();
  const participantNameCount = ["程野", "林乔", "周可"].filter((name) =>
    text.includes(name),
  ).length;
  const referencesView = hasAny(text, [
    /强调|担心|要求|关注|观点|提到|长期价值|统一标准/,
  ]);
  const integratesViews = hasAny(text, [
    /整合|结合|兼顾|同时|转化为|保留|既.+也|一方面.+另一方面/,
  ]);
  const listeningIntegration = Math.min(
    25,
    (participantNameCount >= 2
      ? 10
      : participantNameCount === 1
        ? 7
        : /同意|回应|大家|两位|刚才/.test(text)
          ? 3
          : 0) +
      (referencesView ? 7 : 0) +
      (integratesViews ? 8 : 0),
  );

  const mentionedOptions = optionMentionCount(text, scenario);
  const hasConclusion = /建议|选择|优先|结论|决定|主方案|先处理/.test(text);
  const hasPriority = /优先级|依次|第一|第二|先.+再|阶段|顺序/.test(text);
  const conclusionPriority = Math.min(
    25,
    (hasConclusion ? 8 : 0) +
      (hasPriority ? 9 : /先|优先/.test(text) ? 5 : 0) +
      (mentionedOptions >= 2 ? 8 : mentionedOptions === 1 ? 4 : 0),
  );

  const evidenceGroups = [
    /\d|[一二三四五六七八九十两]+周/,
    /预算|万元|成本|投入|剩余/,
    /周|天|时间|窗口|上线|交付/,
    /留存|到达率|完成率|数据|指标|效果/,
    /风险|限制|不超过|超预算|如果|若|否则/,
  ];
  const evidenceConstraints = Math.min(
    20,
    evidenceGroups.filter((pattern) => pattern.test(text)).length * 4,
  );

  const actionVerbCount = [
    /实施|启动|处理|修复|优化/,
    /上线|检查|验证|监测|评估/,
    /实验|分工|负责|预留|投入/,
  ].filter((pattern) => pattern.test(text)).length;
  const hasTimeNode = /第?\d+周|[一二三四五六七八九十两\d]+周(内|后)?|阶段/.test(
    text,
  );
  const hasDecisionCondition = /如果|若|否则|决定是否|达到.+则|再用|再开展/.test(
    text,
  );
  const actionValidation = Math.min(
    20,
    (actionVerbCount >= 3 ? 8 : actionVerbCount > 0 ? 4 : 0) +
      (hasTimeNode ? 6 : 0) +
      (hasDecisionCondition ? 6 : 0),
  );

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
  completedAt?: string;
  id?: string;
}): RetrainAttempt {
  const originalImpactScore = assessmentImpact(originalAssessment);
  const revisedImpactScore = assessmentImpact(revisedAssessment);
  const impactDelta = revisedImpactScore - originalImpactScore;
  const originalRubric = scoreRetrainText(originalText, scenario);
  const revisedRubric = scoreRetrainText(revisedText, scenario);
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
