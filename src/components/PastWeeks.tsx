import { useMemo, useState } from "react";
import { useApp } from "../appState";
import { addCalendarDays, formatHijriDate, formatTeachingWeek } from "../hijriDate";
import { ar, DAYS, emptyRecitationRatings, emptyWeeklyWard, emptyWeekDays, uid, type DayKey, type DayPart, type WeekLog, type WeekStudentRecord } from "../core";
import Avatar from "./Avatar";
import { SectionHead } from "./ui";

const copy = <T,>(value: T): T => structuredClone(value);

const normalizeSearch = (value: string): string => {
  const arDigits = "٠١٢٣٤٥٦٧٨٩";
  let s = value;
  for (let i = 0; i < arDigits.length; i++) {
    s = s.replaceAll(arDigits[i], String(i));
  }
  return s
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim()
    .toLowerCase();
};

function StudentEditor({ record, update, remove, weekStartDateIso }: {
  record: WeekStudentRecord;
  update: (record: WeekStudentRecord) => void;
  remove: () => void;
  weekStartDateIso?: string;
}) {
  const setDay = (day: DayKey, key: DayPart | "absent", checked: boolean) => {
    const days = copy(record.days);
    if (key === "absent") days[day] = checked ? { a: false, h: false, r: false, absent: true } : { ...days[day], absent: false };
    else days[day] = { ...days[day], [key]: checked, absent: false };
    update({ ...record, days });
  };
  const setLines = (day: DayKey, key: "memorizationLines" | "reviewLines", value: number) => {
    update({ ...record, ward: { ...record.ward, [day]: { ...record.ward[day], [key]: Math.max(0, value || 0) } } });
  };
  return <article className="rounded-2xl border-2 border-grape-100 bg-white p-4">
    <div className="flex flex-wrap items-center gap-3">
      <Avatar photo={record.photo} name={record.name} size={42} />
      <input className="field-control min-w-40 flex-1" value={record.name} onChange={(e) => update({ ...record, name: e.target.value })} />
      <label className="rounded-xl bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700"><input className="me-1" type="checkbox" checked={!!record.isTesting} onChange={(e) => update({ ...record, isTesting: e.target.checked })} />اختبار</label>
      <button type="button" className="rounded-xl bg-coral-50 px-3 py-2 text-xs font-bold text-coral-600" onClick={remove}>إزالة من هذا الأسبوع</button>
    </div>
    <div className="mt-3 grid gap-2 lg:grid-cols-2">
      {DAYS.map((day) => <div key={day.key} className="rounded-xl bg-grape-50 p-3">
        <p className="mb-2 font-display text-sm font-extrabold">{day.label}{weekStartDateIso ? <span className="ms-2 text-xs text-grape-400">{formatHijriDate(addCalendarDays(weekStartDateIso, DAYS.findIndex((item) => item.key === day.key)), { day: "numeric", month: "long" })}</span> : null}</p>
        <div className="grid grid-cols-4 gap-1 text-xs">
          {(["a", "h", "r"] as DayPart[]).map((part) => <label key={part} className="rounded-lg bg-white p-2 text-center font-bold"><input className="me-1" type="checkbox" disabled={!!record.days[day.key].absent} checked={record.days[day.key][part]} onChange={(e) => setDay(day.key, part, e.target.checked)} />{part === "a" ? "حضور" : part === "h" ? "حفظ" : "مراجعة"}</label>)}
          <label className="rounded-lg bg-coral-50 p-2 text-center font-bold text-coral-600"><input className="me-1" type="checkbox" checked={!!record.days[day.key].absent} onChange={(e) => setDay(day.key, "absent", e.target.checked)} />غائب</label>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-xs font-bold text-grape-500">أسطر الحفظ<input className="field-control mt-1 w-full" type="number" min="0" step="0.5" value={record.ward[day.key].memorizationLines} onChange={(e) => setLines(day.key, "memorizationLines", Number(e.target.value))} /></label>
          <label className="text-xs font-bold text-grape-500">أسطر المراجعة<input className="field-control mt-1 w-full" type="number" min="0" step="0.5" value={record.ward[day.key].reviewLines} onChange={(e) => setLines(day.key, "reviewLines", Number(e.target.value))} /></label>
        </div>
      </div>)}
    </div>
  </article>;
}

