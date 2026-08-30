import { DIFFICULTY_IDS, SCENARIO_IDS } from "./scenario";
import { ScenarioSchema } from "./scenario-schema";
import { buildReport } from "./scoring";
import { RETRAIN_CHALLENGE_LIMIT } from "./retrain";
import type {
  GroupState,
  RetrainAttempt,
  ScoreKey,
  TrainingRecord,
} from "./types";

export const TRAINING_HISTORY_KEY = "grouplab.training-history.v1";
const MAX_HISTORY_RECORDS = 50;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isRetrainRubric(value: unknown) {
  if (!isObject(value)) return false;
  return (
    typeof value.listeningIntegration === "number" &&
    typeof value.conclusionPriority === "number" &&
    typeof value.evidenceConstraints === "number" &&
    typeof value.actionValidation === "number" &&
    typeof value.clarity === "number" &&
    typeof value.total === "number"
  );
}

function isRetrainAttempt(value: unknown): value is RetrainAttempt {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.completedAt === "string" &&
    !Number.isNaN(Date.parse(value.completedAt)) &&
    typeof value.targetTurn === "number" &&
    typeof value.originalText === "string" &&
    typeof value.revisedText === "string" &&
    ["strong", "developing", "weak"].includes(String(value.originalQuality)) &&
    ["strong", "developing", "weak"].includes(String(value.revisedQuality)) &&
    typeof value.originalImpactTitle === "string" &&
    typeof value.revisedImpactTitle === "string" &&
    typeof value.originalImpactScore === "number" &&
    typeof value.revisedImpactScore === "number" &&
    typeof value.impactDelta === "number" &&
    typeof value.originalConsensusDelta === "number" &&
    typeof value.revisedConsensusDelta === "number" &&
    typeof value.suggestion === "string" &&
    typeof value.improved === "boolean" &&
    (value.originalCharsPerMinute === undefined ||
      typeof value.originalCharsPerMinute === "number") &&
    (value.revisedCharsPerMinute === undefined ||
      typeof value.revisedCharsPerMinute === "number") &&
    (value.originalRubric === undefined ||
      isRetrainRubric(value.originalRubric)) &&
    (value.revisedRubric === undefined || isRetrainRubric(value.revisedRubric))
  );
}

function isTrainingRecord(value: unknown): value is TrainingRecord {
  if (!isObject(value) || !isObject(value.report)) return false;
  const report = value.report;
  return (
    typeof value.id === "string" &&
    typeof value.completedAt === "string" &&
    !Number.isNaN(Date.parse(value.completedAt)) &&
    typeof value.scenarioId === "string" &&
    (value.scenario === undefined || ScenarioSchema.safeParse(value.scenario).success) &&
    (SCENARIO_IDS.includes(value.scenarioId as (typeof SCENARIO_IDS)[number]) ||
      (value.scenarioId.startsWith("custom-") &&
        ScenarioSchema.safeParse(value.scenario).success)) &&
    DIFFICULTY_IDS.includes(value.difficulty as (typeof DIFFICULTY_IDS)[number]) &&
    typeof value.turns === "number" &&
    typeof value.consensus === "number" &&
    Array.isArray(value.finalists) &&
    value.finalists.every((item) => typeof item === "string") &&
    typeof value.finalStatement === "string" &&
    Array.isArray(value.influence) &&
    typeof report.total === "number" &&
    typeof report.level === "string" &&
    Array.isArray(report.dimensions) &&
    report.dimensions.every(
      (dimension) =>
        isObject(dimension) &&
        typeof dimension.key === "string" &&
        typeof dimension.label === "string" &&
        typeof dimension.score === "number" &&
        typeof dimension.max === "number" &&
        typeof dimension.summary === "string",
    ) &&
    typeof report.strength === "string" &&
    typeof report.focus === "string" &&
    typeof report.evidence === "string" &&
    (value.retrainAttempts === undefined ||
      (Array.isArray(value.retrainAttempts) &&
        value.retrainAttempts.every(isRetrainAttempt)))
  );
}

function browserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}

export function parseTrainingHistory(raw: string | null): TrainingRecord[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isTrainingRecord)
      .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
      .slice(0, MAX_HISTORY_RECORDS);
  } catch {
    return [];
  }
}

export function readTrainingHistory(
  storage: Pick<Storage, "getItem"> | undefined = browserStorage(),
): TrainingRecord[] {
  if (!storage) return [];
  try {
    return parseTrainingHistory(storage.getItem(TRAINING_HISTORY_KEY));
  } catch {
    return [];
  }
}

export function appendTrainingRecord(
  records: TrainingRecord[],
  record: TrainingRecord,
): TrainingRecord[] {
  return [record, ...records.filter((item) => item.id !== record.id)]
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .slice(0, MAX_HISTORY_RECORDS);
}

export function appendRetrainAttempt(
  records: TrainingRecord[],
  recordId: string,
  attempt: RetrainAttempt,
): TrainingRecord[] {
  return records.map((record) =>
    record.id === recordId
      ? (() => {
          const withoutDuplicate = (record.retrainAttempts ?? []).filter(
            (item) => item.id !== attempt.id,
          );
          const sameTurn = [
            attempt,
            ...withoutDuplicate.filter(
              (item) => item.targetTurn === attempt.targetTurn,
            ),
          ].slice(0, RETRAIN_CHALLENGE_LIMIT);
          const otherTurns = withoutDuplicate.filter(
            (item) => item.targetTurn !== attempt.targetTurn,
          );
          return {
            ...record,
            retrainAttempts: [...sameTurn, ...otherTurns]
              .sort((left, right) =>
                right.completedAt.localeCompare(left.completedAt),
              )
              .slice(0, 20),
          };
        })()
      : record,
  );
}

export function persistTrainingHistory(
  records: TrainingRecord[],
  storage: Pick<Storage, "setItem"> | undefined = browserStorage(),
) {
  if (!storage) return;
  try {
    storage.setItem(TRAINING_HISTORY_KEY, JSON.stringify(records));
  } catch {
    // A full or unavailable browser store should never block the report itself.
  }
}

export function createTrainingRecord(
  state: GroupState,
  completedAt = new Date().toISOString(),
  id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
): TrainingRecord {
  return {
    id,
    completedAt,
    scenarioId: state.scenarioId,
    scenario: state.scenario,
    difficulty: state.difficulty,
    turns: state.turn,
    consensus: state.consensus,
    finalists: state.finalists.slice(0, 2),
    finalStatement: state.finalStatement,
    influence: state.influence,
    report: buildReport(state),
    retrainAttempts: [],
  };
}

export function dimensionPercent(record: TrainingRecord, key: ScoreKey) {
  const dimension = record.report.dimensions.find((item) => item.key === key);
  if (!dimension || dimension.max <= 0) return 0;
  return Math.round((dimension.score / dimension.max) * 100);
}

export function weakestDimension(records: TrainingRecord[]) {
  const latest = records[0];
  if (!latest) return undefined;
  return [...latest.report.dimensions].sort(
    (left, right) => left.score / left.max - right.score / right.max,
  )[0];
}
