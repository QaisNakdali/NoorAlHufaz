/* كشف الحلقة — مرتب أبجديًا: حضور + تسميع حفظ + تسميع مراجعة لكل يوم */
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../appState";
import { buildRegisterInsight, type TrackTrend } from "../analytics";
import {
  ar,
  ATTEND_COINS,
  ATTEND_XP,
  DAYS,
  DAY_PARTS,
  levelInfo,
  MAX_HEARTS,
  RECITE_COINS,
  RECITE_XP,
  xpForLevel,
  type DayPart,
  type RecitationRating,
  type Student,
} from "../core";
import { compressImage } from "../photos";
import { sfx } from "../sound";
import Avatar from "./Avatar";
import { BigBtn, Coin, heartFade, HeartsRow, Icon, LevelBadge, Modal, SectionHead } from "./ui";

/* ألوان كل خانة من خانات اليوم عند تسجيلها */
const PART_ON: Record<DayPart, string> = {
  a: "border-mint-600/60 bg-mint-400/25 text-mint-600",
  h: "border-grape-500/60 bg-grape-600/12 text-grape-600",
  r: "border-gold-500/70 bg-gold-400/25 text-gold-600",
};

/* زر حذف بتأكيد مضمّن (خطوتان) */
function DeleteBtn({ onDelete, label = "" }: { onDelete: () => void; label?: string }) {
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
      className={`flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-extrabold transition-all active:scale-90 ${
        arm
          ? "bg-coral-500 text-white shadow-[0_3px_0_#b23a55]"
          : "border-2 border-grape-100 bg-white text-grape-400 hover:border-coral-400/60 hover:text-coral-500"
      }`}
    >
      <Icon name="x" className="h-4 w-4" strokeWidth={3} />
      {arm ? "متأكد؟" : label || "حذف"}
    </button>
  );
}

