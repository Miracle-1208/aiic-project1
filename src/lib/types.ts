export type View = "welcome" | "briefing" | "room" | "report";

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
  id: string;
  title: string;
  company: string;
  brief: string;
  goal: string;
  constraints: string[];
  facts: Array<{ label: string; value: string }>;
  options: CaseOption[];
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

export interface InfluenceEvent {
  id: string;
  turn: number;
  title: string;
  detail: string;
  tone: "positive" | "neutral" | "warning";
}

export type ScoreState = Record<ScoreKey, number>;

export interface GroupState {
  turn: number;
  timeLeft: number;
  consensus: number;
  criteria: string[];
  finalists: string[];
  conflict: string;
  messages: Message[];
  influence: InfluenceEvent[];
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

export interface SessionReport {
  total: number;
  level: string;
  dimensions: DimensionReport[];
  strength: string;
  focus: string;
  evidence: string;
}
