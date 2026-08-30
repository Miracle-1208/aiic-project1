import { describe, expect, it } from "vitest";

import {
  CUSTOM_SCENARIOS_KEY,
  parseCustomScenarios,
  persistCustomScenarios,
  readCustomScenarios,
  removeCustomScenario,
  upsertCustomScenario,
} from "./custom-scenarios";
import { scenarios } from "./scenario";
import type { Scenario } from "./types";

function customScenario(id = "custom-test-case"): Scenario {
  return { ...scenarios[0], id: id as Scenario["id"], caseNumber: "CUSTOM" };
}

describe("custom scenario storage", () => {
  it("accepts complete custom scenarios and ignores corrupt entries", () => {
    const valid = customScenario();
    const parsed = parseCustomScenarios(
      JSON.stringify([valid, { id: "custom-broken" }, scenarios[0]]),
    );

    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("custom-test-case");
  });

  it("upserts, removes and persists the device-local library", () => {
    let stored: string | null = null;
    const storage = {
      getItem: (key: string) => (key === CUSTOM_SCENARIOS_KEY ? stored : null),
      setItem: (key: string, value: string) => {
        if (key === CUSTOM_SCENARIOS_KEY) stored = value;
      },
    };
    const first = customScenario("custom-first");
    const updated = { ...first, title: "修改后的岗位群面题" };
    const records = upsertCustomScenario([first], updated);

    persistCustomScenarios(records, storage);

    expect(readCustomScenarios(storage)[0].title).toBe("修改后的岗位群面题");
    expect(removeCustomScenario(records, first.id)).toEqual([]);
  });
});
