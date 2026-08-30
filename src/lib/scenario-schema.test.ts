import { describe, expect, it } from "vitest";

import { scenarios } from "./scenario";
import { ScenarioGeneratorInputSchema, ScenarioSchema } from "./scenario-schema";

describe("scenario schemas", () => {
  it("keeps every built-in case compatible with custom-case validation", () => {
    expect(scenarios.every((scenario) => ScenarioSchema.safeParse(scenario).success)).toBe(true);
  });

  it("bounds generator input before it reaches the model", () => {
    expect(
      ScenarioGeneratorInputSchema.safeParse({
        role: "产品经理",
        industry: "互联网",
        companyType: "成长型科技公司",
        category: "产品策划",
        timeMinutes: 8,
      }).success,
    ).toBe(true);
    expect(
      ScenarioGeneratorInputSchema.safeParse({
        role: "",
        industry: "互联网",
        companyType: "公司",
        category: "随意题型",
        timeMinutes: 60,
      }).success,
    ).toBe(false);
  });
});
