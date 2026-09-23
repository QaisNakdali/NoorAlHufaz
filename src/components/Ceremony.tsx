/* الحفل الأسبوعي — يجهّز المعلم الجوائز والرحلة ثم يضغط زرًا واحدًا للعرض */
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../appState";
import {
  ar,
  AWARDS_META,
  championCriteria,
  isChampionEligible,
  TRIP_DAYS,
  type PerHalaqaRewardKey,
  type ShopProduct,
  type Student,
  type TripDay,
} from "../core";
import { sfx } from "../sound";
import Avatar from "./Avatar";
import CosmeticThumb from "./CosmeticThumb";
import { BigBtn, Coin, heartFade, Icon, SectionHead } from "./ui";

/* اقتراح للجوائز الفردية من الكشف */
function suggest(key: PerHalaqaRewardKey, students: Student[]): string | null {
  if (students.length === 0) return null;
  if (key === "behavior")
    return [...students].sort((a, b) => a.heartsLostWeek - b.heartsLostWeek || b.hearts - a.hearts)[0].id;
  if (key === "improved")
    return [...students]
      .map((s) => ({ s, rec: s.days ? Object.values(s.days).reduce((n, d) => n + (d.h ? 1 : 0) + (d.r ? 1 : 0), 0) : 0 }))
      .sort((a, b) => b.rec - a.rec || b.s.weekXp - a.s.weekXp)[0].s.id;
  return null;
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
          <span className="rounded-full bg-gold-400 px-2 py-0.5 text-xs font-extrabold text-ink">جديد</span>
        </div>
        <p className="mt-0.5 text-xs font-bold text-grape-700/60">{p.desc}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-gold-400/25 px-2.5 py-1 text-xs font-extrabold text-gold-600">
            <Coin className="h-3.5 w-3.5" />
            {ar(p.price)}
          </span>
          <span className="rounded-full bg-grape-600/12 px-2.5 py-1 text-xs font-extrabold text-grape-600">يُفتح في المستوى {ar(p.minLevel)}</span>
        </div>
      </div>
    </div>
  );
}

