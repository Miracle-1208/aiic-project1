"use client";

import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Check,
  Factory,
  Save,
  SlidersHorizontal,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { difficultyProfiles, getDifficulty } from "@/lib/scenario";
import { ScenarioSchema } from "@/lib/scenario-schema";
import type {
  Scenario,
  ScenarioGeneratorInput,
  TrainingDifficulty,
} from "@/lib/types";

const CATEGORIES = ["资源分配", "危机决策", "产品策划", "运营决策"];
const TIME_OPTIONS = [6, 8, 10, 12];

function GeneratorHeader({ onBack }: { onBack: () => void }) {
  return (
    <header className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-2xl bg-[#111827] text-white"><Users className="size-5" /></div>
        <div><p className="text-[17px] font-black text-slate-950">群面实验室</p><p className="text-[9px] font-black tracking-[0.16em] text-indigo-500">CASE GENERATOR</p></div>
      </div>
      <button type="button" onClick={onBack} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-500 transition hover:text-slate-950"><ArrowLeft className="size-3.5" /> 返回题库</button>
    </header>
  );
}

export default function ScenarioGenerator({
  difficulty,
  onDifficultyChange,
  onBack,
  onSave,
}: {
  difficulty: TrainingDifficulty;
  onDifficultyChange: (difficulty: TrainingDifficulty) => void;
  onBack: () => void;
  onSave: (scenario: Scenario, startTraining: boolean) => void;
}) {
  const [form, setForm] = useState<ScenarioGeneratorInput>({
    role: "产品经理",
    industry: "互联网",
    companyType: "成长型科技公司",
    category: "产品策划",
    timeMinutes: 8,
  });
  const [draft, setDraft] = useState<Scenario | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notice, setNotice] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  const difficultyProfile = getDifficulty(difficulty);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const generate = async () => {
    if (!form.role.trim() || !form.industry.trim() || isGenerating) return;
    setIsGenerating(true);
    setNotice("");
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetch("/api/scenario-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
        signal: controller.signal,
      });
      const data = (await response.json()) as {
        scenario?: unknown;
        code?: string;
      };
      if (!response.ok) throw new Error(data.code || "AI_UNAVAILABLE");
      const parsed = ScenarioSchema.safeParse(data.scenario);
      if (!parsed.success || !parsed.data.id.startsWith("custom-")) {
        throw new Error("INVALID_SCENARIO");
      }
      setDraft(parsed.data as Scenario);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setNotice("生成时间较长，本次已停止。可以稍后再试一次。");
      } else if (error instanceof Error && error.message === "AI_NOT_CONFIGURED") {
        setNotice("当前没有配置百炼 API Key，暂时无法生成新题。");
      } else if (error instanceof Error && error.message === "RATE_LIMITED") {
        setNotice("生成次数较频繁，请稍等一分钟再试。");
      } else {
        setNotice("这次题目没有生成成功，请调整岗位或行业后重试。");
      }
    } finally {
      window.clearTimeout(timeout);
      controllerRef.current = null;
      setIsGenerating(false);
    }
  };

  const updateOption = (
    index: number,
    field: "title" | "description" | "cost" | "cycle" | "signal",
    value: string,
  ) => {
    setDraft((current) => {
      if (!current) return current;
      const oldOption = current.options[index];
      const options = current.options.map((option, optionIndex) =>
        optionIndex === index ? { ...option, [field]: value } : option,
      );
      if (field !== "title") return { ...current, options };
      const optionAliases = {
        ...current.optionAliases,
        [oldOption.id]: [
          value,
          ...(current.optionAliases[oldOption.id] ?? []).filter(
            (alias) => alias !== oldOption.title && alias !== value,
          ),
        ],
      };
      const fallbackFinalists = current.fallbackFinalists.map((title) =>
        title === oldOption.title ? value : title,
      ) as [string, string];
      return { ...current, options, optionAliases, fallbackFinalists };
    });
  };

  const save = (startTraining: boolean) => {
    if (!draft) return;
    const parsed = ScenarioSchema.safeParse(draft);
    if (!parsed.success) {
      setNotice("还有内容为空或过长，请检查题目标题、背景、限制条件和五个方案。");
      return;
    }
    onSave(parsed.data as Scenario, startTraining);
  };

  return (
    <main className="min-h-screen bg-[#f5f7fa]">
      <GeneratorHeader onBack={onBack} />
      <section className="mx-auto max-w-[1180px] px-5 pb-20 pt-4 sm:px-8 lg:px-12">
        <div className="overflow-hidden rounded-[32px] bg-[#111827] p-7 text-white shadow-2xl shadow-slate-950/15 sm:p-10">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-black tracking-[0.12em] text-indigo-300"><Sparkles className="size-4" /> AI 岗位定制题库</div>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.045em] sm:text-4xl">把目标岗位，变成一场真实群面</h1>
            <p className="mt-4 text-sm leading-7 text-slate-400">AI 会生成虚构但内部一致的业务背景、五个方案、三名候选人立场和对应评分标准。生成后可以先修改，再保存或直接训练。</p>
          </div>
        </div>

        {!draft ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 sm:p-8">
              <div className="flex items-center gap-2 text-xs font-black text-indigo-700"><BriefcaseBusiness className="size-4" /> 定义训练目标</div>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className="block"><span className="text-[11px] font-black text-slate-700">目标岗位</span><div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4"><Target className="size-4 text-slate-400" /><input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} maxLength={40} placeholder="例如：产品经理" className="h-13 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none" /></div></label>
                <label className="block"><span className="text-[11px] font-black text-slate-700">所属行业</span><div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4"><Factory className="size-4 text-slate-400" /><input value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })} maxLength={40} placeholder="例如：新能源" className="h-13 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none" /></div></label>
                <label className="block sm:col-span-2"><span className="text-[11px] font-black text-slate-700">公司或组织类型</span><div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4"><Building2 className="size-4 text-slate-400" /><input value={form.companyType} onChange={(event) => setForm({ ...form, companyType: event.target.value })} maxLength={60} placeholder="例如：快速扩张的消费品牌" className="h-13 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none" /></div></label>
              </div>

              <div className="mt-6"><p className="text-[11px] font-black text-slate-700">题目类型</p><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{CATEGORIES.map((category) => <button key={category} type="button" onClick={() => setForm({ ...form, category })} className={`h-11 rounded-xl border text-xs font-black transition ${form.category === category ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-indigo-200"}`}>{category}</button>)}</div></div>
              <div className="mt-6"><p className="text-[11px] font-black text-slate-700">基础讨论时长</p><div className="mt-2 grid grid-cols-4 gap-2">{TIME_OPTIONS.map((minutes) => <button key={minutes} type="button" onClick={() => setForm({ ...form, timeMinutes: minutes })} className={`h-11 rounded-xl border text-xs font-black transition ${form.timeMinutes === minutes ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-500"}`}>{minutes} 分钟</button>)}</div></div>

              <button type="button" onClick={() => void generate()} disabled={isGenerating || !form.role.trim() || !form.industry.trim()} className="mt-7 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-sm font-black text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">{isGenerating ? "AI 正在设计案例和候选人立场……" : "生成专属群面题"}<Sparkles className={`size-4 ${isGenerating ? "animate-pulse" : ""}`} /></button>
              {notice && <p className="mt-3 text-center text-[11px] font-semibold text-amber-600" aria-live="polite">{notice}</p>}
            </section>

            <aside className="space-y-5">
              <section className="rounded-[28px] border border-slate-200 bg-white p-6"><div className="flex items-center gap-2 text-xs font-black text-slate-800"><SlidersHorizontal className="size-4 text-indigo-600" /> 训练难度</div><div className="mt-4 grid grid-cols-3 gap-2">{difficultyProfiles.map((profile) => <button key={profile.id} type="button" onClick={() => onDifficultyChange(profile.id)} className={`rounded-xl border px-2 py-3 text-xs font-black ${difficulty === profile.id ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 text-slate-500"}`}>{profile.shortLabel}</button>)}</div><p className="mt-3 text-[10px] font-semibold leading-5 text-slate-500">{difficultyProfile.description}</p></section>
              <section className="rounded-[28px] border border-emerald-100 bg-emerald-50 p-6"><p className="text-xs font-black text-emerald-800">生成内容包含</p><div className="mt-4 space-y-3">{["业务背景、目标和约束", "五个有真实取舍的方案", "三名 AI 候选人的不同立场", "岗位相关的证据评分标准"].map((item) => <p key={item} className="flex items-center gap-2 text-[11px] font-semibold text-emerald-950"><Check className="size-3.5 text-emerald-600" /> {item}</p>)}</div></section>
              <p className="px-2 text-[9px] leading-5 text-slate-400">生成案例使用虚构公司与数据，仅用于面试训练；请勿将其当作真实企业资料。</p>
            </aside>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 sm:p-8">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-[10px] font-black tracking-[0.13em] text-indigo-600">PREVIEW & EDIT</p><h2 className="mt-2 text-2xl font-black text-slate-950">预览并修改生成结果</h2></div><button type="button" onClick={() => { setDraft(null); setNotice(""); }} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-500"><Sparkles className="size-3.5" /> 重新生成</button></div>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className="block"><span className="text-[10px] font-black text-slate-500">题目标题</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} maxLength={60} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none focus:border-indigo-300" /></label>
                <label className="block"><span className="text-[10px] font-black text-slate-500">公司与岗位</span><input value={draft.company} onChange={(event) => setDraft({ ...draft, company: event.target.value })} maxLength={60} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none focus:border-indigo-300" /></label>
                <label className="block sm:col-span-2"><span className="text-[10px] font-black text-slate-500">案例背景</span><textarea value={draft.brief} onChange={(event) => setDraft({ ...draft, brief: event.target.value })} rows={4} maxLength={500} className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700 outline-none focus:border-indigo-300" /></label>
                <label className="block sm:col-span-2"><span className="text-[10px] font-black text-slate-500">讨论目标</span><textarea value={draft.goal} onChange={(event) => setDraft({ ...draft, goal: event.target.value })} rows={3} maxLength={300} className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700 outline-none focus:border-indigo-300" /></label>
                <label className="block sm:col-span-2"><span className="text-[10px] font-black text-slate-500">限制条件（每行一条）</span><textarea value={draft.constraints.join("\n")} onChange={(event) => setDraft({ ...draft, constraints: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean).slice(0, 5) })} rows={4} className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700 outline-none focus:border-indigo-300" /></label>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 sm:p-8"><div className="flex items-center justify-between"><div><p className="text-xs font-black text-slate-900">五个候选方案</p><p className="mt-1 text-[10px] text-slate-400">可以修改名称、描述、成本、周期和证据信号</p></div><span className="rounded-full bg-indigo-50 px-3 py-1.5 text-[9px] font-black text-indigo-600">最终选择 2 个</span></div><div className="mt-5 space-y-4">{draft.options.map((option, index) => <div key={option.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="grid gap-3 sm:grid-cols-[36px_1fr_120px_100px]"><span className="grid size-9 place-items-center rounded-xl bg-white text-xs font-black text-indigo-600">{index + 1}</span><input value={option.title} onChange={(event) => updateOption(index, "title", event.target.value)} maxLength={40} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-900 outline-none" /><input value={option.cost} onChange={(event) => updateOption(index, "cost", event.target.value)} maxLength={30} aria-label={`方案${index + 1}成本`} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 outline-none" /><input value={option.cycle} onChange={(event) => updateOption(index, "cycle", event.target.value)} maxLength={30} aria-label={`方案${index + 1}周期`} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 outline-none" /></div><textarea value={option.description} onChange={(event) => updateOption(index, "description", event.target.value)} maxLength={160} rows={2} aria-label={`方案${index + 1}描述`} className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-xs leading-6 text-slate-600 outline-none" /><input value={option.signal} onChange={(event) => updateOption(index, "signal", event.target.value)} maxLength={100} aria-label={`方案${index + 1}证据信号`} className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-500 outline-none" /></div>)}</div></section>

            <section className="grid gap-5 lg:grid-cols-[1fr_360px]"><div className="rounded-[28px] border border-slate-200 bg-white p-6"><p className="text-xs font-black text-slate-900">AI 候选人初始立场</p><div className="mt-4 grid gap-3 sm:grid-cols-3">{[["程野", draft.participantStances.cheng], ["林乔", draft.participantStances.lin], ["周可", draft.participantStances.zhou]].map(([name, stance]) => <div key={name} className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-black text-indigo-600">{name}</p><p className="mt-2 text-[11px] font-semibold leading-5 text-slate-600">{stance}</p></div>)}</div></div><div className="rounded-[28px] border border-indigo-100 bg-indigo-50 p-6"><p className="text-xs font-black text-indigo-800">评分观察维度</p><div className="mt-4 flex flex-wrap gap-2">{draft.referenceCriteria.map((criterion) => <span key={criterion.label} className="rounded-xl bg-white px-3 py-2 text-[10px] font-black text-indigo-700">{criterion.label}</span>)}</div></div></section>

            {notice && <p className="text-center text-[11px] font-semibold text-amber-600" aria-live="polite">{notice}</p>}
            <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => save(false)} className="flex h-13 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-700 transition hover:border-indigo-200"><Save className="size-4" /> 保存到题库</button><button type="button" onClick={() => save(true)} className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-sm font-black text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700">保存并开始训练 <ArrowRight className="size-4" /></button></div>
          </div>
        )}
      </section>
    </main>
  );
}
