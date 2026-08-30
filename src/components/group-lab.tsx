"use client";

import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  Clock3,
  Flag,
  Lightbulb,
  RotateCcw,
  Scale,
  Send,
  Sparkles,
  Target,
  TimerReset,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import CaseLibrary from "@/components/case-library";
import TrainingHistory from "@/components/training-history";
import {
  applyUserTurn,
  createInitialState,
  finishSession,
  formatTime,
  tick,
} from "@/lib/engine";
import {
  appendTrainingRecord,
  createTrainingRecord,
  persistTrainingHistory,
  readTrainingHistory,
} from "@/lib/history";
import {
  getDifficulty,
  getParticipantsForScenario,
  getScenario,
  participants,
} from "@/lib/scenario";
import { buildReport } from "@/lib/scoring";
import type {
  DirectorTurn,
  GroupState,
  Message,
  Participant,
  Scenario,
  ScenarioId,
  TrainingRecord,
  TrainingDifficulty,
  View,
} from "@/lib/types";

type DirectorStatus = {
  mode: "checking" | "live" | "demo";
  model: string;
  provider: string;
};

function useDirectorStatus(): DirectorStatus {
  const [status, setStatus] = useState<DirectorStatus>({
    mode: "checking",
    model: "qwen-flash",
    provider: "阿里云百炼",
  });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/director", { signal: controller.signal })
      .then((response) => response.json())
      .then((data: { configured?: boolean; model?: string; provider?: string }) => {
        setStatus({
          mode: data.configured ? "live" : "demo",
          model: data.model || "qwen-flash",
          provider: data.provider || "阿里云百炼",
        });
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setStatus((current) => ({ ...current, mode: "demo" }));
      });
    return () => controller.abort();
  }, []);

  return status;
}

async function requestDirectorTurn(
  state: GroupState,
  userText: string,
  phase: "discussion" | "final_statement",
  signal: AbortSignal,
): Promise<DirectorTurn> {
  const response = await fetch("/api/director", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scenarioId: state.scenarioId ?? "campus-career-retention",
      difficulty: state.difficulty ?? "standard",
      phase,
      userText,
      state: {
        turn: state.turn,
        timeLeft: state.timeLeft,
        consensus: state.consensus,
        criteria: state.criteria,
        finalists: state.finalists,
        conflict: state.conflict,
        messages: state.messages.slice(-16).map((message) => ({
          speaker: message.speaker,
          content: message.content,
        })),
      },
    }),
    signal,
  });
  const data = (await response.json()) as DirectorTurn & { code?: string };
  if (!response.ok || !data.replies?.length || !data.assessment) {
    throw new Error(data.code || "AI_UNAVAILABLE");
  }
  return data;
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 place-items-center rounded-2xl bg-[#111827] text-white shadow-lg shadow-slate-950/10">
        <Users className="size-5" strokeWidth={2.2} />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-[17px] font-bold tracking-[-0.02em] text-slate-950">群面实验室</span>
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] text-indigo-600">
            BETA
          </span>
        </div>
        <p className="text-[10px] font-semibold tracking-[0.18em] text-slate-400">GROUPLAB</p>
      </div>
    </div>
  );
}

function ShellHeader({ compact = false }: { compact?: boolean }) {
  const director = useDirectorStatus();

  return (
    <header className="relative z-20 mx-auto flex w-full max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
      <Brand />
      <div className="flex items-center gap-3">
        {!compact && (
          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-500 shadow-sm backdrop-blur sm:flex">
            <span
              className={`size-2 rounded-full ${
                director.mode === "live"
                  ? "bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.12)]"
                  : director.mode === "checking"
                    ? "animate-pulse bg-indigo-400"
                    : "bg-amber-400"
              }`}
            />
            {director.mode === "live"
              ? `实时 AI · ${director.provider} / ${director.model}`
              : director.mode === "checking"
                ? "正在检查 AI 连接"
                : "演示模式 · 配置 API Key 后启用 AI"}
          </div>
        )}
        <a
          href="https://github.com/Miracle-1208/aiic-project1"
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
        >
          GitHub
        </a>
      </div>
    </header>
  );
}

