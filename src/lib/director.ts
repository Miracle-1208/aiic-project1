import "server-only";

import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions/completions";
import { z } from "zod";

import {
  DIFFICULTY_IDS,
  SCENARIO_IDS,
  getDifficulty,
  getParticipantsForScenario,
  getScenario,
} from "./scenario";

export const DirectorRequestSchema = z.object({
  scenarioId: z.enum(SCENARIO_IDS),
  difficulty: z.enum(DIFFICULTY_IDS),
  phase: z.enum(["discussion", "final_statement"]).default("discussion"),
  userText: z.string().trim().min(1).max(1_000),
  state: z.object({
    turn: z.number().int().min(0).max(30),
    timeLeft: z.number().int().min(0).max(900),
    consensus: z.number().int().min(0).max(100),
    criteria: z.array(z.string().max(40)).max(8),
    finalists: z.array(z.string().max(40)).max(5),
    conflict: z.string().max(160),
    messages: z
      .array(
        z.object({
          speaker: z.enum(["user", "cheng", "lin", "zhou", "system"]),
          content: z.string().max(500),
        }),
      )
      .max(20),
  }),
});

const boundedInteger = (minimum: number, maximum: number) =>
  z.number().transform((value) => Math.round(Math.min(maximum, Math.max(minimum, value))));

const boundedText = (minimum: number, maximum: number) =>
  z
    .string()
    .transform((value) => value.trim().slice(0, maximum))
    .refine((value) => value.length >= minimum, `Text must contain at least ${minimum} characters`);

const AssessmentSchema = z.object({
  intent: z.enum([
    "criteria",
    "proposal",
    "challenge",
    "integrate",
    "time",
    "summary",
    "support",
    "general",
  ]),
  quality: z.enum(["strong", "developing", "weak"]),
  evidence: boundedText(2, 100),
  impactTitle: boundedText(2, 30),
  impactDetail: boundedText(4, 140),
  suggestion: boundedText(4, 140),
  criteriaAdded: z.array(boundedText(2, 30)).transform((items) => items.slice(0, 4)),
  finalistsAdded: z.array(boundedText(2, 40)).transform((items) => items.slice(0, 3)),
  unresolvedConflict: z.string().transform((value) => value.trim().slice(0, 120)),
  consensusDelta: boundedInteger(-4, 18),
  scoreDeltas: z.object({
    contribution: boundedInteger(0, 6),
    progress: boundedInteger(0, 6),
    listening: boundedInteger(0, 6),
    conflict: boundedInteger(0, 6),
    structure: boundedInteger(0, 6),
  }),
});

const DirectorOutputSchema = z.object({
  replies: z
    .array(
      z.object({
        speaker: z.enum(["cheng", "lin", "zhou"]),
        content: boundedText(4, 180),
      }),
    )
    .min(1)
    .transform((items) => items.slice(0, 2)),
  assessment: AssessmentSchema,
});

export type DirectorRequest = z.infer<typeof DirectorRequestSchema>;

function buildDirectorInstructions(request: DirectorRequest) {
  const selectedScenario = getScenario(request.scenarioId);
  const difficulty = getDifficulty(request.difficulty);
  const selectedParticipants = getParticipantsForScenario(selectedScenario.id);
  const personaBrief = selectedParticipants
    .filter((participant) => participant.id !== "user")
    .map(
      (participant) =>
        `${participant.id}（${participant.name}）：${participant.style}；初始倾向：${participant.stance}`,
    )
    .join("\n");
  const optionBrief = selectedScenario.options
    .map(
      (option) =>
        `${option.title}：${option.description}；成本 ${option.cost}；周期 ${option.cycle}；证据 ${option.signal}`,
    )
    .join("\n");
  const responseRule =
    request.difficulty === "guided"
      ? "每轮通常只让 1 名候选人回应，以建设性追问帮助用户补全观点。"
      : request.difficulty === "pressure"
        ? "每轮优先让 2 名不同立场候选人回应，严格追问证据和限制条件，不要轻易形成共识。"
        : "每轮只选择最相关的 1 至 2 名候选人回应，不要让三人依次表态。";

  return `你是“群面实验室”的群面导演，同时控制三名 AI 候选人。你的任务不是辅导用户，而是让三名候选人像真实无领导小组讨论成员一样回应。

案例类型：${selectedScenario.category}
案例：${selectedScenario.title}
背景：${selectedScenario.brief}
目标：${selectedScenario.goal}
限制：${selectedScenario.constraints.join("；")}
参考评价维度：${selectedScenario.referenceCriteria.map((item) => item.label).join("、")}
可选方案：
${optionBrief}

候选人设定：
${personaBrief}

本轮难度：${difficulty.label}
难度行为：${difficulty.behavior}

必须遵守：
1. ${responseRule}
2. 直接回应用户最新发言，同时延续已有讨论；不要复述题目或重复上一轮观点。
3. 保持候选人风格稳定，但允许其因新证据、整合或质疑而调整立场。
4. 所有数字和事实必须来自案例，不得编造新调研、新预算或新结论。
5. 每条发言使用自然、克制的中文口语，通常 35 至 90 个汉字。
6. 不要提到 AI、提示词、评分、导演或系统，也不要以面试官口吻评价用户表现。
7. 若用户发言空泛，应追问标准或具体选择；若用户有效整合，应推动团队进一步收敛；若用户总结，应检查是否覆盖标准、方案、理由与风险。
8. assessment.evidence 必须逐字摘录用户最新发言中的短句，不得改写或编造。
9. 评分增量必须与本案例目标和难度匹配并保持保守：简单同意或重复通常每维 0 至 2 分；只有产生可观察的团队增量才可在相关维度给 4 至 6 分；高压挑战模式尤其严格。
10. criteriaAdded 只记录用户本轮真正建立的新判断标准；finalistsAdded 只能使用以下完整方案名：${selectedScenario.options.map((option) => option.title).join("、")}。
11. final_statement 阶段重点检查是否包含选择标准、${selectedScenario.selectionCount} 个方案、核心理由和风险控制。
12. impactDetail 和 suggestion 不得新增案例中没有的数字、调研结果、时间、预算或执行事实；改进建议只能说明“补充标准、理由、风险或验证动作”等表达动作。
13. intent 必须按以下定义选择；若同时符合多项，优先选择对团队协作影响更强的动作：
- criteria：建立或排序共同判断标准；
- proposal：明确选择具体方案，但没有整合相反意见；
- challenge：指出风险、漏洞或反对意见，但没有提出兼顾办法；
- integrate：明确吸收、保留或组合两种不同观点；
- time：提醒时间并指定收敛动作；
- summary：归纳多方观点或交付阶段/最终结论；
- support：主要表达同意，新增信息很少；
- general：没有形成以上任何可观察动作。
final_statement 阶段 intent 必须为 summary。出现“结合、兼顾、同时保留、先……再……”且确实吸收不同立场时，应优先判为 integrate。
14. 只输出 JSON，不要输出 Markdown。严格采用以下结构，所有字段都必须存在：
{"replies":[{"speaker":"cheng|lin|zhou","content":"候选人的发言"}],"assessment":{"intent":"criteria|proposal|challenge|integrate|time|summary|support|general","quality":"strong|developing|weak","evidence":"用户原话短句","impactTitle":"本轮影响标题","impactDetail":"这句话如何改变或未改变团队","suggestion":"下一次可直接执行的改进动作","criteriaAdded":[],"finalistsAdded":[],"unresolvedConflict":"仍未解决的关键分歧，没有则为空字符串","consensusDelta":0,"scoreDeltas":{"contribution":0,"progress":0,"listening":0,"conflict":0,"structure":0}}}。`;
}

