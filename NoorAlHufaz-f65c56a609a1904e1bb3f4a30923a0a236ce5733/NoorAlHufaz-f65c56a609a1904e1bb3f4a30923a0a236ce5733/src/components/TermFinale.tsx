/* ختام الترم — ترتيب الطلاب الكامل من الأكثر للأقل حسب المستويات (يُحسب تلقائيًا) */
import { useMemo, useState } from "react";
import { useApp } from "../appState";
import { ar, levelInfo, rankOf, type Student } from "../core";
import Avatar from "./Avatar";
import { Coin, heartFade, Icon, SectionHead } from "./ui";

export default function TermFinale() {
  const { students, weeksLog, week } = useApp();
  const [showFinale, setShowFinale] = useState(false);

  const ranking = useMemo(
    () =>
      [...students].sort(
        (a, b) =>
          levelInfo(b.xp).level - levelInfo(a.xp).level || b.xp - a.xp || a.name.localeCompare(b.name, "ar")
      ),
    [students]
  );

  const totalPoints = students.reduce((n, s) => n + s.xp, 0);
  const topLevel = ranking.length ? levelInfo(ranking[0].xp).level : 0;
  const completedWeeks = weeksLog.length;

  return (
    <div className="anim-fade">
      <SectionHead
        icon="flag"
        title="ختام الترم"
        desc="الترتيب النهائي الكامل — يُحسب تلقائيًا حسب المستويات ثم النقاط، بلا أي إعداد"
        color="bg-coral-400/20 text-coral-500"
      />

      {/* إحصاءات الترم */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: "calendar", label: "أسابيع مكتملة", value: ar(completedWeeks), color: "bg-grape-600/12 text-grape-600" },
          { icon: "users", label: "عدد الطلاب", value: ar(students.length), color: "bg-mint-400/20 text-mint-600" },
          { icon: "bolt", label: "مجموع النقاط الموزعة", value: ar(totalPoints), color: "bg-gold-400/25 text-gold-600" },
          { icon: "crown", label: "أعلى مستوى وصله طالب", value: ar(topLevel), color: "bg-coral-400/20 text-coral-500" },
        ].map((s, i) => (
          <div key={s.label} className="anim-slide-up card-shine rounded-2xl border-2 border-grape-200 bg-white p-4" style={{ animationDelay: `${i * 60}ms` }}>
            <span className={`mb-2 grid h-10 w-10 place-items-center rounded-xl ${s.color}`}>
              <Icon name={s.icon} className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <p className="font-display text-2xl font-extrabold leading-7 text-ink">{s.value}</p>
            <p className="text-[11px] font-bold text-grape-700/60">{s.label}</p>
          </div>
        ))}
      </div>

      {/* زر العرض الكامل */}
      <div className="mt-6 flex flex-col items-center gap-3 rounded-[28px] border-2 border-gold-500/40 bg-gradient-to-l from-gold-400/20 via-white to-white p-8 text-center">
        <Icon name="flag" className="anim-wiggle h-14 w-14 text-gold-500" strokeWidth={1.8} />
        <p className="font-display text-2xl font-extrabold text-ink">الترتيب النهائي للترم</p>
        <p className="max-w-lg text-sm font-bold leading-6 text-grape-700/70">
          اضغط الزر لعرض ترتيب جميع الطلاب من الأكثر إلى الأقل على الشاشة الكاملة — مع منصة تتويج للأوائل الثلاثة.
          الترتيب يُحسب تلقائيًا: المستوى الأعلى أولًا، ثم مجموع النقاط.
        </p>
        <button
          type="button"
          onClick={() => setShowFinale(true)}
          disabled={students.length === 0}
          className="anim-glow flex items-center gap-2 rounded-2xl bg-gold-500 px-10 py-4 font-display text-xl font-extrabold text-ink shadow-[0_6px_0_#b57a0a] transition-all hover:brightness-110 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon name="play" fill className="h-6 w-6" />
          عرض الترتيب الكامل
        </button>
        {week > 1 && <p className="text-[11px] font-bold text-grape-700/55">نتائج الأسابيع السابقة محفوظة في أرشيف الحفل الأسبوعي</p>}
      </div>

      {/* العرض الكامل */}
      {showFinale && <FinaleOverlay ranking={ranking} onClose={() => setShowFinale(false)} />}
    </div>
  );
}

