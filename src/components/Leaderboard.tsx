/* لوحة المتصدرين — منصة تتويج للأوائل الثلاثة ثم بقية الترتيب */
import { useApp } from "../appState";
import { ar, levelInfo, rankOf, type Student } from "../core";
import Avatar from "./Avatar";
import { CoinChip, heartFade, Icon, LevelBadge, SectionHead, XpBar } from "./ui";

function PodiumCol({ s, place, delay }: { s: Student; place: 1 | 2 | 3; delay: number }) {
  const { level } = levelInfo(s.xp);
  const heights = { 1: "h-44", 2: "h-32", 3: "h-24" } as const;
  const bgs = {
    1: "bg-gradient-to-b from-gold-300 to-gold-500 border-gold-500 shadow-[0_0_44px_rgba(247,183,51,0.5)]",
    2: "bg-gradient-to-b from-slate-100 to-slate-300 border-slate-400",
    3: "bg-gradient-to-b from-amber-200 to-amber-400 border-amber-500",
  } as const;
  return (
    <div className="anim-slide-up flex w-28 flex-col items-center sm:w-auto" style={{ animationDelay: `${delay}ms` }}>
      <div className="relative">
        {place === 1 && s.crown !== null && (
          <div className="anim-bounce-soft absolute -top-7 left-1/2 z-10 -translate-x-1/2">
            <Icon name="crown" className="h-9 w-9 text-gold-500" strokeWidth={2} />
          </div>
        )}
        <div className={heartFade(s.hearts)}>
          <Avatar photo={s.photo} name={s.name} size={place === 1 ? 100 : 82} frame={s.frame} crown={s.crown} glow={s.glow} />
        </div>
        <span
          className={`absolute -bottom-3 left-1/2 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full border-4 border-white font-display text-base font-extrabold shadow-lg ${
            place === 1 ? "bg-gold-400 text-gold-600" : place === 2 ? "bg-slate-300 text-slate-600" : "bg-amber-400 text-amber-700"
          }`}
        >
          {ar(place)}
        </span>
      </div>
      <p className="mt-5 max-w-full truncate font-display text-lg font-extrabold text-ink">{s.name}</p>
      <p className="text-xs font-bold text-grape-500">{rankOf(level)}</p>
      <div className="mt-1.5">
        <LevelBadge level={level} className="px-2! py-0! text-xs!" />
      </div>
      <div className={`mt-3 w-24 rounded-t-2xl border-2 border-b-0 sm:w-32 ${heights[place]} ${bgs[place]} grid place-items-start justify-center pt-3`}>
        <span className={`flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 text-xs font-extrabold shadow ${place === 1 ? "text-gold-600" : "text-grape-600"}`}>
          <Icon name="bolt" fill className="h-3.5 w-3.5" />
          {ar(s.xp)}
        </span>
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const { sorted } = useApp();
  const [first, second, third, ...rest] = sorted;

  return (
    <div className="anim-fade">
      <SectionHead
        icon="trophy"
        title="لوحة المتصدرين"
        desc="الترتيب حسب المستويات ثم النقاط — القمة تنتظر حافظًا جديدًا كل أسبوع"
        color="bg-gold-400/30 text-gold-600"
      />

      {sorted.length === 0 ? (
        <div className="dashed-border rounded-3xl bg-white/60 p-14 text-center text-grape-500 font-bold">
          أضف طلابًا لتشتعل المنافسة!
        </div>
      ) : (
        <>
          <div className="mb-8 rounded-[28px] border-2 border-grape-200 bg-gradient-to-b from-grape-100/80 to-white p-6 pt-10">
            <div className="flex items-end justify-center gap-4 sm:gap-10">
              {second && <PodiumCol s={second} place={2} delay={150} />}
              {first && <PodiumCol s={first} place={1} delay={0} />}
              {third && <PodiumCol s={third} place={3} delay={300} />}
            </div>
          </div>

          <div className="space-y-2.5">
            {rest.map((s, i) => {
              const place = i + 4;
              const { level } = levelInfo(s.xp);
              return (
                <div
                  key={s.id}
                  className="anim-slide-up card-shine flex flex-wrap items-center gap-3 rounded-2xl border-2 border-grape-200/80 bg-white p-3 transition-all hover:border-grape-300 hover:shadow-[0_14px_28px_-18px_rgba(86,40,157,0.5)]"
                  style={{ animationDelay: `${350 + i * 70}ms` }}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-grape-100 font-display text-lg font-extrabold text-grape-600">
                    {ar(place)}
                  </span>
                  <div className={heartFade(s.hearts)}>
                    <Avatar photo={s.photo} name={s.name} size={52} frame={s.frame} crown={s.crown} glow={s.glow} />
                  </div>
                  <div className="min-w-32 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-base font-extrabold text-ink">{s.name}</span>
                      <LevelBadge level={level} className="px-2! py-0! text-xs!" />
                    </div>
                    <div className="mt-1.5 max-w-72">
                      <XpBar xp={s.xp} compact />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 rounded-full bg-grape-600/12 px-3 py-1 text-sm font-extrabold text-grape-700">
                      <Icon name="bolt" fill className="h-3.5 w-3.5" />
                      {ar(s.xp)}
                    </span>
                    <CoinChip value={s.coins} className="text-xs!" />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
