/* ترتيب جميع الطلاب من الأول إلى الأخير مع ترتيب كثيف للمتساوين */
import { useMemo } from "react";
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

export default function Leaderboard() {
  const { students } = useApp();
  const ranking = useMemo(() => denseXpRanking(students), [students]);
  return (
    <div className="anim-fade">
      <SectionHead icon="trophy" title="ترتيب الطلاب" desc="جميع الطلاب من الأول إلى الأخير حسب نظام النقاط الحالي — المتساوون يحصلون على المركز نفسه" color="bg-gold-400/30 text-gold-600" />
      {ranking.length === 0 ? (
        <div className="dashed-border rounded-3xl bg-white/60 p-14 text-center font-bold text-grape-500">أضف طلابًا لعرض الترتيب</div>
      ) : (
        <div className="space-y-2.5">
          {ranking.map(({ student, rank }, index) => <StudentRankRow key={student.id} student={student} rank={rank} delay={index * 55} />)}
        </div>
      )}
    </div>
  );
}
