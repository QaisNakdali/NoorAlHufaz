/* الحفل الأسبوعي — يجهّز المعلم الجوائز والرحلة ثم يضغط زرًا واحدًا للعرض */
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../appState";
import {
  ar,
  AWARDS_META,
  championCriteria,
  championTop,
  CHAMPION_TIERS,
  isChampionEligible,
  TRIP_DAYS,
  type CeremonyPicks,
  type ShopProduct,
  type Student,
  type TripDay,
} from "../core";
import { sfx } from "../sound";
import Avatar from "./Avatar";
import CosmeticThumb from "./CosmeticThumb";
import { BigBtn, Coin, heartFade, Icon, SectionHead } from "./ui";

/* اقتراح للجوائز الفردية من الكشف */
function suggest(key: keyof CeremonyPicks, students: Student[]): string | null {
  if (students.length === 0) return null;
  if (key === "behavior")
    return [...students].sort((a, b) => a.heartsLostWeek - b.heartsLostWeek || b.hearts - a.hearts)[0].id;
  if (key === "improved")
    return [...students]
      .map((s) => ({ s, rec: s.days ? Object.values(s.days).reduce((n, d) => n + (d.h ? 1 : 0) + (d.r ? 1 : 0), 0) : 0 }))
      .sort((a, b) => b.rec - a.rec || b.s.weekXp - a.s.weekXp)[0].s.id;
  return null;
}

/* اقتراح بطل الأسبوع لكل مركز — من المؤهلين فقط */
function suggestChampion(key: keyof CeremonyPicks, students: Student[], tripOn: boolean, trip: string[]): string | null {
  const top = championTop(students, tripOn, trip);
  const idx = key === "champion1" ? 0 : key === "champion2" ? 1 : 2;
  return top[idx]?.id ?? null;
}