/* ===== نافذة إعدادات الطالب (عملات / خبرة / قلوب) ===== */
function ManageStudentModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { students, halaqas, updateStudentProfile, addCoins, addXp, removeHeart, restoreHeart, removeStudent, toast, heartPrice } = useApp();
  const s = students.find((x) => x.id === id);
  const [name, setName] = useState(s?.name ?? "");
  const [photo, setPhoto] = useState<string | null>(s?.photo ?? null);
  const [coins, setCoins] = useState(s?.coins ?? 0);
  const [hearts, setHearts] = useState(s?.hearts ?? MAX_HEARTS);
  const [studentLevel, setStudentLevel] = useState(s ? levelInfo(s.xp).level : 1);
  const [halaqaId, setHalaqaId] = useState<string | null>(s?.halaqaId ?? null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!s) return null;
  const { level } = levelInfo(s.xp);
  const saveProfile = () => {
    updateStudentProfile(s.id, { name, photo, coins, hearts, xp: studentLevel !== level ? xpForLevel(Math.max(1, studentLevel)) : undefined, halaqaId });
    onClose();
  };
  const onFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try { setPhoto(await compressImage(file, 320, true)); }
    catch { toast("error", "تعذّر قراءة الصورة"); }
    finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} wide>
      <div className="p-6">
        <div className="flex items-center gap-4">
          <Avatar photo={s.photo} name={s.name} size={72} frame={s.frame} crown={s.crown} glow={s.glow} />
          <div className="flex-1">
            <h3 className="font-display text-2xl font-extrabold text-ink">{s.name}</h3>
            <p className="text-sm font-bold text-grape-500">المستوى {ar(level)} · {ar(s.xp)} نقطة · {ar(s.coins)} عملة</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-grape-100 text-grape-600 transition hover:bg-grape-200">
            <Icon name="x" className="h-5 w-5" strokeWidth={3} />
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border-2 border-grape-100 bg-grape-50/50 p-4 sm:col-span-2">
            <p className="mb-3 font-display text-base font-extrabold text-ink">بيانات الطالب</p>
            <div className="grid gap-3 sm:grid-cols-[96px_1fr_1fr]">
              <button type="button" onClick={() => fileRef.current?.click()} className="relative mx-auto h-20 w-20 overflow-hidden rounded-2xl border-2 border-grape-200 bg-white">
                {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <Icon name="user" className="m-auto h-full w-8 text-grape-300" />}
                {busy && <span className="absolute inset-0 grid place-items-center bg-white/80 text-xs font-bold">جاري...</span>}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
              <label className="text-xs font-bold text-grape-600">الاسم<input value={name} onChange={(e) => setName(e.target.value)} className="field-control mt-1 w-full" /></label>
              <label className="text-xs font-bold text-grape-600">الحلقة<select value={halaqaId ?? ""} onChange={(e) => setHalaqaId(e.target.value || null)} className="field-control mt-1 w-full"><option value="">بلا حلقة</option>{halaqas.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
              <label className="text-xs font-bold text-grape-600">العملات<input type="number" min="0" value={coins} onChange={(e) => setCoins(Number(e.target.value))} className="field-control mt-1 w-full" /></label>
              <label className="text-xs font-bold text-grape-600">المستوى<input type="number" min="1" value={studentLevel} onChange={(e) => setStudentLevel(Number(e.target.value))} className="field-control mt-1 w-full" /></label>
              <label className="text-xs font-bold text-grape-600">القلوب<select value={hearts} onChange={(e) => setHearts(Number(e.target.value))} className="field-control mt-1 w-full">{[0,1,2,3].map((v) => <option key={v} value={v}>{ar(v)}</option>)}</select></label>
            </div>
            <div className="mt-3 flex gap-2"><BigBtn onClick={saveProfile} className="flex-1"><Icon name="check" className="h-4 w-4" />حفظ التعديلات</BigBtn>{photo && <button type="button" onClick={() => setPhoto(null)} className="rounded-xl border-2 border-coral-200 px-3 text-xs font-extrabold text-coral-500">إزالة الصورة</button>}</div>
            <p className="mt-2 text-xs font-bold text-grape-400">تغيير الحلقة أو البيانات لا يعيد إنشاء الطالب ولا يمس حضوره أو ورده أو سجلاته.</p>
          </div>
          <div className="rounded-2xl border-2 border-grape-100 bg-white p-3.5">
            <p className="mb-2.5 flex items-center gap-2 font-display text-sm font-extrabold text-ink">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-gold-400/25 text-gold-600"><Coin className="h-4 w-4" /></span>
              زيادة العملات
            </p>
            <div className="flex items-center gap-2">
              {[5, 10, 25, 50].map((v) => (
                <button key={v} type="button" onClick={() => addCoins(s.id, v)} className="flex-1 rounded-xl bg-gold-500 py-2 text-sm font-extrabold text-white shadow-[0_3px_0_#b57a0a] transition hover:brightness-110 active:translate-y-0.5 active:shadow-none">
                  +{ar(v)}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border-2 border-grape-100 bg-white p-3.5">
            <p className="mb-2.5 flex items-center gap-2 font-display text-sm font-extrabold text-ink">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-grape-100 text-grape-600"><Icon name="bolt" fill className="h-4 w-4" /></span>
              زيادة الخبرة
            </p>
            <div className="flex items-center gap-2">
              {[10, 25, 50].map((v) => (
                <button key={v} type="button" onClick={() => addXp(s.id, v)} className="flex-1 rounded-xl bg-grape-600 py-2 text-sm font-extrabold text-white shadow-[0_3px_0_#56289d] transition hover:bg-grape-700 active:translate-y-0.5 active:shadow-none">
                  +{ar(v)}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border-2 border-grape-100 bg-white p-3.5 sm:col-span-2">
            <p className="mb-2.5 flex items-center gap-2 font-display text-sm font-extrabold text-ink">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-coral-400/20 text-coral-500"><Icon name="heart" fill className="h-4 w-4" /></span>
              القلوب ({ar(s.hearts)}/{ar(MAX_HEARTS)})
            </p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <HeartsRow hearts={s.hearts} max={MAX_HEARTS} size="w-8 h-8" />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={s.hearts <= 0}
                  onClick={() => removeHeart(s.id)}
                  className="rounded-xl bg-coral-500 px-4 py-2 text-sm font-extrabold text-white shadow-[0_3px_0_#b23a55] transition hover:brightness-110 active:translate-y-0.5 active:shadow-none disabled:opacity-35"
                >
                  خصم قلب
                </button>
                <button
                  type="button"
                  disabled={s.hearts >= MAX_HEARTS}
                  onClick={() => restoreHeart(s.id)}
                  className="rounded-xl bg-mint-600 px-4 py-2 text-sm font-extrabold text-white shadow-[0_3px_0_#0a7a50] transition hover:brightness-110 active:translate-y-0.5 active:shadow-none disabled:opacity-35"
                >
                  زيادة قلب
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-grape-700/60">من يفقد كل قلوبه يستمر بجمع العملات فقط حتى يشتري قلبًا ({ar(heartPrice)} عملة) أو تمنحه قلبًا من هنا.</p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between border-t-2 border-dashed border-grape-200 pt-4">
          <p className="text-xs text-grape-700/60">جوائز {s.name}: {ar(s.awards.length)} · ممتلكاته: {ar(s.inventory.length + s.bag.length)}</p>
          <DeleteBtn label="حذف الطالب" onDelete={() => { removeStudent(s.id); onClose(); }} />
        </div>
      </div>
    </Modal>
  );
}

/* ===== صف طالب في الكشف ===== */
function RegisterRow({ s, delay, onManage }: { s: Student; delay: number; onManage: () => void }) {
  const { markDay, markAbsent, updateWard, removeHeart, removeStudent, toggleStudentTesting, setMode, setTab, halaqas, weeksLog, heartPrice } = useApp();
  const fade = heartFade(s.hearts);
  const noHearts = s.hearts === 0;
  const { level, into, need } = levelInfo(s.xp);
  const levelPct = Math.max(4, Math.round((into / need) * 100));
  const checkedCount = DAYS.reduce((n, d) => n + DAY_PARTS.filter((p) => s.days[d.key][p.key]).length, 0);
  const insight = useMemo(() => buildRegisterInsight(s, weeksLog), [s, weeksLog]);
  const trendStyle: Record<TrackTrend, string> = {
    improving: "bg-mint-100 text-mint-700",
    stable: "bg-sky-100 text-sky-700",
    declining: "bg-coral-100 text-coral-600",
    "insufficient-data": "bg-grape-100 text-grape-500",
  };
  const requirementStyle = {
    meets: "bg-mint-100 text-mint-700",
    near: "bg-sky-100 text-sky-700",
    below: "bg-amber-100 text-amber-700",
    "far-below": "bg-coral-100 text-coral-600",
    unknown: "bg-grape-100 text-grape-500",
  } as const;

  return (
    <article
      className={`anim-slide-up overflow-hidden rounded-[24px] border bg-white shadow-[0_18px_45px_-34px_rgba(55,32,120,.35)] transition-all ${
        s.isTesting
          ? "border-sky-300 bg-sky-50/50 ring-2 ring-sky-200"
          : noHearts
          ? "border-slate-200 bg-slate-50"
          : "border-grape-200 hover:border-grape-300 hover:shadow-[0_24px_65px_-42px_rgba(88,59,195,.55)]"
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* رأس البطاقة: بيانات الطالب والإحصاءات والإجراءات في سطر مريح */}
      <div className={`grid items-center gap-4 px-4 py-4 md:grid-cols-[minmax(220px,1fr)_minmax(190px,.75fr)_auto] sm:px-5 ${fade}`}>
        <div className="flex min-w-0 items-center gap-3">
          <Avatar photo={s.photo} name={s.name} size={58} frame={s.frame} crown={s.crown} glow={s.glow} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-display text-lg font-extrabold leading-tight text-ink sm:text-xl">{s.name}</h3>
              {s.isTesting && <span className="shrink-0 rounded-full bg-sky-600 px-2.5 py-1 text-xs font-extrabold text-white">اختبار</span>}
              <LevelBadge level={level} className="shrink-0 px-2.5! py-0.5! text-xs! shadow-none!" />
              <span className="shrink-0 rounded-full bg-grape-100 px-2 py-0.5 text-xs font-extrabold text-grape-500">{halaqas.find((h) => h.id === s.halaqaId)?.name ?? "بلا حلقة"}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <HeartsRow hearts={s.hearts} max={MAX_HEARTS} size="w-6 h-6" />
              {noHearts && <span className="rounded-full bg-coral-100 px-2 py-1 text-xs font-extrabold text-coral-600">نفدت القلوب</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className={`rounded-full px-2 py-1 text-[11px] font-extrabold ${requirementStyle[insight.memorization.requirement]}`}>{insight.memorization.label}</span>
              <span className={`rounded-full px-2 py-1 text-[11px] font-extrabold ${requirementStyle[insight.review.requirement]}`}>{insight.review.label}</span>
              {insight.memorization.trend !== "insufficient-data" && <span className={`rounded-full px-2 py-1 text-[11px] font-extrabold ${trendStyle[insight.memorization.trend]}`}>اتجاه الحفظ: {insight.memorization.trend === "improving" ? "يتحسن" : insight.memorization.trend === "declining" ? "يتراجع" : "ثابت"}</span>}
              {insight.review.trend !== "insufficient-data" && <span className={`rounded-full px-2 py-1 text-[11px] font-extrabold ${trendStyle[insight.review.trend]}`}>اتجاه المراجعة: {insight.review.trend === "improving" ? "يتحسن" : insight.review.trend === "declining" ? "يتراجع" : "ثابت"}</span>}
            </div>
            <p className="mt-2 max-w-2xl text-xs font-bold leading-5 text-grape-600">💡 {insight.advice}</p>
          </div>
        </div>

        <div className="min-w-0" title={`المستوى ${ar(level)} — باقي ${ar(need - into)} نقطة للمستوى التالي`}>
          <div className="mb-2 flex items-center justify-between text-xs font-extrabold text-grape-500">
            <span>تقدم المستوى</span><span>{ar(into)} / {ar(need)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-grape-100">
            <div className="xp-fill h-full rounded-full transition-[width] duration-700" style={{ width: levelPct + "%" }} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
          <div className="rounded-xl bg-gold-400/15 px-3 py-2 text-center">
            <p className="font-display text-lg font-extrabold leading-5 text-gold-600">+{ar(s.weekXp)}</p>
            <p className="mt-1 text-xs font-bold text-grape-500">نقطة</p>
          </div>
          <div className="rounded-xl bg-grape-100 px-3 py-2 text-center">
            <p className="flex items-center gap-1 font-display text-lg font-extrabold leading-5 text-grape-600"><Coin className="h-4 w-4" />+{ar(s.weekCoins)}</p>
            <p className="mt-1 text-xs font-bold text-grape-500">عملة</p>
          </div>
          <button type="button" onClick={() => removeHeart(s.id)} disabled={noHearts} title="خصم قلب" className="grid h-10 w-10 place-items-center rounded-xl bg-coral-500/10 text-coral-500 transition hover:bg-coral-500 hover:text-white disabled:opacity-30"><Icon name="heart" fill className="h-4.5 w-4.5" /></button>
          <button type="button" onClick={() => toggleStudentTesting(s.id)} className={`h-10 rounded-xl px-3 text-xs font-extrabold ${s.isTesting ? "bg-sky-600 text-white" : "border-2 border-sky-200 bg-sky-50 text-sky-700"}`}>{s.isTesting ? "إنهاء الاختبار" : "اختبار"}</button>
          <button type="button" onClick={onManage} title="إعدادات الطالب" className="grid h-10 w-10 place-items-center rounded-xl bg-grape-100 text-grape-600 transition hover:bg-grape-600 hover:text-white"><Icon name="wand" className="h-4.5 w-4.5" /></button>
          <DeleteBtn label="" onDelete={() => removeStudent(s.id)} />
        </div>
      </div>

      {/* خطة أسبوعية واضحة ومدمجة */}
      <div className={`border-t border-grape-100 bg-grape-50/25 p-4 sm:p-5 ${noHearts ? "opacity-65" : ""}`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h4 className="font-display text-base font-extrabold text-ink">خطة الورد الأسبوعية</h4>
            <p className="mt-1 text-xs font-semibold leading-5 text-grape-500">اكتب السورة والآيات والأسطر للحفظ والمراجعة، ويمكن استخدام نصف سطر مثل ٢٫٥</p>
          </div>
          <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-grape-500 shadow-sm">{ar(checkedCount)} / ١٢ منجز</span>
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          {DAYS.map((d) => {
            const ward = s.ward[d.key];
            const absent = s.days[d.key].absent === true;
            const cnt = DAY_PARTS.filter((p) => s.days[d.key][p.key]).length;
            return (
              <section key={d.key} className="rounded-2xl border border-grape-100 bg-white p-4 shadow-[0_8px_24px_-22px_rgba(55,32,120,.4)]">
                <div className="mb-2.5 flex items-center justify-between">
                  <h5 className="font-display text-sm font-extrabold text-grape-700">{d.label}</h5>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${absent ? "bg-coral-100 text-coral-600" : cnt === 3 ? "bg-mint-100 text-mint-600" : "bg-grape-100 text-grape-500"}`}>{absent ? "غائب — لا تقييم" : `${ar(cnt)} / ٣`}</span>
                </div>
                <div className="space-y-3">
                  <div className="rounded-xl bg-grape-50 p-2.5">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-grape-700"><Icon name="book" className="h-4 w-4" />الحفظ الجديد</div>
                    <div className="grid gap-2 grid-cols-[minmax(0,1fr)_88px_78px]">
                      <input disabled={absent} aria-label={`سورة الحفظ ${d.label}`} value={ward.memorization} onChange={(e) => updateWard(s.id, d.key, { ...ward, memorization: e.target.value })} placeholder={absent ? "غائب" : "اسم السورة"} className="field-control disabled:cursor-not-allowed disabled:opacity-50" />
                      <input disabled={absent} aria-label={`عدد آيات الحفظ ${d.label}`} type="number" min="0" value={ward.memorizationVerses || ""} onChange={(e) => updateWard(s.id, d.key, { ...ward, memorizationVerses: Number(e.target.value) })} placeholder="الآيات" className="field-control text-center disabled:cursor-not-allowed disabled:opacity-50" />
                      <input disabled={absent} aria-label={`عدد أسطر الحفظ ${d.label}`} type="number" min="0" step="0.5" value={ward.memorizationLines || ""} onChange={(e) => updateWard(s.id, d.key, { ...ward, memorizationLines: Number(e.target.value) })} placeholder="الأسطر" className="field-control text-center font-extrabold text-grape-700 disabled:cursor-not-allowed disabled:opacity-50" />
                    </div>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-2.5">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-amber-700"><Icon name="refresh" className="h-4 w-4" />المراجعة</div>
                    <div className="grid gap-2 grid-cols-[minmax(0,1fr)_88px_78px]">
                      <input disabled={absent} aria-label={`سورة المراجعة ${d.label}`} value={ward.review} onChange={(e) => updateWard(s.id, d.key, { ...ward, review: e.target.value })} placeholder={absent ? "غائب" : "اسم السورة أو السور"} className="field-control border-amber-200 disabled:cursor-not-allowed disabled:opacity-50" />
                      <input disabled={absent} aria-label={`عدد آيات المراجعة ${d.label}`} type="number" min="0" value={ward.reviewVerses || ""} onChange={(e) => updateWard(s.id, d.key, { ...ward, reviewVerses: Number(e.target.value) })} placeholder="الآيات" className="field-control border-amber-200 text-center disabled:cursor-not-allowed disabled:opacity-50" />
                      <input disabled={absent} aria-label={`عدد أسطر المراجعة ${d.label}`} type="number" min="0" step="0.5" value={ward.reviewLines || ""} onChange={(e) => updateWard(s.id, d.key, { ...ward, reviewLines: Number(e.target.value) })} placeholder="الأسطر" className="field-control border-amber-200 text-center font-extrabold text-amber-700 disabled:cursor-not-allowed disabled:opacity-50" />
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-grape-100 pt-3 sm:grid-cols-4">
                  <button type="button" onClick={() => markAbsent(s.id, d.key)} className={`flex h-9 items-center justify-center gap-1 rounded-lg border text-xs font-extrabold transition active:scale-95 ${absent ? "border-coral-400 bg-coral-500 text-white" : "border-coral-200 bg-white text-coral-500 hover:bg-coral-50"}`}><Icon name={absent ? "check" : "alert"} className="h-3.5 w-3.5" strokeWidth={2.7} />غائب</button>
                  {DAY_PARTS.map((p) => {
                    const on = s.days[d.key][p.key];
                    if (p.key === "a") return <button disabled={absent} key={p.key} type="button" onClick={() => markDay(s.id, d.key, p.key)} className={`flex h-9 items-center justify-center gap-1 rounded-lg border text-xs font-extrabold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${on ? PART_ON[p.key] : "border-grape-200 bg-white text-grape-400 hover:border-grape-400 hover:text-grape-600"}`}><Icon name={on ? "check" : p.icon} className="h-3.5 w-3.5" strokeWidth={2.7} />{p.label}</button>;
                    const rating = on ? (s.recitationRatings?.[d.key]?.[p.key] ?? "excellent") : "";
                    const emptyLabel = p.key === "h" ? "لم يحفظ" : "لم يراجع";
                    return (
                      <select
                        key={p.key}
                        disabled={absent}
                        aria-label={`حالة ${p.label} ${d.label}`}
                        value={rating}
                        onChange={(event) => {
                          const value = event.target.value as RecitationRating | "";
                          if (value) markDay(s.id, d.key, p.key, value);
                          else if (on) markDay(s.id, d.key, p.key);
                        }}
                        className={`h-9 rounded-lg border px-1 text-center text-xs font-extrabold outline-none transition disabled:cursor-not-allowed disabled:opacity-40 ${on ? PART_ON[p.key] : "border-grape-200 bg-white text-grape-400"}`}
                      >
                        <option value="">{emptyLabel}</option>
                        <option value="excellent">ممتاز</option>
                        <option value="very-good">جيد جدًا</option>
                      </select>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {noHearts && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-100 px-5 py-3">
          <p className="text-xs font-extrabold text-slate-500">
            نفدت قلوب {s.name} — سجّل له الحضور والتسميع ليجمع العملات، ثم يشتري قلبًا من متجره ({ar(heartPrice)} عملة) ويعود لنقاط المستوى
          </p>
          <button
            type="button"
            onClick={() => { setMode("student"); setTab("store"); }}
            className="rounded-lg bg-grape-600 px-2.5 py-1 text-xs font-extrabold text-white transition hover:bg-grape-700 active:scale-95"
          >
            فتح متجره
          </button>
        </div>
      )}
    </article>
  );
}

/* ===== نافذة إضافة طالب ===== */
function AddStudentModal({ onClose }: { onClose: () => void }) {
  const { addStudent, halaqas, toast } = useApp();
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [halaqaId, setHalaqaId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (f: File | null) => {
    if (!f) return;
    setBusy(true);
    try {
      setPhoto(await compressImage(f, 320, true));
      sfx.pop();
    } catch {
      toast("error", "تعذّر قراءة الصورة — جرّب صورة أخرى");
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (!name.trim()) {
      toast("error", "اكتب اسم الطالب أولًا");
      sfx.error();
      return;
    }
    addStudent(name.trim(), photo, halaqaId);
    onClose();
  };

  return (
    <Modal open onClose={onClose}>
      <div className="p-6">
        <h3 className="font-display text-2xl font-extrabold text-ink">انضمام طالب جديد</h3>
        <p className="mt-1 text-sm text-grape-700/70">يُضاف تلقائيًا إلى كشف الحلقة برصيد ١٠ عملات ترحيبية</p>

        <div className="mt-5 flex items-center gap-5">
          <button type="button" onClick={() => fileRef.current?.click()} className="group relative shrink-0" title="رفع صورة الطالب">
            {photo ? (
              <img src={photo} alt="معاينة" className="h-24 w-24 rounded-2xl border-4 border-grape-200 object-cover transition group-hover:border-grape-400" />
            ) : (
              <span className="dashed-border grid h-24 w-24 place-items-center rounded-2xl bg-grape-50 text-grape-400 transition group-hover:text-grape-600">
                {busy ? <span className="text-xs font-bold">جاري...</span> : <Icon name="user" className="h-9 w-9" strokeWidth={1.8} />}
              </span>
            )}
            <span className="absolute -bottom-1.5 -end-1.5 grid h-8 w-8 place-items-center rounded-full bg-grape-600 text-white shadow-lg transition group-hover:scale-110">
              <Icon name="plus" className="h-4 w-4" strokeWidth={3} />
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          <div className="flex-1">
            <label className="mb-1.5 block text-sm font-bold text-grape-700">اسم الطالب</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="مثال: عبدالله"
              autoFocus
              className="w-full rounded-2xl border-2 border-grape-200 bg-grape-50 px-4 py-2.5 font-display font-bold text-ink outline-none transition focus:border-grape-500 focus:bg-white"
            />
            {photo && (
              <button type="button" onClick={() => setPhoto(null)} className="mt-2 text-xs font-bold text-coral-500 underline-offset-4 hover:underline">
                إزالة الصورة
              </button>
            )}
            <label className="mt-3 block text-sm font-bold text-grape-700">الحلقة</label>
            <select value={halaqaId ?? ""} onChange={(e) => setHalaqaId(e.target.value || null)} className="mt-1 w-full rounded-2xl border-2 border-grape-200 bg-grape-50 px-4 py-2.5 font-bold text-ink outline-none focus:border-grape-500">
              <option value="">بلا حلقة</option>
              {halaqas.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-6 flex gap-2.5">
          <BigBtn className="flex-1" onClick={submit}>
            <Icon name="check" className="h-5 w-5" strokeWidth={3} />
            إضافة للكشف
          </BigBtn>
          <button type="button" onClick={onClose} className="rounded-2xl border-2 border-grape-200 bg-white px-5 font-display font-bold text-grape-500 transition hover:bg-grape-50">
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ===== الكشف ===== */
export default function Register() {
  const { students, halaqas, addHalaqa, removeHalaqa, week, weekName } = useApp();
  const [addOpen, setAddOpen] = useState(false);
  const [manageId, setManageId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [halaqaFilter, setHalaqaFilter] = useState<string>("all");
  const [newHalaqa, setNewHalaqa] = useState("");
  const [showHalaqaManager, setShowHalaqaManager] = useState(false);

  const byName = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("ar");
    return [...students]
      .filter((s) => (!q || s.name.toLocaleLowerCase("ar").includes(q)) && (halaqaFilter === "all" || (halaqaFilter === "none" ? !s.halaqaId : s.halaqaId === halaqaFilter)))
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [students, query, halaqaFilter]);

  return (
    <div className="anim-fade">
      <SectionHead
        icon="calendar"
        title="كشف الحلقة"
        desc={`${weekName || "الأسبوع الحالي"} · مرتب أبجديًا · كل يوم: حضور + تسميع حفظ + تسميع مراجعة`}
        extra={
          <BigBtn onClick={() => setAddOpen(true)} color="bg-gradient-to-l from-mint-600 to-mint-500 hover:brightness-105 shadow-[0_12px_28px_-16px_rgba(22,133,104,.9)]">
            <Icon name="plus" className="h-5 w-5" strokeWidth={3} />
            طالب جديد
          </BigBtn>
        }
      />

      <div className="mb-4 rounded-2xl border border-grape-200/80 bg-white/90 p-3 shadow-[0_16px_40px_-34px_rgba(76,29,149,.55)] backdrop-blur">
        <label className="relative block">
          <Icon name="search" className="pointer-events-none absolute end-3 top-1/2 h-5 w-5 -translate-y-1/2 text-grape-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن طالب بالاسم..."
            className="h-12 w-full rounded-xl border border-grape-200 bg-grape-50/60 pe-11 ps-4 text-sm font-bold text-ink outline-none transition placeholder:text-grape-300 focus:border-grape-500 focus:bg-white focus:ring-4 focus:ring-grape-100"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setHalaqaFilter("all")} className={`rounded-xl px-3 py-2 text-xs font-extrabold ${halaqaFilter === "all" ? "bg-grape-600 text-white" : "bg-grape-50 text-grape-600"}`}>جميع الحلقات</button>
          {halaqas.map((h) => <button key={h.id} type="button" onClick={() => setHalaqaFilter(h.id)} className={`rounded-xl px-3 py-2 text-xs font-extrabold ${halaqaFilter === h.id ? "bg-grape-600 text-white" : "bg-grape-50 text-grape-600"}`}>{h.name}</button>)}
          <button type="button" onClick={() => setHalaqaFilter("none")} className={`rounded-xl px-3 py-2 text-xs font-extrabold ${halaqaFilter === "none" ? "bg-grape-600 text-white" : "bg-grape-50 text-grape-500"}`}>بلا حلقة</button>
          <button type="button" onClick={() => setShowHalaqaManager((v) => !v)} className="rounded-xl border-2 border-dashed border-grape-300 px-3 py-1.5 text-xs font-extrabold text-grape-600">+ إضافة حلقة جديدة</button>
        </div>
        {showHalaqaManager && <div className="mt-3 rounded-xl border border-grape-200 bg-grape-50 p-3"><div className="flex gap-2"><input value={newHalaqa} onChange={(e) => setNewHalaqa(e.target.value)} placeholder="مثال: حلقة أ" className="field-control flex-1"/><button type="button" onClick={() => { addHalaqa(newHalaqa); setNewHalaqa(""); }} className="rounded-xl bg-grape-600 px-4 text-sm font-extrabold text-white">إضافة</button></div>{halaqas.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{halaqas.map((h) => <span key={h.id} className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-grape-600">{h.name}<button type="button" onClick={() => removeHalaqa(h.id)} title="حذف الحلقة دون حذف الطلاب" className="text-coral-500">×</button></span>)}</div>}</div>}
      </div>

      {/* قاعدة النقاط */}
      <div className="mb-4 grid gap-2 rounded-2xl border border-grape-200/80 bg-white/90 p-3 shadow-[0_16px_40px_-36px_rgba(76,29,149,.55)] sm:grid-cols-3">
        <span className="flex items-center gap-2 rounded-xl bg-mint-400/15 px-3 py-2 text-sm font-extrabold text-mint-600">
          <Icon name="user" className="h-4 w-4" strokeWidth={2.6} />
          مجرد الحضور: +{ar(ATTEND_XP)} نقاط و+{ar(ATTEND_COINS)} عملات
        </span>
        <span className="flex items-center gap-2 rounded-xl bg-grape-600/10 px-3 py-2 text-sm font-extrabold text-grape-600">
          <Icon name="book" className="h-4 w-4" strokeWidth={2.4} />
          تسميع الحفظ: +{ar(RECITE_XP)} نقاط و+{ar(RECITE_COINS)} عملات
        </span>
        <span className="flex items-center gap-2 rounded-xl bg-gold-400/20 px-3 py-2 text-sm font-extrabold text-gold-600">
          <Icon name="refresh" className="h-4 w-4" strokeWidth={2.4} />
          تسميع المراجعة: +{ar(RECITE_XP)} نقاط و+{ar(RECITE_COINS)} عملات
        </span>
        <p className="px-1 text-xs font-bold text-grape-700/55 sm:col-span-3">
          العملات تُجمع دائمًا · نقاط المستوى تتوقف لمن نفدت قلوبه حتى يشتري قلبًا · من يخالف آداب الحلقة يخسر قلبًا
        </p>
      </div>

      {byName.length === 0 ? (
        <div className="dashed-border rounded-3xl bg-white/70 p-16 text-center">
          <p className="font-display text-xl font-extrabold text-grape-600">{query ? "لا يوجد طالب بهذا الاسم" : "الكشف فارغ"}</p>
          <p className="mt-1 text-sm text-grape-700/70">{query ? "جرّب كتابة اسم آخر" : "أضف أول طالب باسمه وصورته"}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {byName.map((s, i) => (
            <RegisterRow key={s.id} s={s} delay={i * 50} onManage={() => setManageId(s.id)} />
          ))}
        </div>
      )}

      {addOpen && <AddStudentModal onClose={() => setAddOpen(false)} />}
      {manageId && <ManageStudentModal id={manageId} onClose={() => setManageId(null)} />}
    </div>
  );
}
