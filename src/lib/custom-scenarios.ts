import { ScenarioSchema } from "./scenario-schema";
import type { Scenario } from "./types";

export const CUSTOM_SCENARIOS_KEY = "grouplab.custom-scenarios.v1";
const MAX_CUSTOM_SCENARIOS = 12;

function browserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}

export function parseCustomScenarios(raw: string | null): Scenario[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ScenarioSchema.safeParse(item))
      .filter((result) => result.success && result.data.id.startsWith("custom-"))
      .map((result) => result.data as Scenario)
      .slice(0, MAX_CUSTOM_SCENARIOS);
  } catch {
    return [];
  }
}

export function readCustomScenarios(
  storage: Pick<Storage, "getItem"> | undefined = browserStorage(),
) {
  if (!storage) return [];
  try {
    return parseCustomScenarios(storage.getItem(CUSTOM_SCENARIOS_KEY));
  } catch {
    return [];
  }
}

export function upsertCustomScenario(
  scenarios: Scenario[],
  scenario: Scenario,
) {
  return [scenario, ...scenarios.filter((item) => item.id !== scenario.id)].slice(
    0,
    MAX_CUSTOM_SCENARIOS,
  );
}

export function removeCustomScenario(scenarios: Scenario[], scenarioId: string) {
  return scenarios.filter((scenario) => scenario.id !== scenarioId);
}

export function persistCustomScenarios(
  scenarios: Scenario[],
  storage: Pick<Storage, "setItem"> | undefined = browserStorage(),
) {
  if (!storage) return;
  try {
    storage.setItem(CUSTOM_SCENARIOS_KEY, JSON.stringify(scenarios));
  } catch {
    // A full or unavailable browser store should not block built-in training.
  }
}
