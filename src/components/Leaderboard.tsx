/* ترتيب جميع الطلاب من الأول إلى الأخير مع ترتيب كثيف للمتساوين */
import { useMemo, useState } from "react";
import { useApp } from "../appState";
import { ar, denseXpRanking, levelInfo, type Student } from "../core";
import Avatar from "./Avatar";
import { CoinChip, heartFade, Icon, LevelBadge, SectionHead, XpBar } from "./ui";

const rankColor = (rank: number): string => {
  if (rank === 1) return "bg-gold-500 text-white";
  if (rank === 2) return "bg-slate-400 text-white";
  if (rank === 3) return "bg-amber-600 text-white";
  return "bg-grape-100 text-grape-600";
};

function StudentRankRow({ student, rank, delay }: { student: Student; rank: number; delay: number }) {
  const { level } = levelInfo(student.xp);
  return (
    <div className="anim-slide-up card-shine flex flex-wrap items-center gap-3 rounded-2xl border-2 border-grape-200/80 bg-white p-3 transition-all hover:border-grape-300 hover:shadow-[0_14px_28px_-18px_rgba(86,40,157,0.5)]" style={{ animationDelay: `${delay}ms` }}>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-lg font-extrabold ${rankColor(rank)}`}>{ar(rank)}</span>
      <div className={heartFade(student.hearts)}>
        <Avatar photo={student.photo} name={student.name} size={54} frame={student.frame} crown={student.crown} glow={student.glow} />
      </div>
      <div className="min-w-32 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-base font-extrabold text-ink">{student.name}</span>
          <LevelBadge level={level} className="px-2! py-0! text-xs!" />
        </div>
        <div className="mt-1.5 max-w-72"><XpBar xp={student.xp} compact /></div>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 rounded-full bg-grape-600/12 px-3 py-1 text-sm font-extrabold text-grape-700"><Icon name="bolt" fill className="h-3.5 w-3.5" />{ar(student.xp)}</span>
        <CoinChip value={student.coins} className="text-xs!" />
      </div>
    </div>
  );
}

const normalizeArabic = (text: string): string => {
  return text
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim()
    .toLowerCase();
};

export default function Leaderboard() {
  const { students, halaqas } = useApp();
  const [selectedHalaqa, setSelectedHalaqa] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // فلترة الطلاب حسب الحلقة أولًا لحساب الترتيب الخاص بالحلقة بدقة
  const filteredByHalaqa = useMemo(() => {
    if (selectedHalaqa === "all") return students;
    if (selectedHalaqa === "none") return students.filter((s) => !s.halaqaId);
    return students.filter((s) => s.halaqaId === selectedHalaqa);
  }, [students, selectedHalaqa]);

  // حساب الترتيب الكثيف مع الحفاظ على التعادل في النقاط
  const ranking = useMemo(() => denseXpRanking(filteredByHalaqa), [filteredByHalaqa]);

  // البحث عن طالب بالاسم الجزئي دون المساس بالمركز المحسوب
  const displayedRanking = useMemo(() => {
    const q = normalizeArabic(searchQuery);
    if (!q) return ranking;
    return ranking.filter(({ student }) => normalizeArabic(student.name).includes(q));
  }, [ranking, searchQuery]);

  return (
    <div className="anim-fade">
      <SectionHead
        icon="trophy"
        title="ترتيب الطلاب"
        desc="جميع الطلاب من الأول إلى الأخير حسب نظام النقاط الحالي — المتساوون يحصلون على المركز نفسه"
        color="bg-gold-400/30 text-gold-600"
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-extrabold text-grape-600">
          تصفية الترتيب حسب الحلقة
          <select
            value={selectedHalaqa}
            onChange={(e) => setSelectedHalaqa(e.target.value)}
            className="field-control mt-1 w-full"
          >
            <option value="all">جميع الحلقات ({ar(students.length)} طالب)</option>
            {halaqas.map((h) => {
              const count = students.filter((s) => s.halaqaId === h.id).length;
              return (
                <option key={h.id} value={h.id}>
                  {h.name} ({ar(count)} طالب)
                </option>
              );
            })}
            {students.some((s) => !s.halaqaId) && (
              <option value="none">
                بلا حلقة ({ar(students.filter((s) => !s.halaqaId).length)} طالب)
              </option>
            )}
          </select>
        </label>

        <label className="text-xs font-extrabold text-grape-600">
          بحث عن طالب
          <div className="relative mt-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="اكتب اسم الطالب أو جزءًا منه..."
              className="field-control w-full pe-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 end-2.5 flex items-center text-xs font-extrabold text-grape-400 hover:text-coral-500"
              >
                ✕
              </button>
            )}
          </div>
        </label>
      </div>

      {ranking.length === 0 ? (
        <div className="dashed-border rounded-3xl bg-white/60 p-14 text-center font-bold text-grape-500">
          لا يوجد طلاب في هذه الحلقة لعرض ترتيبهم
        </div>
      ) : displayedRanking.length === 0 ? (
        <div className="dashed-border rounded-3xl bg-white/60 p-14 text-center font-bold text-grape-500">
          لا يوجد طالب يطابق البحث «{searchQuery}»
        </div>
      ) : (
        <div className="space-y-2.5">
          {displayedRanking.map(({ student, rank }, index) => (
            <StudentRankRow key={student.id} student={student} rank={rank} delay={Math.min(index * 35, 350)} />
          ))}
        </div>
      )}
    </div>
  );
}