/* ===== لوحة التحضير ===== */
export default function CeremonyPanel() {
  const {
    students,
    halaqas,
    week,
    weekName,
    setWeekName,
    weeksLog,
    ceremonyPicks,
    setCeremonyHalaqaPick,
    rewardSettings,
    setRewardSetting,
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
    Object.values(ceremonyPicks.improvedByHalaqa ?? {}).filter(isRealPick).length +
    Object.values(ceremonyPicks.behaviorByHalaqa ?? {}).filter(isRealPick).length +
    (rewardSettings.champions.enabled ? students.filter((s) => isChampionEligible(s, tripOn, tripAttendees)).length : 0);

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

      <div className="anim-slide-up mb-4 rounded-3xl border-2 border-grape-200 bg-white p-4">
        <div className="mb-3"><h3 className="font-display text-lg font-extrabold text-ink">إعداد العملات قبل الحفل</h3><p className="text-xs font-bold text-grape-500">كل الجوائز عملات فقط ويمكن تعطيل أي جائزة أو تغيير قيمتها.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {([
            ["champions", "🏆 أبطال الأسبوع"],
            ["improved", "🚀 الأكثر تطورًا"],
            ["behavior", "⭐ أفضل سلوك"],
            ["trip", "🎒 جائزة الرحلة"],
          ] as const).map(([key, label]) => {
            const setting = rewardSettings[key];
            return <label key={key} className={`rounded-2xl border-2 p-3 transition ${setting.enabled ? "border-grape-300 bg-grape-50" : "border-grape-100 bg-slate-50 opacity-70"}`}>
              <span className="flex items-center justify-between gap-2"><span className="font-display text-sm font-extrabold text-ink">{label}</span><input type="checkbox" checked={setting.enabled} onChange={(e) => setRewardSetting(key, { enabled: e.target.checked })} className="h-5 w-5 accent-violet-600" /></span>
              <span className="mt-2 flex items-center gap-2 text-xs font-bold text-grape-500">{key === "trip" ? "لكل طالب مستحق" : "لكل فائز"}<input type="number" min="0" step="1" disabled={!setting.enabled} value={setting.coins} onChange={(e) => setRewardSetting(key, { coins: Number(e.target.value) })} className="field-control h-9 min-w-0 flex-1 text-center" /></span>
            </label>;
          })}
        </div>
      </div>

      {/* ===== كشف الرحلة (اختياري) ===== */}
      <div className="anim-slide-up rounded-3xl border-2 border-mint-400/50 bg-gradient-to-b from-mint-400/12 to-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-mint-600 text-white shadow-[0_3px_0_#0a7a50]">
            <Icon name="flag" className="h-6 w-6" strokeWidth={2.1} />
          </span>
          <div className="flex-1 min-w-52">
            <p className="font-display text-lg font-extrabold leading-6 text-ink">كشف الرحلة (اختياري)</p>
            <p className="text-xs font-bold text-grape-700/65">
              ليست كل الأسابيع فيها رحلة — فعّلها عند الحاجة. الحضور يُسجّل هنا، والعملات تُصرف في الحفل فقط إذا كانت جائزة الرحلة مفعلة.
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
            <p className="mt-2.5 text-xs font-extrabold text-grape-700">من حضر الرحلة؟ (اضغط على الصورة{rewardSettings.trip.enabled ? ` — جائزة الحضور +${ar(rewardSettings.trip.coins)} عملة` : " — الجائزة غير مفعلة"}):</p>
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
                    <span className={`text-xs font-extrabold ${on ? "text-mint-600" : "text-grape-400"}`}>{s.name}</span>
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
          <p className="text-xs font-bold text-grape-700/65">
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

      {/* ===== أبطال الأسبوع — جميع المستوفين متساوون ===== */}
      <div className="anim-slide-up card-shine mt-4 rounded-3xl border-2 border-gold-500/50 bg-gradient-to-b from-gold-400/15 to-white p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gold-500 text-white shadow-[0_3px_0_#b57a0a]"><Icon name="trophy" className="h-6 w-6" strokeWidth={2.1} /></span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-extrabold leading-6 text-ink">أبطال الأسبوع</p>
            <p className="text-xs font-bold text-grape-700/65">كل طالب يستوفي الشروط بطل بالدرجة نفسها ويحصل على +{ar(rewardSettings.champions.coins)} عملة.</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-bold">
          {championCriteria(tripOn).map((c) => (
            <span key={c.label} className={`flex items-center gap-1 rounded-full px-2.5 py-1 ${c.active ? "bg-mint-400/20 text-mint-600" : "bg-grape-100 text-grape-400"}`}><Icon name={c.icon} className="h-3.5 w-3.5" strokeWidth={2.6} /> {c.label}</span>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {students.filter((s) => isChampionEligible(s, tripOn, tripAttendees)).map((s) => (
            <span key={s.id} className="flex items-center gap-2 rounded-full bg-gold-400/20 px-3 py-1.5 text-xs font-extrabold text-gold-700"><Avatar photo={s.photo} name={s.name} size={26} /> {s.name}</span>
          ))}
          {students.filter((s) => isChampionEligible(s, tripOn, tripAttendees)).length === 0 && <p className="text-xs font-bold text-grape-400">لا يوجد طالب استوفى جميع الشروط حتى الآن.</p>}
        </div>
      </div>
      {/* ===== الأكثر تطورًا وأفضل سلوك — فائز واحد من كل حلقة ===== */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {AWARDS_META.map((m, i) => {
          const reward = m.key as PerHalaqaRewardKey;
          const mapKey = reward === "improved" ? "improvedByHalaqa" : "behaviorByHalaqa";
          const picks = ceremonyPicks[mapKey] ?? {};
          const setting = rewardSettings[reward];
          return (
            <div key={reward} className="anim-slide-up card-shine rounded-3xl border-2 border-grape-200 bg-white p-4" style={{ animationDelay: `${i * 70}ms` }}>
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gold-400/25 text-gold-600">
                  <Icon name={m.icon} className="h-6 w-6" strokeWidth={2.1} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-extrabold leading-6 text-ink">{m.title}</p>
                  <p className="text-xs font-bold text-grape-700/65">{m.desc}</p>
                  <p className="mt-1 text-xs font-extrabold text-gold-600">عدد العملات لكل فائز: +{ar(setting.coins)}</p>
                </div>
              </div>
              <div className="mt-3 space-y-2.5">
                {halaqas.map((halaqa) => {
                  const halaqaStudents = students.filter((student) => student.halaqaId === halaqa.id);
                  const legacyPick = ceremonyPicks[reward];
                  const legacyStudent = halaqaStudents.find((student) => student.id === legacyPick);
                  const value = picks[halaqa.id] ?? legacyStudent?.id ?? "";
                  const winner = halaqaStudents.find((student) => student.id === value);
                  return (
                    <div key={halaqa.id} className="rounded-2xl border-2 border-grape-100 bg-grape-50/70 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="font-display text-sm font-extrabold text-ink">{halaqa.name}</p>
                        <span className="text-xs font-bold text-grape-400">{ar(halaqaStudents.length)} طالب</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={value}
                          disabled={!setting.enabled || halaqaStudents.length === 0}
                          onChange={(e) => setCeremonyHalaqaPick(reward, halaqa.id, e.target.value || null)}
                          className="h-11 min-w-0 flex-1 cursor-pointer rounded-2xl border-2 border-grape-200 bg-white px-3 font-display text-sm font-bold text-ink outline-none transition focus:border-grape-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">— اختر فائز {halaqa.name} —</option>
                          {halaqaStudents.map((student) => (
                            <option key={student.id} value={student.id}>{student.name} (+{ar(student.weekXp)} نقطة أسبوعية)</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!setting.enabled || halaqaStudents.length === 0}
                          onClick={() => {
                            const studentId = suggest(reward, halaqaStudents);
                            if (studentId) setCeremonyHalaqaPick(reward, halaqa.id, studentId);
                          }}
                          title={`اقتراح فائز من ${halaqa.name}`}
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border-2 border-grape-200 bg-white text-grape-500 transition hover:border-grape-400 hover:bg-grape-50 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Icon name="wand" className="h-5 w-5" strokeWidth={2.2} />
                        </button>
                      </div>
                      {winner && <div className="anim-pop mt-2 flex items-center gap-2 rounded-xl bg-gold-400/15 px-2.5 py-1.5"><Avatar photo={winner.photo} name={winner.name} size={28} /><span className="text-xs font-extrabold text-gold-700">{winner.name} · +{ar(setting.coins)} عملة</span></div>}
                    </div>
                  );
                })}
                {halaqas.length === 0 && <p className="rounded-2xl border-2 border-dashed border-grape-200 p-4 text-center text-xs font-bold text-grape-400">أضف حلقة أولًا ليظهر اختيار الفائز الخاص بها.</p>}
              </div>
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
            <span className="text-xs font-bold text-grape-700/50">اضغط على أسبوع لعرض نتائجه المحفوظة</span>
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
                    <span className="text-xs font-bold text-grape-700/55">{log.savedAt} · {ar(log.top.length)} طالبًا · {ar(log.awards.length)} جائزة</span>
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
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-mint-600">
                        <Icon name="flag" className="h-3.5 w-3.5" strokeWidth={2.4} />
                        رحلة {TRIP_DAYS.find((d) => d.key === log.trip?.day)?.label}: {log.trip.attendeeNames.join("، ") || "لم يحضر أحد"}
                      </p>
                    )}
                    {log.awards.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {log.awards.map((a, i) => (
                          <span key={i} className="flex items-center gap-1 rounded-full bg-gold-400/20 px-2.5 py-1 text-xs font-extrabold text-gold-600">
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
                          <span className="text-xs font-bold text-grape-500">م{ar(e.level)}</span>
                          <span className="flex items-center gap-0.5 rounded-full bg-grape-600/12 px-2 py-0.5 text-xs font-extrabold text-grape-700">
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
      className={`shrink-0 rounded-lg px-2 py-1.5 text-xs font-extrabold transition-all active:scale-90 ${
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
  | { kind: "awardReveal"; title: string; awardKey: string; icon: string; coins: number; xp: number; student: Student }
  | { kind: "championsTitle" }
  | { kind: "champions"; students: Student[]; coins: number }
  | { kind: "newProducts"; items: ShopProduct[] }
  | { kind: "finale" };

export function CeremonyShow() {
  const { closeCeremony, sorted, halaqas, ceremonyPicks, weekName, grantAward, startWeek, products, week, showNewProducts, rewardSettings, tripOn, tripAttendees } = useApp();
  const [idx, setIdx] = useState(0);
  const granted = useRef<Set<string>>(new Set());

  const stages = useMemo<Stage[]>(() => {
    const st: Stage[] = [{ kind: "intro" }];
    // الأكثر تطورًا وأفضل سلوك: فائز واحد مستقل من كل حلقة.
    for (const m of AWARDS_META) {
      const reward = m.key as PerHalaqaRewardKey;
      const setting = rewardSettings[reward];
      if (!setting.enabled) continue;
      const map = reward === "improved" ? ceremonyPicks.improvedByHalaqa : ceremonyPicks.behaviorByHalaqa;
      for (const halaqa of halaqas) {
        const legacyId = ceremonyPicks[reward];
        const legacyStudent = sorted.find((s) => s.id === legacyId && s.halaqaId === halaqa.id);
        const studentId = map?.[halaqa.id] ?? legacyStudent?.id;
        const student = sorted.find((s) => s.id === studentId && s.halaqaId === halaqa.id);
        if (!student) continue;
        const title = `${m.title} — ${halaqa.name}`;
        st.push({ kind: "awardTitle", title, icon: m.icon, desc: `${m.desc} · ${halaqa.name}` });
        st.push({ kind: "awardReveal", title, awardKey: `${reward}-halaqa-${halaqa.id}`, icon: m.icon, coins: setting.coins, xp: 0, student });
      }
    }
    const champions = rewardSettings.champions.enabled ? sorted.filter((s) => isChampionEligible(s, tripOn, tripAttendees)) : [];
    if (champions.length > 0) {
      st.push({ kind: "championsTitle" });
      st.push({ kind: "champions", students: champions, coins: rewardSettings.champions.coins });
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

  useEffect(() => {
    if (!tripOn || !rewardSettings.trip.enabled) return;
    for (const studentId of tripAttendees) grantAward(studentId, "جائزة الرحلة", rewardSettings.trip.coins, 0);
    // grantAward نفسه يمنع التكرار عند إعادة فتح الحفل.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // صوت عند دخول كل صفحة وصرف الجوائز مرة واحدة فقط.
  useEffect(() => {
    if (stage.kind === "intro") sfx.drum();
    else if (stage.kind === "awardTitle" || stage.kind === "championsTitle") sfx.drum();
    else if (stage.kind === "awardReveal") {
      sfx.fanfare();
      const gk = stage.awardKey + stage.student.id;
      if (!granted.current.has(gk)) {
        granted.current.add(gk);
        grantAward(stage.student.id, stage.title, stage.coins, stage.xp, stage.awardKey);
      }
    } else if (stage.kind === "champions") {
      sfx.fanfare();
      stage.students.forEach((student) => {
        const key = `champion-${student.id}`;
        if (!granted.current.has(key)) {
          granted.current.add(key);
          grantAward(student.id, "بطل الأسبوع", stage.coins, 0);
        }
      });
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
            <p className="mt-3 font-display text-xl font-extrabold text-white">كل من استوفى الشروط بطل بالدرجة نفسها</p>
            <p className="mt-2 max-w-md text-sm font-bold leading-6 text-grape-300">
              من أكملوا أسبوعهم: حضور كل الأيام + تسميع الحفظ والمراجعة + الرحلة إن وُجدت
            </p>
          </div>
        )}

        {/* ===== أبطال الأسبوع — بلا ترتيب ===== */}
        {stage.kind === "champions" && (
          <div className="w-full text-center">
            <h2 className="anim-slide-down font-display text-3xl font-extrabold text-white">مبروك لأبطال الأسبوع!</h2>
            <p className="mt-2 font-bold text-gold-300">كل بطل يحصل على +{ar(stage.coins)} عملة</p>
            <div className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {stage.students.map((student) => (
                <div key={student.id} className="anim-pop rounded-3xl border-2 border-gold-400/40 bg-white/10 p-4">
                  <div className={heartFade(student.hearts)}>
                    <Avatar photo={student.photo} name={student.name} size={86} frame={student.frame} crown={student.crown} glow={student.glow} />
                  </div>
                  <p className="mt-3 font-display text-lg font-extrabold text-white">{student.name}</p>
                  <p className="mt-1 text-xs font-extrabold text-gold-300">🏆 بطل الأسبوع</p>
                </div>
              ))}
            </div>
            <button type="button" onClick={next} className="anim-slide-up mx-auto mt-8 flex items-center gap-2 rounded-2xl bg-gold-500 px-10 py-3.5 font-display text-xl font-extrabold text-ink shadow-[0_5px_0_#b57a0a] transition-all hover:brightness-110 active:translate-y-1 active:shadow-none">
              متابعة <Icon name="chevron" className="h-5 w-5 rotate-180" strokeWidth={3} />
            </button>
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
