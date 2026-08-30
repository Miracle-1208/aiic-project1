import type {
  RetrainAttempt,
  TurnAssessment,
  VoiceTurnMetric,
} from "./types";

export function assessmentImpact(assessment: TurnAssessment) {
  return (
    assessment.consensusDelta +
    Object.values(assessment.scoreDeltas).reduce((sum, value) => sum + value, 0)
  );
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
