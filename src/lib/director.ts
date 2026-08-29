import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
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
7. 若用户发言空泛，应追问标准或具体选择；若用户有效整合，应推动团队进一步收敛；若用户总结，应检查是否覆盖标准、方案、理由与风险。`;

export function getDirectorConfig() {
  return {
    configured: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini",
  };
}

export async function generateDirectorTurn(request: DirectorRequest) {
  const config = getDirectorConfig();
  if (!config.configured) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.parse({
    model: config.model,
    instructions: DIRECTOR_INSTRUCTIONS,
    input: JSON.stringify(
      {
        groupState: request.state,
        latestUserMessage: request.userText,
      },
      null,
      2,
    ),
    reasoning: { effort: "low" },
    text: {
      format: zodTextFormat(DirectorOutputSchema, "group_interview_replies"),
      verbosity: "low",
    },
    max_output_tokens: 500,
    prompt_cache_key: "group-lab-director-v1",
    store: false,
  });

  if (!response.output_parsed) {
    throw new Error("The director returned no structured output");
  }

  return {
    replies: response.output_parsed.replies,
    model: config.model,
  };
}
