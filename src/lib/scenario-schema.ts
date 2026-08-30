import { z } from "zod";

import type { Scenario } from "./types";

const boundedText = (maximum: number) => z.string().trim().min(1).max(maximum);

const RawScenarioSchema = z.object({
  id: z.string().trim().min(3).max(80),
  category: boundedText(20),
  caseNumber: boundedText(20),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i),
  title: boundedText(60),
  company: boundedText(60),
  brief: boundedText(500),
  goal: boundedText(300),
  timeLimit: z.number().int().min(300).max(900),
  selectionCount: z.number().int().min(1).max(3),
  initialConsensus: z.number().int().min(8).max(50),
  initialConflict: boundedText(160),
  constraints: z.array(boundedText(100)).min(2).max(5),
  facts: z
    .array(
      z.object({
        label: boundedText(20),
        value: boundedText(40),
      }),
    )
    .min(3)
    .max(5),
  options: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(40),
        title: boundedText(40),
        description: boundedText(160),
        cost: boundedText(30),
        cycle: boundedText(30),
        signal: boundedText(100),
      }),
    )
    .min(4)
    .max(6),
  referenceCriteria: z
    .array(
      z.object({
        label: boundedText(30),
        keywords: z.array(boundedText(20)).min(2).max(8),
      }),
    )
    .min(3)
    .max(6),
  optionAliases: z.record(
    z.string().max(40),
    z.array(boundedText(40)).min(1).max(6),
  ),
  participantStances: z.object({
    cheng: boundedText(100),
    lin: boundedText(100),
    zhou: boundedText(100),
  }),
  openingMessages: z
    .array(
      z.object({
        speaker: z.enum(["cheng", "lin", "zhou"]),
        content: boundedText(220),
      }),
    )
    .length(3),
  quickActions: z.tuple([
    boundedText(120),
    boundedText(120),
    boundedText(120),
  ]),
  fallbackFinalists: z.tuple([boundedText(40), boundedText(40)]),
}).superRefine((scenario, context) => {
  const optionIds = scenario.options.map((option) => option.id);
  const optionTitles = scenario.options.map((option) => option.title);
  if (new Set(optionIds).size !== optionIds.length) {
    context.addIssue({ code: "custom", path: ["options"], message: "Option ids must be unique" });
  }
  if (new Set(optionTitles).size !== optionTitles.length) {
    context.addIssue({ code: "custom", path: ["options"], message: "Option titles must be unique" });
  }
  scenario.options.forEach((option, index) => {
    if (!(scenario.optionAliases[option.id] ?? []).includes(option.title)) {
      context.addIssue({
        code: "custom",
        path: ["optionAliases", option.id],
        message: `Aliases for option ${index + 1} must include its title`,
      });
    }
  });
  scenario.fallbackFinalists.forEach((title, index) => {
    if (!optionTitles.includes(title)) {
      context.addIssue({
        code: "custom",
        path: ["fallbackFinalists", index],
        message: "Fallback finalist must match an option title",
      });
    }
  });
});

export const ScenarioSchema = RawScenarioSchema as unknown as z.ZodType<Scenario>;

export const ScenarioGeneratorInputSchema = z.object({
  role: boundedText(40),
  industry: boundedText(40),
  companyType: boundedText(60),
  category: z.enum(["资源分配", "危机决策", "产品策划", "运营决策"]),
  timeMinutes: z.number().int().min(5).max(15),
});
