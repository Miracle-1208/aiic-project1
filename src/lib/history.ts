import { DIFFICULTY_IDS, SCENARIO_IDS } from "./scenario";
import { buildReport } from "./scoring";
import type {
  GroupState,
  ScoreKey,
  TrainingRecord,
} from "./types";

export const TRAINING_HISTORY_KEY = "grouplab.training-history.v1";
const MAX_HISTORY_RECORDS = 50;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isTrainingRecord(value: unknown): value is TrainingRecord {
  if (!isObject(value) || !isObject(value.report)) return false;
  const report = value.report;
  return (
    typeof value.id === "string" &&
    typeof value.completedAt === "string" &&
    !Number.isNaN(Date.parse(value.completedAt)) &&
    SCENARIO_IDS.includes(value.scenarioId as (typeof SCENARIO_IDS)[number]) &&
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
    typeof report.evidence === "string"
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
    difficulty: state.difficulty,
    turns: state.turn,
    consensus: state.consensus,
    finalists: state.finalists.slice(0, 2),
    finalStatement: state.finalStatement,
    influence: state.influence,
    report: buildReport(state),
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