/* ===== صفحة منتج في إعلان «وصل حديثًا» ===== */
function NewProductCard({ p, delay }: { p: ShopProduct; delay: number }) {
  return (
    <div className="anim-slide-up overflow-hidden rounded-2xl border-2 border-gold-400/40 bg-white text-ink" style={{ animationDelay: `${delay}ms` }}>
      <div className="h-28 overflow-hidden">
        {p.image ? (
          <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
        ) : p.kind === "cosmetic" ? (
          <CosmeticThumb slot={p.slot} value={p.value} />
        ) : (
          <div className="grid h-full w-full place-items-center bg-grape-100 text-grape-500">
            <Icon name={p.icon} className="h-10 w-10" strokeWidth={1.8} />
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-display text-base font-extrabold">{p.name}</p>
          <span className="rounded-full bg-gold-400 px-2 py-0.5 text-[9px] font-extrabold text-ink">جديد</span>
        </div>
        <p className="mt-0.5 text-[11px] font-bold text-grape-700/60">{p.desc}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-gold-400/25 px-2.5 py-1 text-xs font-extrabold text-gold-600">
            <Coin className="h-3.5 w-3.5" />
            {ar(p.price)}
          </span>
          <span className="rounded-full bg-grape-600/12 px-2.5 py-1 text-[10px] font-extrabold text-grape-600">يُفتح في المستوى {ar(p.minLevel)}</span>
        </div>
      </div>
    </div>
  );
}

/* ===== لوحة التحضير ===== */
export default function CeremonyPanel() {
  const {
    students,
    week,
    weekName,
    setWeekName,
    weeksLog,
    ceremonyPicks,
    setCeremonyPick,
    removeWeekLog,
    tripOn,
    tripDay,
    tripAttendees,
    setTrip,
    toggleTripAttendee,
    showNewProducts,
    setShowNewProducts,
    startCeremony,
    startWeek,
  } = useApp();
  const [armWeek, setArmWeek] = useState(false);
  const [openLog, setOpenLog] = useState<number | null>(null);
  const isRealPick = (v: string | null | undefined): boolean => !!v && v !== "none";
  const pickedCount =
    AWARDS_META.filter((m) => isRealPick(ceremonyPicks[m.key])).length +
    CHAMPION_TIERS.filter((t) => isRealPick(ceremonyPicks[t.key])).length;

  /* إلغاء بطولات الأسبوع لهذا الأسبوع (تُضبط المراكز الثلاثة على "لا أحد") */
  const champsCanceled = CHAMPION_TIERS.every((t) => ceremonyPicks[t.key] === "none");
  const toggleChamps = () => CHAMPION_TIERS.forEach((t) => setCeremonyPick(t.key, champsCanceled ? null : "none"));

  useEffect(() => {
    if (!armWeek) return;
    const t = window.setTimeout(() => setArmWeek(false), 3500);
    return () => clearTimeout(t);
  }, [armWeek]);

  return (
    <div className="anim-fade">
      <SectionHead
        icon="gift"
        title="الحفل الأسبوعي"
        desc="سمّ الأسبوع، حدّد الفائزين، سجّل الرحلة — ثم زر واحد يعرض الاحتفال كاملًا"
        color="bg-gold-400/30 text-gold-600"
        extra={
          <div className="flex items-center gap-2">
            <span className="rounded-2xl border-2 border-grape-200 bg-white px-3 py-2 text-xs font-extrabold text-grape-500">الأسبوع الحالي</span>
            <input
              value={weekName}
              onChange={(e) => setWeekName(e.target.value)}
              placeholder="سمّ الأسبوع… (اختياري)"
              className="h-11 w-48 rounded-2xl border-2 border-grape-200 bg-white px-3.5 font-display text-sm font-bold text-ink outline-none transition focus:border-gold-500"
            />
          </div>
        }
      />

      {/* ===== كشف الرحلة (اختياري) ===== */}
      <div className="anim-slide-up rounded-3xl border-2 border-mint-400/50 bg-gradient-to-b from-mint-400/12 to-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-mint-600 text-white shadow-[0_3px_0_#0a7a50]">
            <Icon name="flag" className="h-6 w-6" strokeWidth={2.1} />
          </span>
          <div className="flex-1 min-w-52">
            <p className="font-display text-lg font-extrabold leading-6 text-ink">كشف الرحلة (اختياري)</p>
            <p className="text-[11px] font-bold text-grape-700/65">
              ليست كل الأسابيع فيها رحلة — فعّلها عند الحاجة. من يحضر الرحلة يأخذ +٢٠ عملة وتزداد فرصته ليكون بطل الأسبوع
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTrip(!tripOn, tripOn ? null : tripDay ?? "fri")}
            className={`relative h-8 w-16 shrink-0 rounded-full transition-colors ${tripOn ? "bg-mint-600" : "bg-grape-200"}`}
            aria-label="تفعيل الرحلة"
          >
            <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${tripOn ? "start-9" : "start-1"}`} />
          </button>
        </div>

        {tripOn && (
          <div className="anim-fade mt-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold text-grape-700">يوم الرحلة:</span>
              {TRIP_DAYS.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setTrip(true, d.key)}
                  className={`rounded-full border-2 px-4 py-1.5 font-display text-sm font-extrabold transition active:scale-95 ${
                    tripDay === d.key
                      ? "border-mint-600 bg-mint-600 text-white shadow-[0_3px_0_#0a7a50]"
                      : "border-grape-200 bg-white text-grape-500 hover:border-mint-600 hover:text-mint-600"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="mt-2.5 text-xs font-extrabold text-grape-700">من حضر الرحلة؟ (اضغط على الصورة — كل حضور = +٢٠ عملة):</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {students.map((s) => {
                const on = tripAttendees.includes(s.id);
                return (
                  <button key={s.id} type="button" onClick={() => toggleTripAttendee(s.id)} className="group flex flex-col items-center gap-1" title={s.name}>
                    <span className={`relative rounded-2xl p-1 transition-all active:scale-90 ${on ? "bg-mint-400/30 ring-2 ring-mint-600" : "opacity-70 hover:opacity-100"}`}>
                      <Avatar photo={s.photo} name={s.name} size={48} frame={s.frame} crown={s.crown} glow={s.glow} />
                      {on && (
                        <span className="absolute -bottom-1 -end-1 grid h-5 w-5 place-items-center rounded-full bg-mint-600 text-white">
                          <Icon name="check" className="h-3 w-3" strokeWidth={3.6} />
                        </span>
                      )}
                    </span>
                    <span className={`text-[10px] font-extrabold ${on ? "text-mint-600" : "text-grape-400"}`}>{s.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ===== إعلان منتجات المتجر الجديدة (اختياري) ===== */}
      <div className="anim-slide-up mt-4 flex flex-wrap items-center gap-3 rounded-3xl border-2 border-gold-500/40 bg-gradient-to-b from-gold-400/10 to-white p-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gold-500 text-white shadow-[0_3px_0_#b57a0a]">
          <Icon name="store" className="h-6 w-6" strokeWidth={2.1} />
        </span>
        <div className="flex-1 min-w-52">
          <p className="font-display text-lg font-extrabold leading-6 text-ink">أعلن عن منتجات المتجر الجديدة</p>
          <p className="text-[11px] font-bold text-grape-700/65">
            تعرض صفحة «وصل حديثًا» في نهاية الحفل ما أضفته للمتجر هذا الأسبوع — اتركها مطفأة إن لم تضف شيئًا
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewProducts(!showNewProducts)}
          className={`relative h-8 w-16 shrink-0 rounded-full transition-colors ${showNewProducts ? "bg-gold-500" : "bg-grape-200"}`}
          aria-label="تفعيل إعلان المنتجات"
        >
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${showNewProducts ? "start-9" : "start-1"}`} />
        </button>
      </div>

      {/* ===== أبطال الأسبوع — المراكز الثلاثة ===== */}
      <div
        className={`anim-slide-up card-shine mt-4 rounded-3xl border-2 p-4 transition-all ${
          champsCanceled
            ? "border-grape-100 bg-grape-50/60 opacity-75 saturate-50"
            : "border-gold-500/50 bg-gradient-to-b from-gold-400/15 to-white"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${champsCanceled ? "bg-grape-100 text-grape-400" : "bg-gold-500 text-white shadow-[0_3px_0_#b57a0a]"}`}>
            <Icon name="trophy" className="h-6 w-6" strokeWidth={2.1} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-extrabold leading-6 text-ink">أبطال الأسبوع — المراكز الثلاثة</p>
            <p className="text-[11px] font-bold text-grape-700/65">الأول +٣٠ · الثاني +٢٠ · الثالث +١٠ عملة — البطولة استحقاق لأسبوع مكتمل فقط</p>
          </div>
          <button
            type="button"
            onClick={toggleChamps}
            title={champsCanceled ? "إعادة بطولات الأسبوع إلى الحفل" : "إلغاء بطولات الأسبوع لهذا الأسبوع"}
            className={`flex shrink-0 items-center gap-1 rounded-xl border-2 px-2.5 py-1.5 text-[11px] font-extrabold transition-all active:scale-95 ${
              champsCanceled
                ? "border-mint-600/60 bg-mint-400/15 text-mint-600 hover:bg-mint-400/30"
                : "border-coral-400/50 bg-white text-coral-500 hover:bg-coral-500 hover:text-white"
            }`}
          >
            <Icon name={champsCanceled ? "refresh" : "x"} className="h-3.5 w-3.5" strokeWidth={3} />
            {champsCanceled ? "استعادة" : "إلغاء"}
          </button>
        </div>

        {champsCanceled && (
          <p className="anim-fade mt-3 rounded-2xl bg-grape-50 px-3 py-2 text-center text-xs font-bold text-grape-400">
            لن تُسلَّم بطولات الأسبوع في حفل هذا الأسبوع
          </p>
        )}

        {!champsCanceled && (
        <>
        {/* شروط البطولة */}
        <div className="mt-3 rounded-2xl border-2 border-gold-500/30 bg-white/85 p-3">
          <p className="mb-2 flex items-center gap-1.5 font-display text-xs font-extrabold text-gold-600">
            <Icon name="shield" className="h-4 w-4" strokeWidth={2.4} />
            لا يستحق البطولة إلا من جمع الصفات الثلاث:
          </p>
          <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
            {championCriteria(tripOn).map((c) => (
              <span key={c.label} className={`flex items-center gap-1 rounded-full px-2.5 py-1 ${c.active ? "bg-mint-400/20 text-mint-600" : "bg-grape-100 text-grape-400"}`}>
                <Icon name={c.icon} className="h-3.5 w-3.5" strokeWidth={2.6} /> {c.label}
              </span>
            ))}
          </div>
          {(() => {
            const eligible = students.filter((s) => isChampionEligible(s, tripOn, tripAttendees));
            return (
              <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t-2 border-dashed border-gold-500/25 pt-2.5">
                <span className="text-[11px] font-extrabold text-ink">
                  المؤهلون للبطولة: <span className="text-gold-600">{ar(eligible.length)}</span> من {ar(students.length)}
                </span>
                {eligible.slice(0, 6).map((s) => (
                  <span key={s.id} className="flex items-center gap-1 rounded-full bg-gold-400/20 px-2 py-0.5 text-[10px] font-extrabold text-gold-600">
                    {s.name}
                    {tripOn && tripAttendees.includes(s.id) && " ✦"}
                  </span>
                ))}
                {eligible.length === 0 && (
                  <span className="text-[10px] font-bold text-grape-400">لم يكمل أحد أسبوعه بعد — البطولة لمن يستحق</span>
                )}
              </div>
            );
          })()}
        </div>

        <div className="mt-3 grid gap-2.5 lg:grid-cols-3">
          {CHAMPION_TIERS.map((t, ti) => {
            const value = ceremonyPicks[t.key] ?? "";
            const winner = value === "none" ? null : students.find((s) => s.id === value);
            const takenByOthers = CHAMPION_TIERS.filter((x) => x.key !== t.key)
              .map((x) => ceremonyPicks[x.key])
              .filter((v): v is string => !!v && v !== "none");
            const options = students.filter(
              (s) => isChampionEligible(s, tripOn, tripAttendees) && (!takenByOthers.includes(s.id) || s.id === value)
            );
            const suggestion = suggestChampion(t.key, students, tripOn, tripAttendees);
            return (
              <div key={t.key} className="rounded-2xl border-2 border-gold-500/30 bg-white/80 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-base font-extrabold ${t.medal}`}>
                    {ar(ti + 1)}
                  </span>
                  <div className="flex-1">
                    <p className="font-display text-sm font-extrabold leading-4 text-ink">{t.short}</p>
                    <p className="text-[10px] font-bold text-grape-700/55">{t.desc} · +{ar(t.coins)} عملة</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={value}
                    onChange={(e) => setCeremonyPick(t.key, e.target.value === "" ? null : e.target.value)}
                    className="h-10 min-w-0 flex-1 cursor-pointer rounded-xl border-2 border-grape-200 bg-grape-50 px-2.5 font-display text-xs font-bold text-ink outline-none transition focus:border-grape-500 focus:bg-white"
                  >
                    <option value="">— اختر البطل —</option>
                    <option value="none">— لا أحد —</option>
                    {options.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {tripOn && tripAttendees.includes(s.id) ? " ✦ حضر الرحلة" : ""} (+{ar(s.weekXp)})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => suggestion && setCeremonyPick(t.key, suggestion)}
                    disabled={!suggestion}
                    title="اقتراح تلقائي من المؤهلين"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-grape-200 bg-white text-grape-500 transition hover:border-grape-400 hover:bg-grape-50 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Icon name="wand" className="h-4 w-4" strokeWidth={2.2} />
                  </button>
                </div>
                {value === "none" ? (
                  <p className="mt-2 rounded-xl bg-grape-50 px-2.5 py-1.5 text-center text-[10px] font-bold text-grape-400">لن يُسلَّم هذا المركز في الحفل</p>
                ) : winner ? (
                  <div className="anim-pop mt-2 flex items-center gap-2 rounded-xl bg-gold-400/15 px-2.5 py-1.5">
                    <Avatar photo={winner.photo} name={winner.name} size={26} />
                    <span className="truncate text-xs font-extrabold text-gold-600">
                      {winner.name}
                      {tripOn && tripAttendees.includes(winner.id) && " ✦"}
                    </span>
                  </div>
                ) : (
                  <p className="mt-2 rounded-xl bg-grape-50 px-2.5 py-1.5 text-center text-[10px] font-bold text-grape-400">
                    {options.length === 0 ? "لا مؤهلين متاحين لهذا المركز" : "لم يُحدَّد بعد"}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        </>
        )}
      </div>

      {/* ===== الجوائز الفردية ===== */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {AWARDS_META.map((m, i) => {
          const k = m.key as keyof CeremonyPicks;
          const value = ceremonyPicks[k] ?? "";
          const canceled = value === "none";
          const winner = canceled ? null : students.find((s) => s.id === value);
          return (
            <div
              key={m.key}
              className={`anim-slide-up card-shine rounded-3xl border-2 p-4 transition-all ${
                canceled ? "border-grape-100 bg-grape-50/60 opacity-75 saturate-50" : "border-grape-200 bg-white"
              }`}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="flex items-center gap-3">
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${canceled ? "bg-grape-100 text-grape-400" : "bg-gold-400/25 text-gold-600"}`}>
                  <Icon name={m.icon} className="h-6 w-6" strokeWidth={2.1} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-extrabold leading-6 text-ink">{m.title}</p>
                  <p className="text-[11px] font-bold text-grape-700/65">
                    {m.desc} · جائزة +{ar(m.coins)} عملة{m.key === "improved" ? " وترفع المستوى" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCeremonyPick(k, canceled ? null : "none")}
                  title={canceled ? "إعادة الجائزة إلى الحفل" : "إلغاء هذه الجائزة لهذا الأسبوع"}
                  className={`flex shrink-0 items-center gap-1 rounded-xl border-2 px-2.5 py-1.5 text-[11px] font-extrabold transition-all active:scale-95 ${
                    canceled
                      ? "border-mint-600/60 bg-mint-400/15 text-mint-600 hover:bg-mint-400/30"
                      : "border-coral-400/50 bg-white text-coral-500 hover:bg-coral-500 hover:text-white"
                  }`}
                >
                  <Icon name={canceled ? "refresh" : "x"} className="h-3.5 w-3.5" strokeWidth={3} />
                  {canceled ? "استعادة" : "إلغاء"}
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <select
                  value={value}
                  onChange={(e) => setCeremonyPick(k, e.target.value === "" ? null : e.target.value)}
                  className="h-11 min-w-0 flex-1 cursor-pointer rounded-2xl border-2 border-grape-200 bg-grape-50 px-3 font-display text-sm font-bold text-ink outline-none transition focus:border-grape-500 focus:bg-white"
                >
                  <option value="">— اختر الفائز —</option>
                  <option value="none">— لا أحد —</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (+{ar(s.weekXp)} نقطة أسبوعية)
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const s = suggest(k, students);
                    if (s) setCeremonyPick(k, s);
                  }}
                  title="اقتراح تلقائي من الكشف"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border-2 border-grape-200 bg-white text-grape-500 transition hover:border-grape-400 hover:bg-grape-50 active:scale-90"
                >
                  <Icon name="wand" className="h-5 w-5" strokeWidth={2.2} />
                </button>
              </div>
              {value === "none" ? (
                <p className="anim-fade mt-2.5 rounded-2xl bg-grape-50 px-3 py-1.5 text-center text-xs font-bold text-grape-400">لن تُسلَّم هذه الجائزة في الحفل</p>
              ) : winner ? (
                <div className="anim-pop mt-2.5 flex items-center gap-2 rounded-2xl bg-gold-400/15 px-3 py-1.5">
                  <Avatar photo={winner.photo} name={winner.name} size={32} />
                  <span className="text-sm font-extrabold text-gold-600">{winner.name} يستلم الجائزة في الحفل</span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* ===== أرشيف الأسابيع السابقة ===== */}
      {weeksLog.length > 0 && (
        <div className="anim-slide-up mt-6 rounded-3xl border-2 border-grape-200 bg-white p-4">
          <p className="mb-3 flex items-center gap-2 font-display text-base font-extrabold text-ink">
            <Icon name="medal" className="h-5 w-5 text-grape-500" strokeWidth={2.2} />
            أرشيف النتائج السابقة
            <span className="text-[10px] font-bold text-grape-700/50">اضغط على أسبوع لعرض نتائجه المحفوظة</span>
          </p>
          <div className="space-y-2">
            {weeksLog.map((log) => (
              <div key={log.week} className="rounded-2xl border-2 border-grape-100 bg-grape-50/50">
                <div className="flex items-center gap-2.5 px-3 py-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold-400/25 text-gold-600">
                    <Icon name="trophy" className="h-4.5 w-4.5" strokeWidth={2.2} />
                  </span>
                  <button type="button" onClick={() => setOpenLog(openLog === log.week ? null : log.week)} className="min-w-0 flex-1 text-start">
                    <span className="block truncate font-display text-sm font-extrabold text-ink">{log.name || "أسبوع سابق"}</span>
                    <span className="text-[10px] font-bold text-grape-700/55">{log.savedAt} · {ar(log.top.length)} طالبًا · {ar(log.awards.length)} جائزة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenLog(openLog === log.week ? null : log.week)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-grape-400 transition hover:bg-grape-100"
                  >
                    <Icon name="chevron" className={`h-4 w-4 transition-transform ${openLog === log.week ? "-rotate-90" : "rotate-90"}`} strokeWidth={2.6} />
                  </button>
                  <ArmDelete onDelete={() => removeWeekLog(log.week)} />
                </div>
                {openLog === log.week && (
                  <div className="anim-fade border-t-2 border-dashed border-grape-200 px-3 py-3">
                    {log.trip && (
                      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold text-mint-600">
                        <Icon name="flag" className="h-3.5 w-3.5" strokeWidth={2.4} />
                        رحلة {TRIP_DAYS.find((d) => d.key === log.trip?.day)?.label}: {log.trip.attendeeNames.join("، ") || "لم يحضر أحد"}
                      </p>
                    )}
                    {log.awards.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {log.awards.map((a, i) => (
                          <span key={i} className="flex items-center gap-1 rounded-full bg-gold-400/20 px-2.5 py-1 text-[10px] font-extrabold text-gold-600">
                            <Icon name="trophy" className="h-3 w-3" strokeWidth={2.4} />
                            {a.title}: {a.studentName}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="space-y-1.5">
                      {log.top.map((e, i) => (
                        <div key={e.id} className="flex items-center gap-2.5 rounded-xl bg-white px-2.5 py-1.5">
                          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-extrabold ${i === 0 ? "bg-gold-500 text-white" : i === 1 ? "bg-slate-400 text-white" : i === 2 ? "bg-amber-600 text-white" : "bg-grape-100 text-grape-600"}`}>
                            {ar(i + 1)}
                          </span>
                          <Avatar photo={e.photo} name={e.name} size={34} frame={e.frame} crown={e.crown} />
                          <span className="min-w-0 flex-1 truncate font-display text-sm font-extrabold text-ink">{e.name}</span>
                          <span className="text-[10px] font-bold text-grape-500">م{ar(e.level)}</span>
                          <span className="flex items-center gap-0.5 rounded-full bg-grape-600/12 px-2 py-0.5 text-[10px] font-extrabold text-grape-700">
                            <Icon name="bolt" fill className="h-3 w-3" />+{ar(e.weekXp)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== زر البدء ===== */}
      <div className="mt-6 flex flex-col items-center gap-3 rounded-[28px] border-2 border-gold-500/40 bg-gradient-to-l from-gold-400/20 via-white to-white p-6 text-center">
        <p className="font-display text-lg font-extrabold text-ink">
          {pickedCount === 0
            ? "لم تحدد أي جائزة بعد — حدّد الفائزين ليظهروا في الحفل"
            : `جاهزون! ${ar(pickedCount)} جائزة محددة ستُسلَّم في الحفل`}
        </p>
        <p className="max-w-md text-xs font-bold text-grape-700/60">
          تسلسل الحفل: لكل جائزة صفحة باسمها ثم تُكشف بضغطة، ثم أبطال الأسبوع الثلاثة (الثالث ← الثاني ← الأول)
          {showNewProducts && "، ثم منتجات المتجر الجديدة"}
        </p>
        <BigBtn onClick={startCeremony} disabled={students.length === 0} color="anim-glow bg-gold-500 hover:brightness-110 text-ink shadow-[0_6px_0_#b57a0a] px-10 text-xl!">
          <Icon name="play" fill className="h-6 w-6" />
          بدء الحفل الآن
        </BigBtn>
        <button
          type="button"
          onClick={() => {
            if (armWeek) {
              startWeek();
              setArmWeek(false);
            } else {
              setArmWeek(true);
              sfx.click();
            }
          }}
          className={`text-xs font-bold underline-offset-4 transition hover:underline ${armWeek ? "text-coral-500" : "text-grape-400 hover:text-grape-600"}`}
        >
          {armWeek ? "متأكد؟ اضغط مرة أخرى — ستُحفظ نتائج هذا الأسبوع في الأرشيف" : "أو أنهِ الأسبوع واحفظ نتائجه وابدأ أسبوعًا جديدًا"}
        </button>
      </div>
    </div>
  );
}

/* حذف بتأكيد مضمّن */
function ArmDelete({ onDelete }: { onDelete: () => void }) {
  const [arm, setArm] = useState(false);
  useEffect(() => {
    if (!arm) return;
    const t = window.setTimeout(() => setArm(false), 3200);
    return () => clearTimeout(t);
  }, [arm]);
  return (
    <button
      type="button"
      onClick={() => {
        if (arm) {
          onDelete();
          setArm(false);
        } else {
          setArm(true);
          sfx.click();
        }
      }}
      title="حذف هذا الأسبوع من الأرشيف"
      className={`shrink-0 rounded-lg px-2 py-1.5 text-[10px] font-extrabold transition-all active:scale-90 ${
        arm ? "bg-coral-500 text-white" : "text-grape-300 hover:bg-coral-500/10 hover:text-coral-500"
      }`}
    >
      {arm ? "تأكيد؟" : "حذف"}
    </button>
  );
}

/* ===== العرض ===== */
type Stage =
  | { kind: "intro" }
  | { kind: "awardTitle"; title: string; icon: string; desc: string }
  | { kind: "awardReveal"; title: string; icon: string; coins: number; xp: number; student: Student }
  | { kind: "championsTitle" }
  | { kind: "champions"; tiers: { tier: (typeof CHAMPION_TIERS)[number]; student: Student }[] }
  | { kind: "newProducts"; items: ShopProduct[] }
  | { kind: "finale" };

export function CeremonyShow() {
  const { closeCeremony, sorted, ceremonyPicks, weekName, grantAward, startWeek, products, week, showNewProducts } = useApp();
  const [idx, setIdx] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0); // عدد الأبطال المكشوفين في صفحة الأبطال
  const granted = useRef<Set<string>>(new Set());

  const stages = useMemo<Stage[]>(() => {
    const st: Stage[] = [{ kind: "intro" }];
    // الجوائز الفردية: صفحة اسم الجائزة ثم صفحة الكشف
    for (const m of AWARDS_META) {
      const student = sorted.find((s) => s.id === ceremonyPicks[m.key]);
      if (student) {
        st.push({ kind: "awardTitle", title: m.title, icon: m.icon, desc: m.desc });
        // الأكثر تطوّرًا فقط يرفع المستوى (خبرة) — البقية عملات فقط
        st.push({ kind: "awardReveal", title: m.title, icon: m.icon, coins: m.coins, xp: m.key === "improved" ? m.coins : 0, student });
      }
    }
    // أبطال الأسبوع الثلاثة في صفحة واحدة
    const tiers = CHAMPION_TIERS.map((tier) => ({ tier, student: sorted.find((s) => s.id === ceremonyPicks[tier.key]) }))
      .filter((x): x is { tier: (typeof CHAMPION_TIERS)[number]; student: Student } => !!x.student);
    if (tiers.length > 0) {
      st.push({ kind: "championsTitle" });
      st.push({ kind: "champions", tiers });
    }
    // إعلان منتجات المتجر الجديدة لهذا الأسبوع (اختياري)
    if (showNewProducts) {
      const fresh = products.filter((p) => p.addedWeek === week);
      if (fresh.length > 0) st.push({ kind: "newProducts", items: fresh });
    }
    st.push({ kind: "finale" });
    return st;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stage = stages[Math.min(idx, stages.length - 1)];

  // صوت عند دخول كل صفحة + إعادة ضبط عدّاد الأبطال
  useEffect(() => {
    if (stage.kind === "champions") setRevealedCount(0);
    if (stage.kind === "intro") sfx.drum();
    else if (stage.kind === "awardTitle" || stage.kind === "championsTitle") sfx.drum();
    else if (stage.kind === "awardReveal") {
      sfx.fanfare();
      const gk = stage.title + stage.student.id;
      if (!granted.current.has(gk)) {
        granted.current.add(gk);
        grantAward(stage.student.id, stage.title, stage.coins, stage.xp);
      }
    } else if (stage.kind === "newProducts") sfx.sparkle();
    else sfx.sparkle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const next = () => {
    if (idx + 1 >= stages.length) closeCeremony();
    else {
      setIdx((v) => v + 1);
      sfx.click();
    }
  };

  /* كشف البطل التالي في صفحة الأبطال — الترتيب: الثالث ← الثاني ← الأول */
  type TierEntry = { tier: (typeof CHAMPION_TIERS)[number]; student: Student };
  const revealNextChampion = (tiers: TierEntry[]) => {
    const orderIdx = tiers.length - 1 - revealedCount;
    const entry = tiers[orderIdx];
    if (!entry) return;
    setRevealedCount((c) => c + 1);
    const gk = entry.tier.title + entry.student.id;
    if (!granted.current.has(gk)) {
      granted.current.add(gk);
      grantAward(entry.student.id, entry.tier.title, entry.tier.coins);
    }
    if (revealedCount + 1 >= tiers.length) sfx.fanfare();
    else sfx.drum();
  };

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

      <div className="relative mx-auto flex min-h-full max-w-4xl flex-col items-center justify-center p-6 py-12">
        {/* ===== المقدمة ===== */}
        {stage.kind === "intro" && (
          <div className="anim-pop text-center">
            <Icon name="sparkle" fill className="anim-wiggle mx-auto h-20 w-20 text-gold-400" />
            <h1 className="mt-4 font-display text-4xl font-extrabold text-white sm:text-6xl">الحفل الأسبوعي</h1>
            <p className="mt-3 font-display text-xl font-extrabold text-gold-300 sm:text-2xl">
              {weekName || "حلقة نور الحفّاظ"}
            </p>
            <p className="mt-2 text-base font-bold text-grape-300">لنصفّق لأبطال هذا الأسبوع</p>
          </div>
        )}

        {/* ===== صفحة اسم الجائزة ===== */}
        {stage.kind === "awardTitle" && (
          <div className="anim-pop text-center">
            <span className="mx-auto grid h-24 w-24 place-items-center rounded-[28px] border-2 border-gold-400/40 bg-gold-400/15 text-gold-400">
              <Icon name={stage.icon} className="anim-wiggle h-12 w-12" strokeWidth={1.9} />
            </span>
            <h2 className="mt-5 font-display text-4xl font-extrabold text-gold-300 sm:text-5xl">{stage.title}</h2>
            <p className="mt-3 max-w-md text-base font-bold leading-7 text-grape-300">{stage.desc}</p>
          </div>
        )}

        {/* ===== صفحة كشف الفائز ===== */}
        {stage.kind === "awardReveal" && (
          <div className="anim-pop relative text-center">
            {/* توهّج ناعم خلف الفائز */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-400/15 blur-3xl" />
            <div className="relative">
              <div className={heartFade(stage.student.hearts)}>
                <Avatar
                  photo={stage.student.photo}
                  name={stage.student.name}
                  size={128}
                  frame={stage.student.frame}
                  crown={stage.student.crown}
                  glow={stage.student.glow}
                />
              </div>
              <p className="mt-4 font-display text-4xl font-extrabold text-white sm:text-5xl">{stage.student.name}</p>
              <p className="mt-1 font-display text-lg font-extrabold text-gold-300">{stage.title}</p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <p className="flex items-center gap-2 rounded-full bg-gold-400 px-5 py-2 font-display text-base font-extrabold text-ink">
                  <Coin className="h-4.5 w-4.5" /> +{ar(stage.coins)} عملة ذهبية
                </p>
                {stage.xp > 0 && (
                  <p className="anim-glow flex items-center gap-2 rounded-full bg-grape-600 px-5 py-2 font-display text-base font-extrabold text-white">
                    <Icon name="bolt" fill className="h-4.5 w-4.5" /> +{ar(stage.xp)} خبرة — يرتفع مستواه!
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== صفحة أسماء الأبطال ===== */}
        {stage.kind === "championsTitle" && (
          <div className="anim-pop text-center">
            <Icon name="trophy" className="anim-wiggle mx-auto h-20 w-20 text-gold-400" strokeWidth={1.8} />
            <h2 className="mt-6 font-display text-4xl font-extrabold text-gold-300 sm:text-5xl">أبطال الأسبوع</h2>
            <p className="mt-3 font-display text-xl font-extrabold text-white">المركز الأول · الثاني · الثالث</p>
            <p className="mt-2 max-w-md text-sm font-bold leading-6 text-grape-300">
              من أكملوا أسبوعهم: حضور كل الأيام + تسميع الحفظ والمراجعة + الرحلة إن وُجدت
            </p>
          </div>
        )}

        {/* ===== منصة الأبطال — الكشف تصاعديًا ===== */}
        {stage.kind === "champions" && (
          <div className="w-full text-center">
            <h2 className="anim-slide-down font-display text-2xl font-extrabold text-white sm:text-3xl">
              {revealedCount < stage.tiers.length ? "منصة أبطال الأسبوع" : "مبروك لأبطال الأسبوع!"}
            </h2>
            <div className="mt-8 flex items-end justify-center gap-3 sm:gap-6">
              {[1, 2, 3].map((place) => {
                const entry = stage.tiers.find((t) => t.tier.key === ("champion" + place));
                if (!entry) return null;
                /* يُكشف تصاعديًا: الثالث أولًا ثم الثاني ثم الأول */
                const isShown = revealedCount >= stage.tiers.length - stage.tiers.indexOf(entry);
                const heights = { 1: "h-40", 2: "h-28", 3: "h-20" } as const;
                const bgs = {
                  1: "border-gold-500 bg-gradient-to-b from-gold-300 to-gold-500 shadow-[0_0_40px_rgba(247,183,51,0.45)]",
                  2: "border-slate-300 bg-gradient-to-b from-slate-100 to-slate-300",
                  3: "border-amber-500 bg-gradient-to-b from-amber-200 to-amber-400",
                } as const;
                return (
                  <div key={entry.tier.key} className="flex w-28 flex-col items-center sm:w-36">
                    {place === 1 && isShown && <Icon name="crown" className="anim-bounce-soft mb-1 h-9 w-9 text-gold-400" strokeWidth={2} />}
                    <div className="relative">
                      {isShown ? (
                        <div className={`anim-pop ${heartFade(entry.student.hearts)}`}>
                          <Avatar
                            photo={entry.student.photo}
                            name={entry.student.name}
                            size={place === 1 ? 104 : 84}
                            frame={entry.student.frame}
                            crown={place === 1 ? entry.student.crown : null}
                            glow={entry.student.glow}
                          />
                        </div>
                      ) : (
                        <div className="grid place-items-center rounded-[20px] border-4 border-dashed border-white/25 bg-white/5" style={{ width: place === 1 ? 104 : 84, height: place === 1 ? 104 : 84 }}>
                          <span className="font-display text-3xl font-extrabold text-white/40">؟</span>
                        </div>
                      )}
                      <span className={`absolute -bottom-3 left-1/2 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full border-4 border-grape-900 font-display text-base font-extrabold ${entry.tier.medal}`}>
                        {ar(place)}
                      </span>
                    </div>
                    <p className="mt-4 max-w-full truncate font-display text-base font-extrabold text-white sm:text-lg">
                      {isShown ? entry.student.name : "؟"}
                    </p>
                    <p className={`mt-0.5 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${isShown ? "bg-gold-400 text-ink" : "bg-white/10 text-white/40"}`}>
                      {isShown ? `+${ar(entry.tier.coins)} عملة` : entry.tier.short}
                    </p>
                    <div className={`mt-2 w-full rounded-t-2xl border-2 border-b-0 ${heights[place as 1 | 2 | 3]} ${bgs[place as 1 | 2 | 3]}`} />
                  </div>
                );
              })}
            </div>

            {revealedCount < stage.tiers.length ? (
              <button
                type="button"
                onClick={() => revealNextChampion(stage.tiers)}
                className="anim-slide-up mx-auto mt-8 flex items-center gap-2 rounded-2xl bg-gold-500 px-10 py-3.5 font-display text-xl font-extrabold text-ink shadow-[0_5px_0_#b57a0a] transition-all hover:brightness-110 active:translate-y-1 active:shadow-none"
              >
                {revealedCount === 0
                  ? "اكشف المركز الثالث"
                  : revealedCount === 1
                  ? "اكشف المركز الثاني"
                  : "اكشف المركز الأول"}
                <Icon name="chevron" className="h-5 w-5 rotate-180" strokeWidth={3} />
              </button>
            ) : (
              <button
                type="button"
                onClick={next}
                className="anim-slide-up mx-auto mt-8 flex items-center gap-2 rounded-2xl bg-gold-500 px-10 py-3.5 font-display text-xl font-extrabold text-ink shadow-[0_5px_0_#b57a0a] transition-all hover:brightness-110 active:translate-y-1 active:shadow-none"
              >
                كل الأبطال ظهروا — متابعة
                <Icon name="chevron" className="h-5 w-5 rotate-180" strokeWidth={3} />
              </button>
            )}
          </div>
        )}

        {/* ===== إعلان منتجات المتجر الجديدة ===== */}
        {stage.kind === "newProducts" && (
          <div className="w-full">
            <div className="anim-slide-down text-center">
              <Icon name="store" className="anim-bounce-soft mx-auto h-14 w-14 text-gold-400" strokeWidth={1.8} />
              <h2 className="mt-3 font-display text-3xl font-extrabold text-gold-300 sm:text-4xl">وصل حديثًا إلى المتجر!</h2>
              <p className="mt-2 text-base font-bold text-grape-300">منتجات جديدة بانتظار من يجمع عملاتها</p>
            </div>
            <div className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stage.items.map((p, i) => (
                <NewProductCard key={p.id} p={p} delay={i * 120} />
              ))}
            </div>
          </div>
        )}

        {/* ===== الختام ===== */}
        {stage.kind === "finale" && (
          <div className="anim-pop text-center">
            <Icon name="trophy" className="anim-wiggle mx-auto h-20 w-20 text-gold-400" strokeWidth={1.8} />
            <h2 className="mt-4 font-display text-4xl font-extrabold text-white sm:text-5xl">بارك الله فيكم جميعًا</h2>
            <p className="mt-3 text-lg font-bold text-grape-300">كل حافظ هنا بطل — نلتقي الأسبوع القادم بهمة أعلى بإذن الله</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <BigBtn onClick={startWeek} color="bg-mint-600 hover:brightness-110 shadow-[0_5px_0_#0a7a50] text-lg!">
                <Icon name="refresh" className="h-5 w-5" strokeWidth={2.6} />
                بدء الأسبوع الجديد
              </BigBtn>
              <BigBtn onClick={closeCeremony} color="bg-white/15 hover:bg-white/25 text-lg! shadow-none">
                إغلاق الحفل
              </BigBtn>
            </div>
          </div>
        )}

        {/* زر المتابعة — لكل الصفحات ما عدا الأبطال (لها زرّها الخاص) والختام */}
        {stage.kind !== "finale" && stage.kind !== "champions" && (
          <button
            type="button"
            onClick={next}
            className="anim-slide-up mx-auto mt-10 flex items-center gap-2 rounded-2xl bg-gold-500 px-10 py-3.5 font-display text-xl font-extrabold text-ink shadow-[0_5px_0_#b57a0a] transition-all hover:brightness-110 active:translate-y-1 active:shadow-none"
          >
            {stage.kind === "intro"
              ? "ابدأ الاحتفال"
              : stage.kind === "awardTitle"
              ? "من الفائز؟ اضغط للكشف"
              : stage.kind === "championsTitle"
              ? "لنكشف الأبطال"
              : stage.kind === "newProducts"
              ? "إلى الختام"
              : "متابعة"}
            <Icon name="chevron" className="h-5 w-5 rotate-180" strokeWidth={3} />
          </button>
        )}

        {/* نقاط المراحل */}
        <div className="mt-6 flex items-center gap-1.5">
          {stages.map((_, i) => (
            <span key={i} className={`h-2 rounded-full transition-all ${i === idx ? "w-7 bg-gold-400" : i < idx ? "w-2 bg-gold-400/50" : "w-2 bg-white/20"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
