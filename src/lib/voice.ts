import type { ExpressionReport, VoiceTurnMetric } from "./types";

export function buildExpressionReport(
  metrics: VoiceTurnMetric[],
): ExpressionReport | undefined {
  if (!metrics.length) return undefined;

  const totalSeconds = metrics.reduce(
    (sum, metric) => sum + Math.max(1, metric.durationSeconds),
    0,
  );
  const totalCharacters = metrics.reduce(
    (sum, metric) => sum + Math.max(0, metric.characterCount),
    0,
  );
  const pauseCount = metrics.reduce(
    (sum, metric) => sum + Math.max(0, metric.pauseCount),
    0,
  );
  const averageCharsPerMinute = Math.round(
    (totalCharacters / totalSeconds) * 60,
  );
  const pausesPerMinute = (pauseCount / totalSeconds) * 60;
  const paceLabel: ExpressionReport["paceLabel"] =
    averageCharsPerMinute < 160
      ? "偏慢"
      : averageCharsPerMinute <= 280
        ? "稳健"
        : averageCharsPerMinute <= 360
          ? "偏快"
          : "过快";

  let suggestion = "保持当前节奏，在结论和理由之间留出短停顿，让重点更容易被听见。";
  if (paceLabel === "偏慢") {
    suggestion = "先说结论，再用两点理由展开；减少重复铺垫，让表达更紧凑。";
  } else if (paceLabel === "偏快" || paceLabel === "过快") {
    suggestion = "每说完一个核心判断停半拍，并把长句拆成“结论—理由—动作”三段。";
  } else if (pausesPerMinute > 8) {
    suggestion = "发言前先默排三点提纲，减少句中寻找措辞造成的频繁停顿。";
  }

  return {
    voiceTurns: metrics.length,
    totalSeconds,
    averageCharsPerMinute,
    pauseCount,
    paceLabel,
    summary: `共完成 ${metrics.length} 次语音发言，累计 ${totalSeconds} 秒；平均每分钟约 ${averageCharsPerMinute} 字，记录到 ${pauseCount} 次明显停顿。`,
    suggestion,
  };
}