function Avatar({ participant, size = "md" }: { participant: Participant; size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "size-8 text-[10px] rounded-xl",
    md: "size-10 text-[11px] rounded-2xl",
    lg: "size-14 text-sm rounded-[20px]",
  };
  return (
    <div
      className={`grid shrink-0 place-items-center font-black tracking-[-0.02em] ${sizes[size]}`}
      style={{ background: participant.softAccent, color: participant.accent }}
      aria-label={participant.name}
    >
      {participant.initials}
    </div>
  );
}

function Welcome({ onStart, onHistory }: { onStart: () => void; onHistory: () => void }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f6f7fb]">
      <div className="hero-grid absolute inset-0 opacity-70" />
      <div className="absolute -left-32 top-24 size-96 rounded-full bg-indigo-200/30 blur-3xl" />
      <div className="absolute -right-24 top-10 size-[420px] rounded-full bg-cyan-200/25 blur-3xl" />
      <ShellHeader />

      <section className="relative mx-auto grid min-h-[calc(100vh-88px)] max-w-[1440px] items-center gap-12 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-12 lg:pb-20">
        <div className="max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3 py-2 text-xs font-bold text-indigo-700 shadow-sm backdrop-blur">
            <Sparkles className="size-4" />
            第一个观察“团队影响力”的 AI 群面训练场
          </div>
          <h1 className="text-balance text-[44px] font-black leading-[1.08] tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-[70px]">
            不只练习说得更多，
            <span className="text-gradient">练习让团队走得更远。</span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
            与三名不同风格的 AI 候选人完成一场无领导小组讨论。系统不按发言次数给分，而是追踪你的观点如何改变团队。
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onStart}
              className="group inline-flex h-14 items-center justify-center gap-3 rounded-2xl bg-[#111827] px-7 text-sm font-bold text-white shadow-xl shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-indigo-600"
            >
              进入群面案例库
              <ArrowRight className="size-4 transition group-hover:translate-x-1" />
            </button>
            <button
              type="button"
              onClick={onHistory}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-6 text-sm font-bold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-700"
            >
              <TrendingUp className="size-4" /> 我的训练
            </button>
            <div className="flex items-center justify-center gap-4 px-3 text-xs font-semibold text-slate-500 sm:justify-start">
              <span className="flex items-center gap-1.5"><Check className="size-3.5 text-emerald-500" /> 无需登录</span>
              <span className="flex items-center gap-1.5"><Check className="size-3.5 text-emerald-500" /> 随时重来</span>
            </div>
          </div>

          <div className="mt-12 grid max-w-xl grid-cols-3 gap-3">
            {[
              ["3", "AI 候选人"],
              ["5", "协作维度"],
              ["1", "行动建议"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-white/80 bg-white/55 p-4 backdrop-blur">
                <p className="text-2xl font-black tracking-[-0.04em] text-slate-950">{value}</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[700px] lg:ml-auto">
          <div className="absolute -inset-5 rounded-[40px] bg-gradient-to-br from-indigo-300/30 via-white to-cyan-200/30 blur-2xl" />
          <div className="relative overflow-hidden rounded-[30px] border border-white bg-white/90 shadow-[0_35px_100px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {participants.slice(0, 4).map((participant) => (
                    <div key={participant.id} className="rounded-xl border-2 border-white">
                      <Avatar participant={participant} size="sm" />
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">讨论进行中</p>
                  <p className="text-[10px] text-slate-400">4 位候选人在线</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-500">
                <Clock3 className="size-3.5" /> 04:28
              </div>
            </div>

            <div className="grid min-h-[500px] md:grid-cols-[1fr_220px]">
              <div className="space-y-4 p-5">
                <PreviewMessage participant={participants[3]} text="我们还没有统一评价标准。现在投票可能太早。" />
                <PreviewMessage participant={participants[0]} text="先用用户影响、投入产出比和上线周期比较，再决定方案。" user />
                <PreviewMessage participant={participants[1]} text="同意，这样能让我们快速收敛。我建议马上逐项比较。" />
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                  <div className="flex items-center gap-2 text-xs font-black text-indigo-700">
                    <Zap className="size-4" /> 团队状态发生变化
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">你的评价标准被 2 名候选人采用，共识度上升 17%。</p>
                </div>
              </div>

              <aside className="border-l border-slate-100 bg-slate-50/70 p-4">
                <p className="text-[10px] font-black tracking-[0.16em] text-slate-400">SHARED BOARD</p>
                <p className="mt-1 text-xs font-bold text-slate-900">团队共识</p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full w-[71%] rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400" />
                </div>
                <div className="mt-2 flex justify-between text-[10px] font-bold text-slate-400">
                  <span>形成中</span><span className="text-indigo-600">71%</span>
                </div>
                <div className="mt-6 space-y-3">
                  {["用户影响", "投入产出比", "上线周期"].map((item) => (
                    <div key={item} className="flex items-center gap-2 rounded-xl bg-white p-2.5 text-[11px] font-semibold text-slate-600 shadow-sm">
                      <Check className="size-3.5 text-emerald-500" /> {item}
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function PreviewMessage({ participant, text, user = false }: { participant: Participant; text: string; user?: boolean }) {
  return (
    <div className={`flex gap-3 ${user ? "flex-row-reverse" : ""}`}>
      <Avatar participant={participant} size="sm" />
      <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-xs leading-5 ${user ? "rounded-tr-md bg-slate-950 text-white" : "rounded-tl-md bg-slate-100 text-slate-700"}`}>
        {text}
      </div>
    </div>
  );
}

function Briefing({
  selectedScenario,
  difficulty,
  team,
  onBack,
  onEnter,
}: {
  selectedScenario: Scenario;
  difficulty: TrainingDifficulty;
  team: Participant[];
  onBack: () => void;
  onEnter: () => void;
}) {
  const difficultyProfile = getDifficulty(difficulty);
  return (
    <main className="min-h-screen bg-[#f6f7fb]">
      <ShellHeader />
      <section className="mx-auto max-w-[1220px] px-5 pb-16 pt-5 sm:px-8 lg:px-12">
        <button type="button" onClick={onBack} className="mb-6 text-xs font-bold text-slate-500 transition hover:text-slate-950">
          ← 返回案例库
        </button>
        <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-[#111827] px-6 py-7 text-white sm:px-9 sm:py-9">
            <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-indigo-200">
              <span className="rounded-full bg-white/10 px-3 py-1.5">{selectedScenario.caseNumber}</span>
              <span className="rounded-full bg-indigo-400/15 px-3 py-1.5">{difficultyProfile.label}</span>
              <span>{selectedScenario.company}</span>
            </div>
            <h1 className="mt-5 text-3xl font-black tracking-[-0.04em] sm:text-4xl">{selectedScenario.title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{selectedScenario.brief}</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {selectedScenario.facts.map((fact) => (
                <div key={fact.label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                  <p className="text-[11px] font-bold text-slate-400">{fact.label}</p>
                  <p className="mt-1 text-xl font-black tracking-[-0.03em]">{fact.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[1fr_310px]">
            <div>
              <div className="flex items-center gap-2">
                <Target className="size-5 text-indigo-600" />
                <h2 className="text-lg font-black text-slate-950">讨论任务</h2>
              </div>
              <p className="mt-3 rounded-2xl bg-indigo-50 p-4 text-sm font-semibold leading-7 text-indigo-950">{selectedScenario.goal}</p>

              <h2 className="mt-8 text-lg font-black text-slate-950">候选方案</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {selectedScenario.options.map((option, index) => (
                  <article key={option.id} className="rounded-2xl border border-slate-200 p-4 transition hover:border-indigo-200 hover:bg-indigo-50/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex gap-3">
                        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-[11px] font-black text-slate-500">{String.fromCharCode(65 + index)}</span>
                        <div>
                          <h3 className="text-sm font-black text-slate-900">{option.title}</h3>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{option.description}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2 py-1">{option.cost}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1">{option.cycle}</span>
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">{option.signal}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <aside>
              <div className="sticky top-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black tracking-[0.12em] text-slate-400">YOUR TEAM</p>
                <div className="mt-4 space-y-3">
                  {team.map((participant) => (
                    <div key={participant.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
                      <Avatar participant={participant} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-black text-slate-900">{participant.name}</p>
                          <span className="text-[9px] font-bold text-slate-400">{participant.role}</span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] font-semibold" style={{ color: participant.accent }}>{participant.style}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl bg-white p-4">
                  <p className="text-xs font-black text-slate-900">本轮限制</p>
                  <ul className="mt-3 space-y-2">
                    {selectedScenario.constraints.map((constraint) => (
                      <li key={constraint} className="flex gap-2 text-[11px] leading-5 text-slate-500">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" /> {constraint}
                      </li>
                    ))}
                  </ul>
                </div>

                <button type="button" onClick={onEnter} className="group mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-sm font-black text-white shadow-lg shadow-indigo-600/20 transition hover:-translate-y-0.5 hover:bg-indigo-700">
                  进入群面房间 · {difficultyProfile.shortLabel} <ArrowRight className="size-4 transition group-hover:translate-x-1" />
                </button>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}

function MessageBubble({ item, team }: { item: Message; team: Participant[] }) {
  if (item.speaker === "system") {
    return (
      <div className="my-5 flex justify-center">
        <div className="rounded-full bg-slate-100 px-4 py-2 text-[10px] font-bold text-slate-500">{item.content}</div>
      </div>
    );
  }
  const participant = team.find((person) => person.id === item.speaker) ?? team[0];
  const isUser = item.speaker === "user";
  return (
    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <Avatar participant={participant} size="sm" />
      <div className={`max-w-[82%] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div className={`mb-1 flex items-center gap-2 text-[10px] font-bold text-slate-400 ${isUser ? "flex-row-reverse" : ""}`}>
          <span>{participant.name}</span><span>{item.createdAt}</span>
        </div>
        <div className={`rounded-2xl px-4 py-3 text-[13px] leading-6 ${isUser ? "rounded-tr-md bg-[#111827] text-white" : "rounded-tl-md border border-slate-100 bg-white text-slate-700 shadow-sm"}`}>
          {item.content}
        </div>
      </div>
    </div>
  );
}

function ConsensusMeter({ value }: { value: number }) {
  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-black tracking-[0.14em] text-slate-400">CONSENSUS</p>
          <p className="mt-1 text-xs font-bold text-slate-700">团队共识度</p>
        </div>
        <p className="text-2xl font-black tracking-[-0.05em] text-indigo-600">{value}%</p>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 transition-all duration-700" style={{ width: `${value}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-[9px] font-bold text-slate-400"><span>分歧</span><span>形成中</span><span>共识</span></div>
    </div>
  );
}

function Room({
  state,
  setState,
  onFinish,
}: {
  state: GroupState;
  setState: React.Dispatch<React.SetStateAction<GroupState>>;
  onFinish: (statement: string, directorTurn?: DirectorTurn) => void;
}) {
  const [input, setInput] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [statement, setStatement] = useState("");
  const [isResponding, setIsResponding] = useState(false);
  const [isFinalAnalyzing, setIsFinalAnalyzing] = useState(false);
  const [runtimeMode, setRuntimeMode] = useState<"live" | "demo" | null>(null);
  const [directorNotice, setDirectorNotice] = useState("");
  const directorStatus = useDirectorStatus();
  const bottomRef = useRef<HTMLDivElement>(null);
  const selectedScenario = getScenario(state.scenarioId);
  const difficultyProfile = getDifficulty(state.difficulty);
  const team = getParticipantsForScenario(selectedScenario.id);

  useEffect(() => {
    const timer = window.setInterval(() => setState((current) => tick(current)), 1000);
    return () => window.clearInterval(timer);
  }, [setState]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [isResponding, state.messages.length]);

  const send = async () => {
    const userText = input.trim();
    if (!userText || isResponding) return;

    setInput("");
    setIsResponding(true);
    setDirectorNotice("");

    let directorTurn: DirectorTurn | undefined;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30_000);

    try {
      directorTurn = await requestDirectorTurn(state, userText, "discussion", controller.signal);
      setRuntimeMode("live");
    } catch (error) {
      setRuntimeMode("demo");
      const isNotConfigured =
        error instanceof Error && error.message === "AI_NOT_CONFIGURED";
      setDirectorNotice(
        isNotConfigured
          ? "当前未配置 API Key，本轮由演示导演继续。"
          : "实时 AI 暂时未响应，本轮已自动切换到演示导演。",
      );
    } finally {
      window.clearTimeout(timeout);
      setState((current) => applyUserTurn(current, userText, directorTurn));
      setIsResponding(false);
    }
  };

  const submitFinalStatement = async () => {
    const finalText = statement.trim();
    if (finalText.length < 20 || isFinalAnalyzing) return;

    setIsFinalAnalyzing(true);
    setDirectorNotice("");
    let directorTurn: DirectorTurn | undefined;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30_000);

    try {
      directorTurn = await requestDirectorTurn(
        state,
        finalText,
        "final_statement",
        controller.signal,
      );
      setRuntimeMode("live");
    } catch (error) {
      setRuntimeMode("demo");
      const isNotConfigured =
        error instanceof Error && error.message === "AI_NOT_CONFIGURED";
      setDirectorNotice(
        isNotConfigured
          ? "当前未配置 API Key，最终报告将使用本地证据规则。"
          : "实时 AI 暂时未响应，最终报告已自动使用本地证据规则。",
      );
    } finally {
      window.clearTimeout(timeout);
      setIsFinalAnalyzing(false);
      onFinish(finalText, directorTurn);
    }
  };

  const currentUserStance = state.finalists.length ? state.finalists.join(" + ") : "尚未形成明确选择";
  const effectiveDirectorMode = runtimeMode ?? directorStatus.mode;

  return (
    <main className="flex min-h-screen flex-col bg-[#f3f5f8]">
      <div className="border-b border-slate-200 bg-white">
        <ShellHeader compact />
      </div>
      <div className="mx-auto grid w-full max-w-[1600px] flex-1 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
        <aside className="hidden border-r border-slate-200 bg-white p-5 lg:block">
          <p className="text-[10px] font-black tracking-[0.16em] text-slate-400">PARTICIPANTS · 4</p>
          <div className="mt-4 space-y-3">
            {team.map((participant) => (
              <div key={participant.id} className="rounded-2xl border border-slate-100 p-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar participant={participant} />
                    <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white bg-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900">{participant.name}</p>
                    <p className="truncate text-[10px] font-bold" style={{ color: participant.accent }}>{participant.style}</p>
                  </div>
                </div>
                <p className="mt-3 text-[10px] font-semibold leading-4 text-slate-400">当前倾向</p>
                <p className="mt-1 text-[11px] font-bold leading-5 text-slate-600">{participant.id === "user" ? currentUserStance : participant.stance}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white">
            <p className="text-[10px] font-bold text-slate-400">你的任务</p>
            <p className="mt-2 text-xs font-semibold leading-5">选出 {selectedScenario.selectionCount} 个方案，并帮助团队形成一套共同理由。</p>
          </div>
        </aside>

        <section className="flex min-h-[calc(100vh-81px)] min-w-0 flex-col bg-[#f7f8fa]">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
            <div>
              <p className="text-sm font-black text-slate-950">{selectedScenario.title}</p>
              <p className="mt-0.5 text-[10px] font-semibold text-slate-400">{difficultyProfile.label} · 第 {Math.max(1, state.turn)} 轮</p>
            </div>
            <div className="flex items-center gap-3">
              <div
                className={`hidden items-center gap-2 rounded-full px-3 py-2 text-[10px] font-bold sm:flex ${
                  effectiveDirectorMode === "live"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                <span
                  className={`size-2 rounded-full ${
                    isResponding
                      ? "animate-pulse bg-indigo-400"
                      : effectiveDirectorMode === "live"
                        ? "bg-emerald-400"
                        : "bg-amber-400"
                  }`}
                />
                {isResponding
                  ? "AI 候选人正在回应"
                  : effectiveDirectorMode === "live"
                    ? "实时 AI 已连接"
                    : "演示导演已就绪"}
              </div>
              <div className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black ${state.timeLeft < 120 ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-700"}`}>
                <Clock3 className="size-3.5" /> {formatTime(state.timeLeft)}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-7">
            <div className="mx-auto max-w-3xl space-y-5">
              <div className="flex justify-center">
                <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-bold text-slate-400 shadow-sm">AI 候选人已完成个人立场陈述，现在轮到你</span>
              </div>
              {state.messages.map((item) => <MessageBubble key={item.id} item={item} team={team} />)}
              {isResponding && (
                <div className="flex items-center gap-3" aria-live="polite">
                  <Avatar participant={team[3]} size="sm" />
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-slate-100 bg-white px-4 py-4 shadow-sm">
                    <span className="size-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.2s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.1s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-indigo-400" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
            <div className="mx-auto max-w-3xl">
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {selectedScenario.quickActions.map((action, index) => (
                  <button key={action} type="button" onClick={() => setInput(action)} disabled={isResponding} className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">
                    {index === 0 ? "建立标准" : index === 1 ? "整合分歧" : "控制时间"}
                  </button>
                ))}
              </div>
              <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-50">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  disabled={isResponding}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  rows={2}
                  placeholder="回应团队，提出标准、质疑或整合方案……"
                  className="max-h-28 min-h-12 flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400"
                />
                <button type="button" onClick={() => void send()} disabled={isResponding || !input.trim()} className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-950 text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-30" aria-label="发送发言">
                  <Send className="size-4" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between px-1">
                <p className={`text-[9px] font-semibold ${directorNotice ? "text-amber-600" : "text-slate-400"}`}>
                  {directorNotice || "Enter 发送 · Shift + Enter 换行"}
                </p>
                <button type="button" onClick={() => setFinalizing(true)} disabled={state.turn < 2 || isResponding} className="flex items-center gap-1 text-[10px] font-black text-indigo-600 transition hover:text-indigo-800 disabled:cursor-not-allowed disabled:text-slate-300">
                  进入最终陈述 <ChevronRight className="size-3" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <aside className="hidden border-l border-slate-200 bg-white p-5 lg:block">
          <ConsensusMeter value={state.consensus} />
          <div className="mt-7">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black tracking-[0.14em] text-slate-400">SHARED BOARD</p>
              <BarChart3 className="size-4 text-slate-400" />
            </div>
            <BoardBlock icon={<Scale className="size-4" />} title="共同标准" empty="等待团队建立标准" items={state.criteria} />
            <BoardBlock icon={<Target className="size-4" />} title="当前候选" empty="尚未锁定方案" items={state.finalists} />
            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
              <div className="flex items-center gap-2 text-xs font-black text-amber-800"><Lightbulb className="size-4" /> 未解决分歧</div>
              <p className="mt-2 text-[11px] font-semibold leading-5 text-amber-900/70">{state.conflict}</p>
            </div>
          </div>
          {state.influence.length > 0 && (
            <div className="mt-5 rounded-2xl bg-indigo-50 p-4">
              <div className="flex items-center justify-between gap-2 text-xs font-black text-indigo-700">
                <span className="flex items-center gap-2"><Zap className="size-4" /> 最新影响</span>
                <span className="rounded-full bg-white px-2 py-1 text-[8px] tracking-[0.08em] text-indigo-500">
                  {state.influence.at(-1)?.source === "ai" ? "AI 证据" : "本地规则"}
                </span>
              </div>
              <p className="mt-2 text-[11px] font-bold text-slate-700">{state.influence.at(-1)?.title}</p>
              <p className="mt-1 text-[10px] leading-5 text-slate-500">{state.influence.at(-1)?.detail}</p>
              {state.influence.at(-1)?.evidence && (
                <p className="mt-2 border-l-2 border-indigo-200 pl-2 text-[9px] leading-4 text-indigo-700">
                  “{state.influence.at(-1)?.evidence}”
                </p>
              )}
            </div>
          )}
        </aside>
      </div>

      {finalizing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-black text-indigo-600"><Flag className="size-4" /> FINAL STATEMENT</div>
                <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-slate-950">代表小组完成最终陈述</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">建议包含选择标准、最终方案、核心理由和一个主要风险。</p>
              </div>
              <button type="button" onClick={() => setFinalizing(false)} disabled={isFinalAnalyzing} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500 disabled:cursor-not-allowed disabled:opacity-40">稍后</button>
            </div>
            <textarea
              value={statement}
              onChange={(event) => setStatement(event.target.value)}
              disabled={isFinalAnalyzing}
              rows={7}
              autoFocus
              placeholder="我们小组建议优先……我们的选择标准是……"
              className="mt-6 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-800 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-50"
            />
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setFinalizing(false)} disabled={isFinalAnalyzing} className="h-12 rounded-xl px-5 text-sm font-bold text-slate-500 disabled:cursor-not-allowed disabled:opacity-40">继续讨论</button>
              <button type="button" onClick={() => void submitFinalStatement()} disabled={isFinalAnalyzing || statement.trim().length < 20} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-black text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-30">
                {isFinalAnalyzing ? "AI 正在分析最终陈述…" : "提交并查看证据报告"} <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function BoardBlock({ icon, title, items, empty }: { icon: React.ReactNode; title: string; items: string[]; empty: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-slate-100 p-4">
      <div className="flex items-center gap-2 text-xs font-black text-slate-700">{icon}{title}</div>
      {items.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => <span key={item} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-bold text-slate-600">{item}</span>)}
        </div>
      ) : <p className="mt-3 text-[10px] font-semibold text-slate-400">{empty}</p>}
    </div>
  );
}

function Report({
  state,
  onRestart,
  onLibrary,
  onHistory,
}: {
  state: GroupState;
  onRestart: () => void;
  onLibrary: () => void;
  onHistory: () => void;
}) {
  const report = useMemo(() => buildReport(state), [state]);
  const selectedScenario = getScenario(state.scenarioId);
  const difficultyProfile = getDifficulty(state.difficulty);
  return (
    <main className="min-h-screen bg-[#f5f7fa]">
      <ShellHeader />
      <section className="mx-auto max-w-[1200px] px-5 pb-20 pt-6 sm:px-8 lg:px-12">
        <div className="overflow-hidden rounded-[32px] bg-[#111827] text-white shadow-2xl shadow-slate-950/15">
          <div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[310px_1fr] lg:p-12">
            <div>
              <div className="flex items-center gap-2 text-xs font-black tracking-[0.12em] text-indigo-300"><Sparkles className="size-4" /> EVIDENCE REPORT</div>
              <p className="mt-3 text-xs font-semibold leading-5 text-slate-400">{selectedScenario.title} · {difficultyProfile.label}</p>
              <div className="mt-6 flex items-end gap-3">
                <span className="text-7xl font-black tracking-[-0.07em]">{report.total}</span>
                <span className="mb-2 text-sm font-bold text-slate-400">/ 100</span>
              </div>
              <p className="mt-3 inline-flex rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-300">{report.level}</p>
              <p className="mt-5 text-sm leading-7 text-slate-300">每一分都对应你的原话、团队状态变化和下一次可执行的改进动作。</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {report.dimensions.map((dimension) => {
                const percent = Math.round((dimension.score / dimension.max) * 100);
                return (
                  <div key={dimension.key} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                    <div className="flex items-baseline justify-between"><p className="text-xs font-bold text-slate-300">{dimension.label}</p><p className="text-sm font-black">{dimension.score}</p></div>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-cyan-300" style={{ width: `${percent}%` }} /></div>
                    <p className="mt-3 text-[9px] leading-4 text-slate-500">{dimension.summary}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black tracking-[0.15em] text-indigo-600">EVIDENCE TIMELINE</p>
                <h2 className="mt-2 text-xl font-black text-slate-950">逐轮证据化复盘</h2>
              </div>
              <TrendingUp className="size-6 text-indigo-500" />
            </div>
            <div className="relative mt-7 space-y-6 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-slate-200">
              {state.influence.map((event, index) => (
                <div key={event.id} className="relative flex gap-4">
                  <div className={`relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-4 border-white text-[10px] font-black ${event.tone === "positive" ? "bg-indigo-600 text-white" : event.tone === "warning" ? "bg-amber-400 text-white" : "bg-slate-200 text-slate-600"}`}>{index + 1}</div>
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black text-slate-900">{event.title}</p>
                      <span className="text-[9px] font-bold text-slate-400">第 {event.turn} 轮</span>
                      <span className={`rounded-full px-2 py-0.5 text-[8px] font-black ${event.source === "ai" ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-500"}`}>
                        {event.source === "ai" ? "AI 证据" : "本地规则"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-6 text-slate-500">{event.detail}</p>
                    {event.evidence && (
                      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold leading-6 text-slate-700">
                        “{event.evidence}”
                      </div>
                    )}
                    {event.suggestion && (
                      <p className="mt-2 text-[10px] font-semibold leading-5 text-indigo-600">
                        下一步：{event.suggestion}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-2 text-xs font-black text-emerald-700"><Zap className="size-4" /> 本轮高光</div>
              <p className="mt-4 text-lg font-black leading-8 text-slate-950">{report.strength}</p>
              <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-xs leading-6 text-emerald-950">{report.evidence}</div>
            </section>
            <section className="rounded-[28px] border border-indigo-100 bg-indigo-50 p-6">
              <div className="flex items-center gap-2 text-xs font-black text-indigo-700"><TimerReset className="size-4" /> 下一轮只练一件事</div>
              <p className="mt-4 text-sm font-bold leading-7 text-indigo-950">{report.focus}</p>
            </section>
            <section className="rounded-[28px] border border-slate-200 bg-white p-6">
              <p className="text-xs font-black text-slate-900">小组最终选择</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {state.finalists.slice(0, 2).map((item) => <span key={item} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">{item}</span>)}
              </div>
              <p className="mt-5 line-clamp-4 text-xs leading-6 text-slate-500">“{state.finalStatement}”</p>
            </section>
            <div className="grid gap-3 sm:grid-cols-3">
              <button type="button" onClick={onLibrary} className="flex h-13 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-600 transition hover:border-indigo-200 hover:text-indigo-700">
                返回题库
              </button>
              <button type="button" onClick={onHistory} className="flex h-13 items-center justify-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 text-sm font-black text-indigo-700 transition hover:bg-indigo-100">
                <TrendingUp className="size-4" /> 成长档案
              </button>
              <button type="button" onClick={onRestart} className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-black text-white transition hover:bg-indigo-600">
                <RotateCcw className="size-4" /> 再练一次
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function GroupLab() {
  const [view, setView] = useState<View>("welcome");
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>("standard");
  const [selectedScenarioId, setSelectedScenarioId] = useState<ScenarioId>(
    "campus-career-retention",
  );
  const [state, setState] = useState<GroupState>(() =>
    createInitialState("campus-career-retention", "standard"),
  );
  const [history, setHistory] = useState<TrainingRecord[]>(() => readTrainingHistory());
  const selectedScenario = getScenario(selectedScenarioId);
  const team = getParticipantsForScenario(selectedScenarioId);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [view]);

  const restart = () => {
    setSelectedScenarioId(state.scenarioId);
    setDifficulty(state.difficulty);
    setState(createInitialState(state.scenarioId, state.difficulty));
    setView("briefing");
  };

  const selectScenario = (scenarioId: ScenarioId) => {
    setSelectedScenarioId(scenarioId);
    setState(createInitialState(scenarioId, difficulty));
    setView("briefing");
  };

  const complete = (statement: string, directorTurn?: DirectorTurn) => {
    if (statement.trim().length < 20) return;
    const completedState = finishSession(state, statement, directorTurn);
    const record = createTrainingRecord(completedState);
    setState(completedState);
    setHistory((current) => {
      const next = appendTrainingRecord(current, record);
      persistTrainingHistory(next);
      return next;
    });
    setView("report");
  };

  const trainAgain = (record: TrainingRecord) => {
    setSelectedScenarioId(record.scenarioId);
    setDifficulty(record.difficulty);
    setState(createInitialState(record.scenarioId, record.difficulty));
    setView("briefing");
  };

  if (view === "welcome") {
    return (
      <Welcome
        onStart={() => setView("library")}
        onHistory={() => setView("history")}
      />
    );
  }
  if (view === "history") {
    return (
      <TrainingHistory
        records={history}
        loaded
        onBack={() => setView("library")}
        onTrainAgain={trainAgain}
      />
    );
  }
  if (view === "library") {
    return (
      <CaseLibrary
        difficulty={difficulty}
        onDifficultyChange={setDifficulty}
        onSelect={selectScenario}
        onHistory={() => setView("history")}
        onBack={() => setView("welcome")}
      />
    );
  }
  if (view === "briefing") {
    return (
      <Briefing
        selectedScenario={selectedScenario}
        difficulty={difficulty}
        team={team}
        onBack={() => setView("library")}
        onEnter={() => setView("room")}
      />
    );
  }
  if (view === "report") {
    return (
      <Report
        state={state}
        onRestart={restart}
        onLibrary={() => setView("library")}
        onHistory={() => setView("history")}
      />
    );
  }
  return <Room state={state} setState={setState} onFinish={complete} />;
}
