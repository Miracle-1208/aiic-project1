import type {
  RetrainAttempt,
  TurnAssessment,
  VoiceTurnMetric,
} from "./types";

export const RETRAIN_CHALLENGE_LIMIT = 3;

export function assessmentImpact(assessment: TurnAssessment) {
  return (
    assessment.consensusDelta +
    Object.values(assessment.scoreDeltas).reduce((sum, value) => sum + value, 0)
  );
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
  return attempts.reduce<RetrainAttempt | undefined>((best, attempt) => {
    if (!best) return attempt;
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
  completedAt?: string;
  id?: string;
}): RetrainAttempt {
  const originalImpactScore = assessmentImpact(originalAssessment);
  const revisedImpactScore = assessmentImpact(revisedAssessment);
  const qualityRank = { weak: 1, developing: 2, strong: 3 };
  const impactDelta = revisedImpactScore - originalImpactScore;
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
    improved:
      qualityRank[revisedAssessment.quality] > qualityRank[originalAssessment.quality] ||
      impactDelta > 0,
    originalCharsPerMinute: originalVoiceMetric?.charsPerMinute,
    revisedCharsPerMinute: revisedVoiceMetric?.charsPerMinute,
  };
}
