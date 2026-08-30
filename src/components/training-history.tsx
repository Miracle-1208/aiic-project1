"use client";

import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

import { dimensionPercent, weakestDimension } from "@/lib/history";
import { getDifficulty, getScenario } from "@/lib/scenario";
import type { ScoreKey, TrainingRecord } from "@/lib/types";

const SCORE_KEYS: ScoreKey[] = [
  "contribution",
  "progress",
  "listening",
  "conflict",
  "structure",
];

const SERIES_COLORS: Record<ScoreKey, string> = {
  contribution: "#5b7cfa",
  progress: "#10a594",
  listening: "#a66bf0",
  conflict: "#f9735b",
  structure: "#e7a83e",
};

function HistoryHeader({ onBack }: { onBack: () => void }) {
  return (
    <header className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-2xl bg-[#111827] text-white shadow-lg shadow-slate-950/10">
          <Users className="size-5" strokeWidth={2.2} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[17px] font-bold tracking-[-0.02em] text-slate-950">群面实验室</span>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] text-indigo-600">GROWTH</span>
          </div>
          <p className="text-[10px] font-semibold tracking-[0.18em] text-slate-400">TRAINING PROFILE</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-500 transition hover:border-slate-300 hover:text-slate-950"
      >
        <ArrowLeft className="size-3.5" /> 返回题库
      </button>
    </header>
  );
}

function formatDate(value: string, compact = false) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    ...(compact ? {} : { hour: "2-digit", minute: "2-digit" }),
  }).format(new Date(value));
}

