"use client";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Scale,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

import { difficultyProfiles, getDifficulty, scenarios } from "@/lib/scenario";
import type { ScenarioId, TrainingDifficulty } from "@/lib/types";

function ScenarioIcon({ category }: { category: string }) {
  if (category === "危机决策") return <ShieldAlert className="size-5" />;
  if (category === "产品策划") return <BookOpen className="size-5" />;
  return <Scale className="size-5" />;
}

function LibraryHeader({ onBack, onHistory }: { onBack: () => void; onHistory: () => void }) {
  return (
    <header className="relative z-20 mx-auto flex w-full max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-3 text-left"
        aria-label="返回产品首页"
      >
        <span className="grid size-10 place-items-center rounded-2xl bg-[#111827] text-white shadow-lg shadow-slate-950/10">
          <Users className="size-5" strokeWidth={2.2} />
        </span>
        <span>
          <span className="flex items-center gap-2">
            <span className="text-[17px] font-bold tracking-[-0.02em] text-slate-950">群面实验室</span>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] text-indigo-600">
              BETA
            </span>
          </span>
          <span className="block text-[10px] font-semibold tracking-[0.18em] text-slate-400">GROUPLAB</span>
        </span>
      </button>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onHistory}
          className="flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-600"
        >
          <TrendingUp className="size-3.5" /> <span className="hidden sm:inline">成长档案</span>
        </button>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-500 transition hover:border-slate-300 hover:text-slate-950"
        >
          <ArrowLeft className="size-3.5" /> <span className="hidden sm:inline">返回首页</span>
        </button>
      </div>
    </header>
  );
}

export default function CaseLibrary({
  difficulty,
  onDifficultyChange,
  onSelect,
  onHistory,
  onBack,
}: {
  difficulty: TrainingDifficulty;
  onDifficultyChange: (difficulty: TrainingDifficulty) => void;
  onSelect: (scenarioId: ScenarioId) => void;
  onHistory: () => void;
  onBack: () => void;
}) {
  const difficultyProfile = getDifficulty(difficulty);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f6f7fb]">
      <div className="hero-grid absolute inset-0 opacity-60" />
      <div className="absolute -left-32 top-24 size-96 rounded-full bg-indigo-200/30 blur-3xl" />
      <div className="absolute -right-24 top-10 size-[420px] rounded-full bg-cyan-200/25 blur-3xl" />
      <LibraryHeader onBack={onBack} onHistory={onHistory} />

      <section className="relative mx-auto max-w-[1260px] px-5 pb-20 pt-10 sm:px-8 lg:px-12">
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_390px]">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3 py-2 text-xs font-bold text-indigo-700 shadow-sm backdrop-blur">
              <Sparkles className="size-4" /> AI 无领导小组讨论训练场
            </div>
            <h1 className="text-balance text-[42px] font-black leading-[1.08] tracking-[-0.055em] text-slate-950 sm:text-6xl">
              选择一场训练，
              <span className="text-gradient">练习真正推动团队。</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600">
              三类真实业务场景、三档对抗难度。AI 队友会依据案例持有不同立场，每次发言都会进入证据化复盘。
            </p>
          </div>

          <div className="rounded-[28px] border border-white bg-white/75 p-5 shadow-xl shadow-slate-950/5 backdrop-blur">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-indigo-600" />
              <p className="text-xs font-black tracking-[0.12em] text-slate-900">选择对抗难度</p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {difficultyProfiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  aria-pressed={difficulty === profile.id}
                  onClick={() => onDifficultyChange(profile.id)}
                  className={`rounded-xl border px-2 py-3 text-xs font-black transition ${
                    difficulty === profile.id
                      ? "border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-600/15"
                      : "border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:text-indigo-700"
                  }`}
                >
                  {profile.shortLabel}
                </button>
              ))}
            </div>
            <p className="mt-3 min-h-10 text-[11px] font-semibold leading-5 text-slate-500">
              {difficultyProfile.description}
            </p>
          </div>
        </div>

        <div className="mt-12 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black tracking-[0.18em] text-indigo-600">CASE LIBRARY</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">群面案例库</h2>
          </div>
          <div className="hidden items-center gap-5 text-[11px] font-bold text-slate-400 sm:flex">
            <span className="flex items-center gap-1.5"><Check className="size-3.5 text-emerald-500" /> 无需登录</span>
            <span className="flex items-center gap-1.5"><Check className="size-3.5 text-emerald-500" /> 每轮证据评分</span>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {scenarios.map((item) => {
            const minutes = Math.round(
              (item.timeLimit * difficultyProfile.timeMultiplier) / 60,
            );
            return (
              <article
                key={item.id}
                className="group relative flex min-h-[430px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-950/10"
              >
                <div className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: item.accent }} />
                <div className="flex items-start justify-between gap-4">
                  <div className="grid size-11 place-items-center rounded-2xl text-white shadow-lg" style={{ backgroundColor: item.accent }}>
                    <ScenarioIcon category={item.category} />
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[9px] font-black tracking-[0.12em] text-slate-500">
                    {item.caseNumber}
                  </span>
                </div>
                <p className="mt-5 text-[10px] font-black tracking-[0.14em]" style={{ color: item.accent }}>
                  {item.category}
                </p>
                <h3 className="mt-2 text-xl font-black leading-8 tracking-[-0.03em] text-slate-950">{item.title}</h3>
                <p className="mt-3 line-clamp-3 text-xs leading-6 text-slate-500">{item.brief}</p>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  {[
                    ["训练时长", `${minutes} 分钟`],
                    ["候选方案", `${item.options.length} 个`],
                    ["最终选择", `${item.selectionCount} 个`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[9px] font-bold text-slate-400">{label}</p>
                      <p className="mt-1 text-sm font-black text-slate-800">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-auto pt-6">
                  <p className="mb-3 truncate text-[10px] font-semibold text-slate-400">{item.company}</p>
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-black text-white transition group-hover:bg-indigo-600"
                  >
                    选择此题 · {difficultyProfile.shortLabel}
                    <ArrowRight className="size-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-8 grid gap-3 rounded-[26px] border border-slate-200 bg-white/70 p-4 backdrop-blur sm:grid-cols-3">
          {[
            ["01", "读题与立场", "先理解限制条件和三名 AI 队友的初始主张。"],
            ["02", "实时协作", "提出标准、质疑或整合方案，观察团队状态变化。"],
            ["03", "证据复盘", "用你的原话解释得分，只给一个可执行改进动作。"],
          ].map(([number, title, description]) => (
            <div key={number} className="flex gap-3 rounded-2xl p-3">
              <span className="text-lg font-black text-indigo-200">{number}</span>
              <div>
                <p className="text-xs font-black text-slate-900">{title}</p>
                <p className="mt-1 text-[10px] leading-5 text-slate-500">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