/* ===== عرض الترتيب الكامل بملء الشاشة ===== */
function FinaleOverlay({
  ranking,
  onClose,
}: {
  ranking: Student[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-gradient-to-b from-grape-950 via-grape-900 to-grape-950">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[...Array(18)].map((_, i) => (
          <span
            key={i}
            className="anim-twinkle absolute h-1.5 w-1.5 bg-gold-300"
            style={{ top: `${(i * 53) % 100}%`, left: `${(i * 29) % 100}%`, animationDelay: `${(i % 6) * 0.4}s` }}
          />
        ))}
      </div>
      <div className="relative mx-auto max-w-3xl px-6 py-12">
        <div className="anim-slide-down text-center">
          <Icon name="flag" className="anim-wiggle mx-auto h-16 w-16 text-gold-400" strokeWidth={1.8} />
          <h1 className="mt-4 font-display text-4xl font-extrabold text-white sm:text-5xl">ترتيب الترم الكامل</h1>
          <p className="mt-2 text-base font-bold text-grape-300">من الأكثر إلى الأقل — حسب المستويات ثم النقاط</p>
        </div>

        {/* منصة الأوائل */}
        <div className="mt-10 flex items-end justify-center gap-4">
          {[1, 2, 3].map((place) => {
            const s = ranking[place - 1];
            if (!s) return null;
            const { level } = levelInfo(s.xp);
            const heights = { 1: "h-36", 2: "h-26", 3: "h-20" } as const;
            const bgs = {
              1: "border-gold-500 bg-gradient-to-b from-gold-300 to-gold-500 shadow-[0_0_40px_rgba(247,183,51,0.45)]",
              2: "border-slate-300 bg-gradient-to-b from-slate-100 to-slate-300",
              3: "border-amber-500 bg-gradient-to-b from-amber-200 to-amber-400",
            } as const;
            return (
              <div key={s.id} className="anim-slide-up flex w-28 flex-col items-center sm:w-32" style={{ animationDelay: `${place === 1 ? 700 : place === 2 ? 200 : 1200}ms` }}>
                {place === 1 && <Icon name="crown" className="anim-bounce-soft mb-1 h-8 w-8 text-gold-400" strokeWidth={2} />}
                <div className={heartFade(s.hearts)}>
                  <Avatar photo={s.photo} name={s.name} size={place === 1 ? 92 : 76} frame={s.frame} crown={s.crown} glow={s.glow} />
                </div>
                <p className="mt-2 max-w-full truncate font-display text-base font-extrabold text-white">{s.name}</p>
                <p className="text-[10px] font-bold text-grape-300">مستوى {ar(level)} · {rankOf(level)}</p>
                <div className={`mt-2 w-full rounded-t-2xl border-2 border-b-0 ${heights[place as 1 | 2 | 3]} ${bgs[place as 1 | 2 | 3]} grid place-items-start justify-center pt-2`}>
                  <span className="font-display text-xl font-extrabold text-grape-900">{ar(place)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* القائمة الكاملة */}
        <div className="mt-10">
          <RankList ranking={ranking} />
        </div>

        <div className="mt-10 text-center">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-gold-500 px-10 py-3.5 font-display text-xl font-extrabold text-ink shadow-[0_5px_0_#b57a0a] transition-all hover:brightness-110 active:translate-y-1 active:shadow-none"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

function RankList({ ranking }: { ranking: Student[] }) {
  return (
    <div className="space-y-2">
      {ranking.map((s, i) => {
        const { level } = levelInfo(s.xp);
        const medals = ["bg-gold-500 text-white", "bg-slate-400 text-white", "bg-amber-600 text-white"];
        return (
          <div
            key={s.id}
            className="anim-slide-up flex items-center gap-3 rounded-2xl border-2 border-white/10 bg-white/5 px-3 py-2.5 backdrop-blur-sm"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-base font-extrabold ${i < 3 ? medals[i] : "bg-white/10 text-grape-300"}`}>
              {ar(i + 1)}
            </span>
            <div className={heartFade(s.hearts)}>
              <Avatar photo={s.photo} name={s.name} size={48} frame={s.frame} crown={s.crown} glow={s.glow} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-base font-extrabold text-white">{s.name}</p>
              <p className="text-[11px] font-bold text-grape-300">
                مستوى {ar(level)} · {rankOf(level)}
              </p>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-gold-400/20 px-2.5 py-1 text-xs font-extrabold text-gold-300">
              <Icon name="bolt" fill className="h-3.5 w-3.5" />
              {ar(s.xp)}
            </span>
            <span className="hidden items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-extrabold text-grape-300 sm:flex">
              <Coin className="h-3.5 w-3.5" />
              {ar(s.coins)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
