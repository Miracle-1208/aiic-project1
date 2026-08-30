export type View =
  | "welcome"
  | "library"
  | "briefing"
  | "room"
  | "report"
  | "retrain"
  | "generator"
  | "history";

export type BuiltInScenarioId =
  | "campus-career-retention"
  | "coffee-safety-crisis"
  | "ai-study-beta";

export type ScenarioId = BuiltInScenarioId | `custom-${string}`;

export type TrainingDifficulty = "guided" | "standard" | "pressure";

export type SpeakerId = "user" | "cheng" | "lin" | "zhou" | "system";

export type Intent =
  | "criteria"
  | "proposal"
  | "challenge"
  | "integrate"
  | "time"
  | "summary"
  | "support"
  | "general";

export type ScoreKey =
  | "contribution"
  | "progress"
  | "listening"
  | "conflict"
  | "structure";

export type ScoreState = Record<ScoreKey, number>;

export type AssessmentQuality = "strong" | "developing" | "weak";

export interface Participant {
  id: Exclude<SpeakerId, "system">;
  name: string;
  initials: string;
  role: string;
  style: string;
  accent: string;
  softAccent: string;
  stance: string;
}

export interface CaseOption {
  id: string;
  title: string;
  description: string;
  cost: string;
  cycle: string;
  signal: string;
}

export interface Scenario {
  id: ScenarioId;
  category: string;
  caseNumber: string;
  accent: string;
  title: string;
  company: string;
  brief: string;
  goal: string;
  timeLimit: number;
  selectionCount: number;
  initialConsensus: number;
  initialConflict: string;
  constraints: string[];
  facts: Array<{ label: string; value: string }>;
  options: CaseOption[];
  referenceCriteria: Array<{ label: string; keywords: string[] }>;
  optionAliases: Record<string, string[]>;
  participantStances: Record<Exclude<SpeakerId, "user" | "system">, string>;
  openingMessages: Array<{
    speaker: Exclude<SpeakerId, "user" | "system">;
    content: string;
  }>;
  quickActions: [string, string, string];
  fallbackFinalists: [string, string];
}

export interface ScenarioGeneratorInput {
  role: string;
  industry: string;
  companyType: string;
  category: string;
  timeMinutes: number;
}

export interface DifficultyProfile {
  id: TrainingDifficulty;
  label: string;
  shortLabel: string;
  description: string;
  behavior: string;
  consensusMultiplier: number;
  scoreMultiplier: number;
  timeMultiplier: number;
  initialConsensusDelta: number;
}

export interface Message {
  id: string;
  speaker: SpeakerId;
  content: string;
  turn: number;
  intent?: Intent;
  createdAt: string;
}

export interface DirectorReply {
  speaker: Exclude<SpeakerId, "user" | "system">;
  content: string;
}

export interface DirectorAssessment {
  intent: Intent;
  quality: AssessmentQuality;
  evidence: string;
  impactTitle: string;
  impactDetail: string;
  suggestion: string;
  criteriaAdded: string[];
  finalistsAdded: string[];
  unresolvedConflict: string;
  consensusDelta: number;
  scoreDeltas: ScoreState;
}

export interface DirectorTurn {
  replies: DirectorReply[];
  assessment?: DirectorAssessment;
}

export interface TurnAssessment extends DirectorAssessment {
  id: string;
  turn: number;
  source: "ai" | "fallback";
}

export interface InfluenceEvent {
  id: string;
  turn: number;
  title: string;
  detail: string;
  tone: "positive" | "neutral" | "warning";
  evidence?: string;
  suggestion?: string;
  source?: "ai" | "fallback";
}

export interface VoiceCapture {
  durationSeconds: number;
  pauseCount: number;
}

export interface VoiceTurnMetric extends VoiceCapture {
  turn: number;
  characterCount: number;
  charsPerMinute: number;
}

export interface TurnSnapshot {
  targetTurn: number;
  turn: number;
  timeLeft: number;
  consensus: number;
  criteria: string[];
  finalists: string[];
  conflict: string;
  messages: Message[];
  influence: InfluenceEvent[];
  assessments: TurnAssessment[];
  voiceMetrics: VoiceTurnMetric[];
  scores: ScoreState;
}

export interface GroupState {
  scenarioId: ScenarioId;
  scenario: Scenario;
  difficulty: TrainingDifficulty;
  turn: number;
  timeLeft: number;
  consensus: number;
  criteria: string[];
  finalists: string[];
  conflict: string;
  messages: Message[];
  influence: InfluenceEvent[];
  assessments: TurnAssessment[];
  voiceMetrics: VoiceTurnMetric[];
  turnSnapshots: TurnSnapshot[];
  scores: ScoreState;
  finalStatement: string;
}

export interface DimensionReport {
  key: ScoreKey;
  label: string;
  score: number;
  max: number;
  summary: string;
}

export interface ExpressionReport {
  voiceTurns: number;
  totalSeconds: number;
  averageCharsPerMinute: number;
  pauseCount: number;
  paceLabel: "偏慢" | "稳健" | "偏快" | "过快";
  summary: string;
  suggestion: string;
}

export interface SessionReport {
  total: number;
  level: string;
  dimensions: DimensionReport[];
  strength: string;
  focus: string;
  evidence: string;
  expression?: ExpressionReport;
}

export interface RetrainRubricScore {
  listeningIntegration: number;
  conclusionPriority: number;
  evidenceConstraints: number;
  actionValidation: number;
  clarity: number;
  total: number;
}

export interface RetrainAttempt {
  id: string;
  completedAt: string;
  targetTurn: number;
  originalText: string;
  revisedText: string;
  originalQuality: AssessmentQuality;
  revisedQuality: AssessmentQuality;
  originalImpactTitle: string;
  revisedImpactTitle: string;
  originalImpactScore: number;
  revisedImpactScore: number;
  impactDelta: number;
  originalConsensusDelta: number;
  revisedConsensusDelta: number;
  suggestion: string;
  improved: boolean;
  originalCharsPerMinute?: number;
  revisedCharsPerMinute?: number;
  originalRubric?: RetrainRubricScore;
  revisedRubric?: RetrainRubricScore;
}

export interface TrainingRecord {
  id: string;
  completedAt: string;
  scenarioId: ScenarioId;
  scenario?: Scenario;
  difficulty: TrainingDifficulty;
  turns: number;
  consensus: number;
  finalists: string[];
  finalStatement: string;
  influence: InfluenceEvent[];
  report: SessionReport;
  retrainAttempts?: RetrainAttempt[];
}