export default function PastWeeks() {
  const { weeksLog, updateWeekLog } = useApp();
  const [dateSearch, setDateSearch] = useState("");

  // ترتيب زمني تنازلي من الأحدث إلى الأقدم
  const logs = useMemo(() => [...weeksLog].sort((a, b) => {
    const time = (log: WeekLog): number => {
      const primary = log.weekStartDateIso ? new Date(`${log.weekStartDateIso}T12:00:00`).getTime() : Number.NaN;
      if (Number.isFinite(primary)) return primary;
      const fallback = new Date(log.savedAtIso ?? log.savedAt).getTime();
      return Number.isFinite(fallback) ? fallback : log.week;
    };
    return time(b) - time(a) || b.week - a.week;
  }), [weeksLog]);

  // البحث في التواريخ الهجرية الحقيقية المحفوظة للأسبوع (اليوم والشهر والسنة)
  const filteredLogs = useMemo(() => {
    const q = normalizeSearch(dateSearch);
    if (!q) return logs;
    return logs.filter((log) => {
      const searchTargets: string[] = [
        log.name ?? "",
        `الأسبوع ${log.week}`,
        String(log.week),
      ];
      if (log.weekStartDateIso) {
        searchTargets.push(formatTeachingWeek(log.weekStartDateIso));
        searchTargets.push(formatHijriDate(log.weekStartDateIso, { day: "numeric", month: "long", year: "numeric" }));
        DAYS.forEach((_, idx) => {
          const d = addCalendarDays(log.weekStartDateIso!, idx);
          searchTargets.push(formatHijriDate(d, { day: "numeric", month: "long", year: "numeric" }));
        });
      }
      if (log.savedAtIso) {
        searchTargets.push(formatHijriDate(log.savedAtIso, { day: "numeric", month: "long", year: "numeric" }));
      }
      return searchTargets.some((target) => normalizeSearch(target).includes(q));
    });
  }, [logs, dateSearch]);

  const [week, setWeek] = useState<number | null>(logs[0]?.week ?? null);
  const current = (filteredLogs.find((item) => item.week === week) ?? filteredLogs[0] ?? logs.find((item) => item.week === week)) ?? null;
  const [draft, setDraft] = useState<WeekLog | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const shown = draft ?? current;

  const unlock = () => {
    if (!current || pin !== "911") return setError("الرمز غير صحيح");
    setDraft(copy(current)); setPin(""); setError("");
  };

  const addStudent = () => setDraft((log) => !log ? log : ({ ...log, records: [...(log.records ?? []), {
    id: `archive-${uid()}`, name: "طالب أضيف إلى السجل", photo: null, halaqaId: null,
    isTesting: false, days: emptyWeekDays(), recitationRatings: emptyRecitationRatings(),
    ward: emptyWeeklyWard(), hearts: 3, heartsLostWeek: 0, xp: 0, coins: 0,
  }] }));

  return <div className="anim-fade">
    <SectionHead icon="calendar" title="الأسابيع الماضية / الأرشيف" desc="تصفح أرشيف الأسابيع والبحث حسب التاريخ الهجري المحفوظ مع الحفاظ على الترتيب الزمني" />
    
    {logs.length === 0 ? (
      <div className="rounded-3xl border-2 border-dashed border-grape-200 bg-white p-12 text-center font-bold text-grape-500">
        لا توجد أسابيع مؤرشفة بعد.
      </div>
    ) : (
      <div className="grid gap-4 lg:grid-cols-[290px_1fr]">
        <aside className="space-y-2">
          {/* مربع البحث بالتاريخ في الأرشيف */}
          <div className="relative mb-2">
            <input
              type="text"
              value={dateSearch}
              onChange={(e) => setDateSearch(e.target.value)}
              placeholder="ابحث بالتاريخ (مثال: 3 ربيع الآخر 1448)..."
              className="field-control w-full pe-8 text-xs font-bold"
            />
            {dateSearch && (
              <button
                type="button"
                onClick={() => setDateSearch("")}
                className="absolute inset-y-0 end-2 flex items-center text-xs font-extrabold text-grape-400 hover:text-coral-500"
              >
                ✕
              </button>
            )}
          </div>
          {dateSearch && (
            <p className="text-[11px] font-bold text-grape-500 px-1">
              الأسابيع المطابقة: {ar(filteredLogs.length)}
            </p>
          )}

          {filteredLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-grape-200 bg-white p-6 text-center text-xs font-bold text-grape-400">
              لا يوجد أسبوع يطابق البحث «{dateSearch}»
            </div>
          ) : (
            filteredLogs.map((log) => (
              <button
                key={log.week}
                type="button"
                onClick={() => { setWeek(log.week); setDraft(null); }}
                className={`w-full rounded-2xl border-2 p-3 text-start transition ${
                  shown?.week === log.week ? "border-grape-600 bg-grape-600 text-white shadow" : "border-grape-100 bg-white hover:border-grape-300"
                }`}
              >
                <strong className="block font-display">{log.name || `الأسبوع ${ar(log.week)}`}</strong>
                <span className="text-xs opacity-75">
                  {log.weekStartDateIso
                    ? formatTeachingWeek(log.weekStartDateIso)
                    : log.savedAtIso
                    ? `المنتهي في ${formatHijriDate(log.savedAtIso)}`
                    : "تاريخ محفوظ سابقًا"}
                </span>
              </button>
            ))
          )}
        </aside>

        {!shown ? (
          <div className="rounded-3xl border-2 border-dashed border-grape-200 bg-white p-12 text-center font-bold text-grape-500">
            اختر أسبوعًا من القائمة لعرض بياناته.
          </div>
        ) : (
          <section className="rounded-3xl border-2 border-grape-100 bg-white p-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1">
                <h3 className="font-display text-xl font-extrabold">{shown.name || `الأسبوع ${ar(shown.week)}`}</h3>
                <p className="text-xs font-bold text-grape-500">
                  {shown.weekStartDateIso ? formatTeachingWeek(shown.weekStartDateIso) : shown.savedAtIso ? formatHijriDate(shown.savedAtIso) : "تاريخ محفوظ سابقًا"}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${draft ? "bg-coral-100 text-coral-600" : "bg-mint-100 text-mint-700"}`}>
                {draft ? "وضع التعديل" : "وضع المشاهدة"}
              </span>
            </div>

            {shown.weekStartDateIso && (
              <div className="mt-3 flex flex-wrap gap-2">
                {DAYS.map((day, index) => (
                  <span key={day.key} className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
                    {day.label} · {formatHijriDate(addCalendarDays(shown.weekStartDateIso!, index), { day: "numeric", month: "long" })}
                  </span>
                ))}
              </div>
            )}

            {!draft ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <input className="field-control w-40" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="رمز التعديل" />
                <button type="button" onClick={unlock} className="rounded-xl bg-grape-600 px-4 py-2 text-sm font-bold text-white">فتح التعديل</button>
                {error && <span className="self-center text-xs font-bold text-coral-600">{error}</span>}
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={addStudent} className="rounded-xl bg-mint-600 px-4 py-2 text-sm font-bold text-white">+ إضافة طالب للسجل</button>
                <button type="button" onClick={() => setDraft(null)} className="rounded-xl bg-grape-100 px-4 py-2 text-sm font-bold text-grape-600">إلغاء</button>
                <button type="button" onClick={() => { updateWeekLog(draft.week, draft); setDraft(null); }} className="rounded-xl bg-grape-600 px-4 py-2 text-sm font-bold text-white">حفظ التغييرات</button>
              </div>
            )}

            {shown.trip && (
              <div className="mt-4 rounded-2xl bg-mint-50 p-4">
                <h4 className="font-display font-extrabold text-mint-700">طلاب الرحلة</h4>
                <p className="mt-1 text-sm font-bold text-mint-700">{shown.trip.attendeeNames.join("، ") || "لم يُسجل مشاركون"}</p>
              </div>
            )}

            {shown.awards.length > 0 && (
              <div className="mt-4 rounded-2xl bg-gold-50 p-4">
                <h4 className="font-display font-extrabold">جوائز الحفل المعتمدة</h4>
                <div className="mt-2 flex flex-wrap gap-2">
                  {shown.awards.map((award, i) => (
                    <span key={i} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-gold-700">
                      {award.title}: {award.studentName}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 space-y-3">
              {shown.records ? shown.records.map((record) => draft ? (
                <StudentEditor
                  key={record.id}
                  record={record}
                  weekStartDateIso={shown.weekStartDateIso}
                  update={(next) => setDraft((log) => log ? { ...log, records: log.records?.map((r) => r.id === record.id ? next : r) } : log)}
                  remove={() => setDraft((log) => log ? { ...log, records: log.records?.filter((r) => r.id !== record.id) } : log)}
                />
              ) : (
                <article key={record.id} className="flex items-center gap-3 rounded-2xl bg-grape-50 p-3">
                  <Avatar photo={record.photo} name={record.name} size={42} />
                  <div>
                    <p className="font-display font-extrabold">{record.name} {record.isTesting && <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] text-white">اختبار</span>}</p>
                    <p className="text-xs font-bold text-grape-500">حضور {ar(DAYS.filter((d) => record.days[d.key].a).length)} · غياب {ar(DAYS.filter((d) => record.days[d.key].absent).length)} · حفظ {ar(DAYS.filter((d) => record.days[d.key].h).length)} · مراجعة {ar(DAYS.filter((d) => record.days[d.key].r).length)}</p>
                  </div>
                </article>
              )) : (shown.students ?? shown.top).map((entry) => (
                <article key={entry.id} className="flex items-center gap-3 rounded-2xl bg-grape-50 p-3">
                  <Avatar photo={entry.photo} name={entry.name} size={42} />
                  <div>
                    <p className="font-display font-extrabold">{entry.name}</p>
                    <p className="text-xs font-bold text-grape-500">{ar(entry.weekXp)} نقطة أسبوعية</p>
                  </div>
                </article>
              ))}
            </div>
            {!shown.records && <p className="mt-4 rounded-xl bg-gold-50 p-3 text-xs font-bold text-gold-700">هذا سجل قديم لا يحتوي لقطة يومية كاملة؛ تُعرض معلوماته المحفوظة فقط دون اختراع بيانات.</p>}
          </section>
        )}
      </div>
    )}
  </div>;
}
