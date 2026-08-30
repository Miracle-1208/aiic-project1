import type { Scenario, SpeakerId, TrainingDifficulty } from "./types";

export const CONTRAST_VAGUE_LINE = "我们结合一下大家意见，先总结再推进。";

type CandidateSpeaker = Extract<SpeakerId, "cheng" | "lin" | "zhou">;

function normalizeForMatch(text: string) {
  return text.toLowerCase().replace(/\s+/g, "");
}

function optionMentionedBy(
  scenario: Scenario,
  speaker: CandidateSpeaker,
) {
  const opening = scenario.openingMessages.find(
    (message) => message.speaker === speaker,
  )?.content;
  const sources = [opening, scenario.participantStances[speaker]].filter(
    (source): source is string => Boolean(source),
  );

  for (const source of sources) {
    const normalizedSource = normalizeForMatch(source);
    const matches = scenario.options.flatMap((option) =>
      (scenario.optionAliases[option.id] ?? [option.title])
        .map((alias) => ({
          index: normalizedSource.indexOf(normalizeForMatch(alias)),
          title: option.title,
        }))
        .filter((match) => match.index >= 0),
    );
    const earliest = matches.sort((left, right) => left.index - right.index)[0];
    if (earliest) return earliest.title;
  }

  return undefined;
}

function cleanConflictPhrase(value: string) {
  return value
    .replace(/[，,。！？?!：:；;]/g, "")
    .replace(/^(应该|究竟|到底|是要|要不要|是否)/, "")
    .trim();
}

function conflictSides(scenario: Scenario) {
  const parts = scenario.initialConflict
    .split(/还是|或者|或是|\bvs\.?\b/i)
    .map(cleanConflictPhrase)
    .filter(Boolean);

  return {
    left: parts[0] || scenario.participantStances.cheng,
    right: parts[1] || scenario.participantStances.lin,
  };
}

export function buildContrastLines(
  scenario: Scenario,
  difficulty: TrainingDifficulty = "standard",
) {
  const distinctOptions = scenario.options.filter(
    (option, index, options) =>
      options.findIndex((candidate) => candidate.title === option.title) === index,
  );
  const optionA = distinctOptions[0]?.title ?? "第一个候选方案";
  const optionB = distinctOptions[1]?.title ?? optionA;
  const { left, right } = conflictSides(scenario);
  const chengAnchor = optionMentionedBy(scenario, "cheng") ?? left;
  const zhouAnchor = optionMentionedBy(scenario, "zhou") ?? right;
  const pressureClause =
    difficulty === "pressure"
      ? `同时回应周可关于${zhouAnchor}的质疑。`
      : "";

  return {
    vague: CONTRAST_VAGUE_LINE,
    grounded: `结合程野围绕${chengAnchor}的${left}主张和林乔强调的${right}，先做${optionA}，再验证${optionB}。${pressureClause}`,
  };
}
