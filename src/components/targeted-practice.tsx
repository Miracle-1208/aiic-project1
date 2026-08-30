"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Gauge,
  Mic,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useSpeechInput, useSpeechPlayback } from "@/hooks/use-browser-voice";
import { requestDirectorTurn } from "@/lib/director-client";
import { applyUserTurn, finishSession, restoreTurnSnapshot } from "@/lib/engine";
import {
  bestRetrainAttempt,
  createRetrainAttempt,
  RETRAIN_CHALLENGE_LIMIT,
  retrainAttemptsForTurn,
} from "@/lib/retrain";
import { getDifficulty, getScenario } from "@/lib/scenario";
import type {
  DirectorTurn,
  GroupState,
  RetrainAttempt,
  VoiceCapture,
} from "@/lib/types";

const QUALITY_LABEL = {
  strong: "有效推进",
  developing: "仍可加强",
  weak: "增量有限",
};

function deltaLabel(value: number) {
  if (value > 0) return `+${value}`;
  return `${value}`;
}

export default function TargetedPractice({
  state,
  targetTurn,
  attempts,
  onBack,
  onSaved,
}: {
  state: GroupState;
  targetTurn: number;
  attempts: RetrainAttempt[];
  onBack: () => void;
  onSaved: (attempt: RetrainAttempt) => void;
}) {
  const restoredState = useMemo(
    () => restoreTurnSnapshot(state, targetTurn),
    [state, targetTurn],
  );
  const originalAssessment = state.assessments.find(
    (assessment) => assessment.turn === targetTurn,
  );
  const originalMessage = state.messages.find(
    (message) => message.speaker === "user" && message.turn === targetTurn,
  );
  const originalVoiceMetric = state.voiceMetrics.find(
    (metric) => metric.turn === targetTurn,
  );
  const isFinalStatement =
    Boolean(state.finalStatement) && targetTurn === state.turn;
  const scenario = state.scenario ?? getScenario(state.scenarioId);
  const difficulty = getDifficulty(state.difficulty);
  const [input, setInput] = useState("");
  const [voiceCapture, setVoiceCapture] = useState<VoiceCapture | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<RetrainAttempt | null>(null);
  const challengeAttempts = useMemo(
    () =>
      retrainAttemptsForTurn(
        result ? [...attempts, result] : attempts,
        targetTurn,
      ),
    [attempts, result, targetTurn],
  );
  const controllerRef = useRef<AbortController | null>(null);
  const unmountedRef = useRef(false);
  const playback = useSpeechPlayback();
  const speechInput = useSpeechInput({
    value: input,
    onChange: setInput,
    onCapture: (capture) => {
      setVoiceCapture((current) => ({
        durationSeconds: (current?.durationSeconds ?? 0) + capture.durationSeconds,
        pauseCount: (current?.pauseCount ?? 0) + capture.pauseCount,
      }));
    },
  });

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      controllerRef.current?.abort();
    };
  }, []);

  const bestAttempt = bestRetrainAttempt(challengeAttempts);
  const challengeComplete =
    challengeAttempts.length >= RETRAIN_CHALLENGE_LIMIT;
  const showComparison = Boolean(result) || challengeComplete;
  const displayAttempt = result ?? bestAttempt;

  const toggleMicrophone = () => {
    playback.cancel();
    if (speechInput.isListening) speechInput.stop();
    else speechInput.start();
  };

  const submit = async () => {
    const revisedText = input.trim();
    const minimumLength = isFinalStatement ? 20 : 4;
    if (
      !restoredState ||
      !originalAssessment ||
      !originalMessage ||
      revisedText.length < minimumLength ||
      isAnalyzing ||
      speechInput.isListening ||
      challengeComplete
    ) {
      return;
    }

    setIsAnalyzing(true);
    setNotice("");
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    let directorTurn: DirectorTurn | undefined;

    try {
      directorTurn = await requestDirectorTurn(
        restoredState,
        revisedText,
        isFinalStatement ? "final_statement" : "discussion",
        controller.signal,
      );
    } catch (error) {
      const isNotConfigured =
        error instanceof Error && error.message === "AI_NOT_CONFIGURED";
      setNotice(
        isNotConfigured
          ? "当前未配置实时 AI，本次使用本地证据规则完成对比。"
          : "实时 AI 暂时未响应，本次已自动使用本地证据规则。",
      );
    } finally {
      window.clearTimeout(timeout);
      controllerRef.current = null;
    }

    if (unmountedRef.current) return;

    const revisedState = isFinalStatement
      ? finishSession(restoredState, revisedText, directorTurn, voiceCapture ?? undefined)
      : applyUserTurn(restoredState, revisedText, directorTurn, voiceCapture ?? undefined);
    const revisedAssessment = revisedState.assessments.at(-1);
    if (!revisedAssessment) {
      setIsAnalyzing(false);
      setNotice("这次没有生成有效对比，请重新尝试。");
      return;
    }
    const revisedVoiceMetric = revisedState.voiceMetrics.find(
      (metric) => metric.turn === targetTurn,
    );
    const attempt = createRetrainAttempt({
      targetTurn,
      originalText: originalMessage.content,
      revisedText,
      originalAssessment,
      revisedAssessment,
      originalVoiceMetric,
      revisedVoiceMetric,
    });
    setResult(attempt);
    setIsAnalyzing(false);
    onSaved(attempt);

    const replyText = revisedState.messages
      .slice(restoredState.messages.length)
      .filter((message) => message.speaker !== "user" && message.speaker !== "system")
      .map((message) => message.content)
      .join("。下一位候选人说：");
    playback.speak(replyText || "专项重练完成，请查看新旧表现对比。");
  };

  const resetAttempt = () => {
    playback.cancel();
    setInput("");
    setVoiceCapture(null);
    setResult(null);
    setNotice("");
    speechInput.clearNotice();
  };

  if (!restoredState || !originalAssessment || !originalMessage) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f7fa] p-6">
        <div className="max-w-lg rounded-[28px] border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-xl font-black text-slate-950">这一轮暂时无法恢复</h1>
          <p className="mt-3 text-sm leading-7 text-slate-500">旧版本训练没有保存轮次快照，请完成一场新的训练后再使用专项重练。</p>
          <button type="button" onClick={onBack} className="mt-6 h-12 rounded-2xl bg-indigo-600 px-6 text-sm font-black text-white">返回报告</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7fa]">
      <header className="mx-auto flex w-full max-w-[1240px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-2xl bg-[#111827] text-white"><Users className="size-5" /></div>
          <div>
            <p className="text-[17px] font-black text-slate-950">群面实验室</p>
            <p className="text-[9px] font-black tracking-[0.16em] text-indigo-500">TARGETED PRACTICE</p>
          </div>
        </div>
        <button type="button" onClick={onBack} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-500 transition hover:text-slate-950"><ArrowLeft className="size-3.5" /> 返回报告</button>
      </header>

      <section className="mx-auto max-w-[1120px] px-5 pb-20 pt-4 sm:px-8 lg:px-12">
        <div className="overflow-hidden rounded-[32px] bg-[#111827] p-7 text-white shadow-2xl shadow-slate-950/15 sm:p-9">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-2 text-xs font-black tracking-[0.12em] text-indigo-300"><Target className="size-4" /> 关键轮次重练</div>
              <h1 className="mt-3 text-3xl font-black tracking-[-0.045em]">回到第 {targetTurn} 轮，再说一次</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400">{scenario.title} · {difficulty.label} · {isFinalStatement ? "最终陈述" : "讨论发言"}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/[0.07] px-4 py-3"><p className="text-[9px] font-bold text-slate-500">当时共识</p><p className="mt-1 text-xl font-black">{restoredState.consensus}%</p></div>
              <div className="rounded-2xl bg-white/[0.07] px-4 py-3"><p className="text-[9px] font-bold text-slate-500">剩余时间</p><p className="mt-1 text-xl font-black">{Math.floor(restoredState.timeLeft / 60)}:{String(restoredState.timeLeft % 60).padStart(2, "0")}</p></div>
            </div>
          </div>
          <div className="mt-7 border-t border-white/10 pt-5">
            <div className="flex items-center justify-between text-[10px] font-black tracking-[0.1em] text-slate-400">
              <span>连续重练挑战</span>
              <span>{challengeAttempts.length} / {RETRAIN_CHALLENGE_LIMIT} 次</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {Array.from({ length: RETRAIN_CHALLENGE_LIMIT }, (_, index) => (
                <div
                  key={index}
                  className={`h-2 rounded-full ${index < challengeAttempts.length ? "bg-emerald-400" : index === challengeAttempts.length && !challengeComplete ? "bg-indigo-400" : "bg-white/10"}`}
                />
              ))}
            </div>
          </div>
        </div>

        {!showComparison ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <aside className="space-y-5">
              <section className="rounded-[28px] border border-slate-200 bg-white p-6">
                <p className="text-[10px] font-black tracking-[0.13em] text-slate-400">ORIGINAL TURN</p>
                <h2 className="mt-2 text-lg font-black text-slate-950">你当时这样说</h2>
                <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-7 text-slate-700">“{originalMessage.content}”</p>
                <div className="mt-4 flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${originalAssessment.quality === "strong" ? "bg-emerald-50 text-emerald-700" : originalAssessment.quality === "weak" ? "bg-amber-50 text-amber-700" : "bg-indigo-50 text-indigo-700"}`}>{QUALITY_LABEL[originalAssessment.quality]}</span><span className="text-xs font-black text-slate-800">{originalAssessment.impactTitle}</span></div>
                <p className="mt-3 text-xs leading-6 text-slate-500">{originalAssessment.impactDetail}</p>
              </section>
              <section className="rounded-[28px] border border-indigo-100 bg-indigo-50 p-6">
                <div className="flex items-center gap-2 text-xs font-black text-indigo-700"><Sparkles className="size-4" /> 这次重点改进</div>
                <p className="mt-3 text-sm font-bold leading-7 text-indigo-950">{originalAssessment.suggestion}</p>
              </section>
              <section className="rounded-[28px] border border-slate-200 bg-white p-6">
                <p className="text-xs font-black text-slate-900">当时的讨论现场</p>
                <div className="mt-3 space-y-2">
                  {restoredState.messages.slice(-3).map((message) => (
                    <div key={message.id} className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-500">{message.content}</div>
                  ))}
                </div>
                <p className="mt-4 text-[10px] font-bold leading-5 text-amber-700">仍待解决：{restoredState.conflict}</p>
              </section>
            </aside>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 sm:p-8">
              <div className="flex items-center gap-2 text-xs font-black text-indigo-700"><Zap className="size-4" /> 第 {challengeAttempts.length + 1} 次挑战</div>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-slate-950">用更好的方式推动团队</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">不要照抄原句。先交付结论，再补理由和下一步动作。</p>
              <textarea
                value={input}
                onChange={(event) => { setInput(event.target.value); speechInput.clearNotice(); }}
                disabled={isAnalyzing || speechInput.isListening}
                rows={9}
                autoFocus
                placeholder={isFinalStatement ? "重新完成最终陈述……" : "重新说出这一轮发言……"}
                className="mt-6 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-800 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-50"
              />
              <div className="mt-3 flex items-center gap-3">
                <button type="button" onClick={toggleMicrophone} disabled={isAnalyzing || !speechInput.isSupported} className={`flex h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-xs font-black text-white transition disabled:cursor-not-allowed disabled:opacity-30 ${speechInput.isListening ? "animate-pulse bg-rose-500" : "bg-indigo-600 hover:bg-indigo-700"}`}>
                  {speechInput.isListening ? <Square className="size-3 fill-current" /> : <Mic className="size-4" />}
                  {speechInput.isListening ? "结束口述" : "语音口述"}
                </button>
                <p className={`text-[10px] font-semibold leading-5 ${speechInput.notice || notice ? "text-amber-600" : speechInput.isListening ? "text-rose-600" : "text-slate-400"}`} aria-live="polite">
                  {speechInput.isListening ? `正在记录 · ${speechInput.elapsedSeconds} 秒` : speechInput.notice || notice || (voiceCapture ? `已记录 ${voiceCapture.durationSeconds} 秒、${voiceCapture.pauseCount} 次停顿` : "口述或打字都可以，提交后立即对比")}
                </p>
              </div>
              <button type="button" onClick={() => void submit()} disabled={isAnalyzing || speechInput.isListening || input.trim().length < (isFinalStatement ? 20 : 4)} className="mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-black text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-30">
                {isAnalyzing ? "正在比较新旧影响……" : `提交第 ${challengeAttempts.length + 1} 次挑战`} {isAnalyzing ? <Sparkles className="size-4 animate-pulse" /> : <Send className="size-4" />}
              </button>
            </section>
          </div>
        ) : displayAttempt ? (
          <div className="mt-6 space-y-6">
            <section className={`rounded-[28px] border p-7 sm:p-9 ${challengeComplete || displayAttempt.improved ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                <div>
                  <div className={`flex items-center gap-2 text-xs font-black ${challengeComplete || displayAttempt.improved ? "text-emerald-700" : "text-amber-700"}`}>
                    {challengeComplete || displayAttempt.improved ? <CheckCircle2 className="size-4" /> : <Target className="size-4" />}
                    {challengeComplete ? "三次挑战已完成，最佳版本已标出" : displayAttempt.improved ? "本次发言产生了更强影响" : "方向正确，还可以继续压缩和强化"}
                  </div>
                  <h2 className="mt-3 text-2xl font-black text-slate-950">第 {targetTurn} 轮连续重练对比</h2>
                  <p className="mt-2 text-xs font-semibold text-slate-500">原发言与每次尝试使用同一讨论现场和同一套评分规则。</p>
                </div>
                <div className={`rounded-2xl bg-white px-5 py-3 text-center shadow-sm ${(bestAttempt?.impactDelta ?? 0) > 0 ? "text-emerald-700" : "text-slate-700"}`}>
                  <p className="text-[9px] font-black text-slate-400">最佳综合提升</p>
                  <p className="mt-1 text-3xl font-black">{deltaLabel(bestAttempt?.impactDelta ?? 0)}</p>
                </div>
              </div>
            </section>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  id: "original",
                  label: "原发言",
                  text: displayAttempt.originalText,
                  quality: displayAttempt.originalQuality,
                  title: displayAttempt.originalImpactTitle,
                  impact: displayAttempt.originalImpactScore,
                  consensus: displayAttempt.originalConsensusDelta,
                  pace: displayAttempt.originalCharsPerMinute,
                  isBest: false,
                },
                ...challengeAttempts.map((attempt, index) => ({
                  id: attempt.id,
                  label: `第 ${index + 1} 次`,
                  text: attempt.revisedText,
                  quality: attempt.revisedQuality,
                  title: attempt.revisedImpactTitle,
                  impact: attempt.revisedImpactScore,
                  consensus: attempt.revisedConsensusDelta,
                  pace: attempt.revisedCharsPerMinute,
                  isBest: attempt.id === bestAttempt?.id,
                })),
              ].map((item) => (
                <section key={item.id} className={`relative rounded-[28px] border bg-white p-6 ${item.isBest ? "border-emerald-300 shadow-lg shadow-emerald-100/60" : "border-slate-200"}`}>
                  {item.isBest && <span className="absolute right-5 top-5 rounded-full bg-emerald-100 px-2.5 py-1 text-[9px] font-black text-emerald-700">当前最佳</span>}
                  <div className="flex items-center gap-2 pr-20">
                    <p className="text-[10px] font-black tracking-[0.13em] text-slate-400">{item.label}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-black text-slate-600">{QUALITY_LABEL[item.quality]}</span>
                  </div>
                  <p className="mt-4 min-h-28 rounded-2xl bg-slate-50 p-4 text-xs font-semibold leading-6 text-slate-700">“{item.text}”</p>
                  <p className="mt-4 min-h-10 text-xs font-black leading-5 text-slate-950">{item.title}</p>
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[8px] font-bold text-slate-400">综合影响</p><p className="mt-1 text-base font-black text-slate-900">{item.impact}</p></div>
                    <div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[8px] font-bold text-slate-400">共识变化</p><p className="mt-1 text-base font-black text-slate-900">{deltaLabel(item.consensus)}</p></div>
                    <div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[8px] font-bold text-slate-400">表达速度</p><p className="mt-1 text-base font-black text-slate-900">{item.pace ?? "—"}</p></div>
                  </div>
                </section>
              ))}
            </div>

            <section className="rounded-[28px] border border-indigo-100 bg-indigo-50 p-6 sm:p-8">
              <div className="flex items-center gap-2 text-xs font-black text-indigo-700"><TrendingUp className="size-4" /> {challengeComplete ? "下一场训练重点" : "下一次继续优化"}</div>
              <p className="mt-3 text-sm font-bold leading-7 text-indigo-950">{bestAttempt?.suggestion}</p>
              {bestAttempt?.revisedCharsPerMinute && <p className="mt-3 flex items-center gap-2 text-[10px] font-semibold text-indigo-600"><Gauge className="size-3.5" /> 最佳版本语速约 {bestAttempt.revisedCharsPerMinute} 字/分钟</p>}
            </section>

            <div className={`grid gap-3 ${challengeComplete ? "" : "sm:grid-cols-2"}`}>
              <button type="button" onClick={onBack} className="flex h-13 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-600 transition hover:text-indigo-700"><ArrowLeft className="size-4" /> {challengeComplete ? "完成挑战，返回报告" : "返回完整报告"}</button>
              {!challengeComplete && (
                <button type="button" onClick={resetAttempt} className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-black text-white transition hover:bg-indigo-600"><RotateCcw className="size-4" /> 继续第 {challengeAttempts.length + 1} 次挑战</button>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
