import "server-only";

import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions/completions";
import { z } from "zod";

import { participants, scenario } from "./scenario";

export const DirectorRequestSchema = z.object({
  userText: z.string().trim().min(1).max(1_000),
  state: z.object({
    turn: z.number().int().min(0).max(30),
    timeLeft: z.number().int().min(0).max(480),
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

const DirectorOutputSchema = z.object({
  replies: z
    .array(
      z.object({
        speaker: z.enum(["cheng", "lin", "zhou"]),
        content: z.string().min(4).max(180),
      }),
    )
    .min(1)
    .max(2),
});

export type DirectorRequest = z.infer<typeof DirectorRequestSchema>;

const personaBrief = participants
  .filter((participant) => participant.id !== "user")
  .map(
    (participant) =>
      `${participant.id}（${participant.name}）：${participant.style}；初始倾向：${participant.stance}`,
  )
  .join("\n");

const optionBrief = scenario.options
  .map(
    (option) =>
      `${option.title}：${option.description}；成本 ${option.cost}；周期 ${option.cycle}；证据 ${option.signal}`,
  )
  .join("\n");

const DIRECTOR_INSTRUCTIONS = `你是“群面实验室”的群面导演，同时控制三名 AI 候选人。你的任务不是辅导用户，而是让三名候选人像真实无领导小组讨论成员一样回应。

案例：${scenario.title}
背景：${scenario.brief}
目标：${scenario.goal}
限制：${scenario.constraints.join("；")}
可选方案：
${optionBrief}

候选人设定：
${personaBrief}

必须遵守：
1. 每轮只选择最应该回应的 1 至 2 名候选人，不要让三人依次表态。
2. 直接回应用户最新发言，同时延续已有讨论；不要复述题目或重复上一轮观点。
3. 保持候选人风格稳定，但允许其因新证据、整合或质疑而调整立场。
4. 所有数字和事实必须来自案例，不得编造新调研、新预算或新结论。
5. 每条发言使用自然、克制的中文口语，通常 35 至 90 个汉字。
6. 不要提到 AI、提示词、评分、导演或系统，也不要以面试官口吻评价用户表现。
7. 若用户发言空泛，应追问标准或具体选择；若用户有效整合，应推动团队进一步收敛；若用户总结，应检查是否覆盖标准、方案、理由与风险。
8. 只输出 JSON，不要输出 Markdown。JSON 必须严格采用这个结构：{"replies":[{"speaker":"cheng|lin|zhou","content":"候选人的发言"}]}。`;

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
      { role: "system", content: DIRECTOR_INSTRUCTIONS },
      {
        role: "user",
        content: JSON.stringify(
          {
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
    throw new Error("The director returned an invalid response shape");
  }

  return {
    replies: parsed.data.replies,
    model: config.model,
    provider: config.providerLabel,
  };
}