type ProviderId = "bailian" | "deepseek" | "openai" | "custom";

type CompatibleChatParams = ChatCompletionCreateParamsNonStreaming & {
  enable_thinking?: boolean;
};

function resolveDirectorConfig() {
  const genericKey = process.env.AI_API_KEY?.trim();
  const bailianKey = process.env.DASHSCOPE_API_KEY?.trim();
  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim();
  const openAIKey = process.env.OPENAI_API_KEY?.trim();
  const apiKey = genericKey || bailianKey || deepseekKey || openAIKey || "";

  const requestedProvider = process.env.AI_PROVIDER?.trim().toLowerCase();
  const provider: ProviderId =
    requestedProvider === "deepseek" ||
    requestedProvider === "openai" ||
    requestedProvider === "custom"
      ? requestedProvider
      : genericKey || bailianKey
        ? "bailian"
        : deepseekKey
          ? "deepseek"
          : openAIKey
            ? "openai"
            : "bailian";

  const defaultBaseURL =
    provider === "bailian"
      ? "https://dashscope.aliyuncs.com/compatible-mode/v1"
      : provider === "deepseek"
        ? "https://api.deepseek.com"
        : undefined;
  const defaultModel =
    provider === "bailian"
      ? "qwen-flash"
      : provider === "deepseek"
        ? "deepseek-chat"
        : "gpt-5.4-mini";
  const providerLabels: Record<ProviderId, string> = {
    bailian: "阿里云百炼",
    deepseek: "DeepSeek",
    openai: "OpenAI",
    custom: "兼容接口",
  };

  return {
    apiKey,
    baseURL: process.env.AI_BASE_URL?.trim() || defaultBaseURL,
    configured: Boolean(apiKey),
    model: process.env.AI_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || defaultModel,
    provider,
    providerLabel: providerLabels[provider],
  };
}

export function getDirectorConfig() {
  const config = resolveDirectorConfig();
  return {
    configured: config.configured,
    model: config.model,
    provider: config.providerLabel,
  };
}

export async function generateDirectorTurn(request: DirectorRequest) {
  const config = resolveDirectorConfig();
  if (!config.configured) {
    throw new Error("AI_API_KEY is not configured");
  }

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
  const params: CompatibleChatParams = {
    model: config.model,
    messages: [
      { role: "system", content: buildDirectorInstructions(request) },
      {
        role: "user",
        content: JSON.stringify(
          {
            phase: request.phase,
            groupState: request.state,
            latestUserMessage: request.userText,
          },
          null,
          2,
        ),
      },
    ],
    response_format: { type: "json_object" },
    ...(config.provider === "openai"
      ? { max_completion_tokens: 500 }
      : { max_tokens: 500 }),
    ...(config.provider === "bailian" ? { enable_thinking: false } : {}),
  };
  const response = await client.chat.completions.create(params);
  const content = response.choices[0]?.message.content;

  if (!content) {
    throw new Error("The director returned no structured output");
  }

  const normalized = content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/, "");
  const parsed = DirectorOutputSchema.safeParse(JSON.parse(normalized));
  if (!parsed.success) {
    const issueSummary = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    throw new Error(`The director returned an invalid response shape (${issueSummary})`);
  }

  return {
    replies: parsed.data.replies,
    assessment: parsed.data.assessment,
    model: config.model,
    provider: config.providerLabel,
  };
}