function TrendRow({
  label,
  keyName,
  records,
}: {
  label: string;
  keyName: ScoreKey;
  records: TrainingRecord[];
}) {
  const values = records.map((record) => dimensionPercent(record, keyName));
  const points = values
    .map((value, index) => {
      const x = values.length <= 1 ? 50 : 3 + (index / (values.length - 1)) * 94;
      const y = 25 - (value / 100) * 21;
      return `${x},${y}`;
    })
    .join(" ");
  const latest = values.at(-1) ?? 0;

  return (
    <div className="grid grid-cols-[76px_minmax(0,1fr)_42px] items-center gap-3">
      <p className="text-[11px] font-bold text-slate-600">{label}</p>
      <svg
        viewBox="0 0 100 28"
        preserveAspectRatio="none"
        className="h-9 w-full overflow-visible"
        role="img"
        aria-label={`${label}最近 ${values.length} 次训练趋势，当前 ${latest}%`}
      >
        <line x1="0" y1="25" x2="100" y2="25" stroke="#e8ebf0" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1="14.5" x2="100" y2="14.5" stroke="#eef0f4" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1="4" x2="100" y2="4" stroke="#eef0f4" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
        {values.length === 1 ? (
          <line x1="3" y1={25 - (latest / 100) * 21} x2="97" y2={25 - (latest / 100) * 21} stroke={SERIES_COLORS[keyName]} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        ) : (
          <polyline points={points} fill="none" stroke={SERIES_COLORS[keyName]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      <p className="text-right text-sm font-black text-slate-900">{latest}%</p>
    </div>
  );
}

function EmptyHistory({ onBack }: { onBack: () => void }) {
  return (
    <section className="mx-auto mt-12 max-w-xl rounded-[30px] border border-slate-200 bg-white p-9 text-center shadow-sm">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
        <TrendingUp className="size-6" />
      </div>
      <h1 className="mt-5 text-2xl font-black tracking-[-0.03em] text-slate-950">完成第一场训练后，这里会出现成长曲线</h1>
      <p className="mt-3 text-sm leading-7 text-slate-500">系统会保存总分、五维能力、原话证据和下一轮目标。数据只保存在这台电脑的当前浏览器中。</p>
      <button type="button" onClick={onBack} className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 text-sm font-black text-white transition hover:bg-indigo-700">
        选择一场训练 <ChevronRight className="size-4" />
      </button>
    </section>
  );
}

export default function TrainingHistory({
  records,
  loaded,
  onBack,
  onTrainAgain,
}: {
  records: TrainingRecord[];
  loaded: boolean;
  onBack: () => void;
  onTrainAgain: (record: TrainingRecord) => void;
}) {
  const [selectedId, setSelectedId] = useState(records[0]?.id ?? "");

  const selected = records.find((record) => record.id === selectedId) ?? records[0];
  const chronological = useMemo(() => records.slice(0, 8).reverse(), [records]);
  const weakest = weakestDimension(records);
  const average = records.length
    ? Math.round(records.reduce((sum, record) => sum + record.report.total, 0) / records.length)
    : 0;
  const retrainCount = records.reduce(
    (sum, record) => sum + (record.retrainAttempts?.length ?? 0),
    0,
  );

  return (
    <main className="min-h-screen bg-[#f5f7fa]">
      <HistoryHeader onBack={onBack} />
      {!loaded ? (
        <div className="mx-auto mt-20 size-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" aria-label="正在读取训练记录" />
      ) : records.length === 0 ? (
        <EmptyHistory onBack={onBack} />
      ) : (
        <section className="mx-auto max-w-[1240px] px-5 pb-20 pt-6 sm:px-8 lg:px-12">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-2 text-xs font-black tracking-[0.12em] text-indigo-600"><Sparkles className="size-4" /> MY GROWTH</div>
              <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] text-slate-950 sm:text-4xl">我的训练成长档案</h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">最多保留最近 50 场，所有内容只存放在当前浏览器。</p>
            </div>
            <button type="button" onClick={() => selected && onTrainAgain(selected)} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 text-sm font-black text-white transition hover:bg-indigo-600">
              <RotateCcw className="size-4" /> 重练当前题目
            </button>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["累计训练", `${records.length} 场`, "完成一次报告即自动记录"],
              ["专项重练", `${retrainCount} 次`, "针对关键轮次反复优化"],
              ["最近得分", `${records[0].report.total} 分`, records[0].report.level],
              ["平均得分", `${average} 分`, "基于全部本地记录"],
              ["当前短板", weakest?.label ?? "待训练", weakest ? `${weakest.score} / ${weakest.max}` : "完成后生成"],
            ].map(([label, value, detail]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-[10px] font-black tracking-[0.12em] text-slate-400">{label}</p>
                <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">{value}</p>
                <p className="mt-1 text-[10px] font-semibold text-slate-400">{detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="space-y-6">
              <section className="rounded-[28px] border border-slate-200 bg-white p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-black text-indigo-700"><BarChart3 className="size-4" /> 五维成长曲线</div>
                    <p className="mt-2 text-[11px] leading-5 text-slate-400">按各维度满分换算为百分比，展示最近 {chronological.length} 场。</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[9px] font-black text-slate-500">最早 → 最近</span>
                </div>
                <div className="mt-6 space-y-4">
                  {SCORE_KEYS.map((key) => (
                    <TrendRow
                      key={key}
                      keyName={key}
                      label={records[0].report.dimensions.find((item) => item.key === key)?.label ?? key}
                      records={chronological}
                    />
                  ))}
                </div>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white p-6 sm:p-8">
                <div className="flex items-center gap-2 text-xs font-black text-slate-800"><CalendarDays className="size-4 text-indigo-600" /> 训练记录</div>
                <div className="mt-5 space-y-2">
                  {records.map((record) => {
                    const itemScenario = getScenario(record.scenarioId);
                    const itemDifficulty = getDifficulty(record.difficulty);
                    const active = record.id === selected?.id;
                    return (
                      <button
                        key={record.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSelectedId(record.id)}
                        className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border p-4 text-left transition ${active ? "border-indigo-200 bg-indigo-50/70" : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50"}`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-black text-slate-900">{itemScenario.title}</span>
                          <span className="mt-1 block text-[10px] font-semibold text-slate-400">{formatDate(record.completedAt)} · {itemDifficulty.label} · {record.turns} 轮{record.retrainAttempts?.length ? ` · 专项 ${record.retrainAttempts.length} 次` : ""}</span>
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="text-lg font-black text-slate-950">{record.report.total}</span>
                          <ChevronRight className="size-4 text-slate-300" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            {selected && (
              <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
                <section className="overflow-hidden rounded-[28px] bg-[#111827] p-6 text-white shadow-xl shadow-slate-950/10">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black tracking-[0.13em] text-indigo-300">SELECTED REPORT</p>
                      <h2 className="mt-3 text-lg font-black leading-7">{getScenario(selected.scenarioId).title}</h2>
                      <p className="mt-1 text-[10px] font-semibold text-slate-400">{formatDate(selected.completedAt)} · {getDifficulty(selected.difficulty).label}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-4xl font-black tracking-[-0.05em]">{selected.report.total}</p>
                      <p className="text-[9px] font-bold text-slate-400">/ 100</p>
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white/[0.07] p-4">
                      <p className="text-[9px] font-bold text-slate-500">团队共识</p>
                      <p className="mt-1 text-lg font-black">{selected.consensus}%</p>
                    </div>
                    <div className="rounded-2xl bg-white/[0.07] p-4">
                      <p className="text-[9px] font-bold text-slate-500">能力画像</p>
                      <p className="mt-1 text-sm font-black text-emerald-300">{selected.report.level}</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-[28px] border border-slate-200 bg-white p-6">
                  <div className="flex items-center gap-2 text-xs font-black text-emerald-700"><Trophy className="size-4" /> 本场高光</div>
                  <p className="mt-3 text-sm font-bold leading-7 text-slate-900">{selected.report.strength}</p>
                  <p className="mt-3 rounded-2xl bg-emerald-50 p-4 text-[11px] leading-6 text-emerald-950">{selected.report.evidence}</p>
                </section>

                <section className="rounded-[28px] border border-indigo-100 bg-indigo-50 p-6">
                  <div className="flex items-center gap-2 text-xs font-black text-indigo-700"><Target className="size-4" /> 下一次只练一件事</div>
                  <p className="mt-3 text-sm font-bold leading-7 text-indigo-950">{selected.report.focus}</p>
                </section>

                {selected.retrainAttempts?.length ? (
                  <section className="rounded-[28px] border border-emerald-100 bg-emerald-50 p-6">
                    <div className="flex items-center gap-2 text-xs font-black text-emerald-700"><TrendingUp className="size-4" /> 关键轮次重练</div>
                    <div className="mt-4 space-y-3">
                      {selected.retrainAttempts.slice(0, 4).map((attempt) => (
                        <div key={attempt.id} className="rounded-2xl bg-white/80 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-black text-slate-900">第 {attempt.targetTurn} 轮</p>
                            <span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${attempt.improved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                              综合影响 {attempt.impactDelta > 0 ? `+${attempt.impactDelta}` : attempt.impactDelta}
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-[10px] leading-5 text-slate-500">“{attempt.revisedText}”</p>
                          <p className="mt-2 text-[9px] font-semibold text-slate-400">{formatDate(attempt.completedAt)} · {attempt.revisedImpactTitle}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="rounded-[28px] border border-slate-200 bg-white p-6">
                  <p className="text-xs font-black text-slate-900">最终选择</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selected.finalists.map((item) => <span key={item} className="rounded-xl bg-slate-100 px-3 py-2 text-[10px] font-bold text-slate-700">{item}</span>)}
                  </div>
                  <p className="mt-4 line-clamp-4 text-[11px] leading-6 text-slate-500">“{selected.finalStatement}”</p>
                  <button type="button" onClick={() => onTrainAgain(selected)} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-sm font-black text-white transition hover:bg-indigo-700">
                    <RotateCcw className="size-4" /> 重练这道题
                  </button>
                </section>
              </aside>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
