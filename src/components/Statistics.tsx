/* إحصائيات الطلاب فقط — قراءة مباشرة من الكشف الحالي وأرشيف الأسابيع */
import { useMemo, useState } from "react";
import { useApp } from "../appState";
import { analyzeStudent, measureStudentWork } from "../analytics";
import { ar, DAYS, type DayKey, type Student, type WeekLog, type WeekLogEntry, type WeekStudentRecord } from "../core";
import Avatar from "./Avatar";
import { Icon, SectionHead } from "./ui";

type Period = "daily" | "weekly" | "monthly" | "all";
type StudentMetrics = {
  id: string; name: string; photo: string | null;
  present: number; absent: number; memorizationSessions: number; reviewSessions: number;
  memorizationVerses: number; reviewVerses: number; memorizationLines: number; reviewLines: number;
  memorizationPages: number; reviewPages: number;
};

const emptyMetrics = (student: Pick<Student, "id" | "name" | "photo">): StudentMetrics => ({ id: student.id, name: student.name, photo: student.photo, present: 0, absent: 0, memorizationSessions: 0, reviewSessions: 0, memorizationVerses: 0, reviewVerses: 0, memorizationLines: 0, reviewLines: 0, memorizationPages: 0, reviewPages: 0 });
const n = (value: number) => ar(Number(value.toFixed(2)));
const add = (a: StudentMetrics, b: StudentMetrics): StudentMetrics => ({ ...a, present: a.present + b.present, absent: a.absent + b.absent, memorizationSessions: a.memorizationSessions + b.memorizationSessions, reviewSessions: a.reviewSessions + b.reviewSessions, memorizationVerses: a.memorizationVerses + b.memorizationVerses, reviewVerses: a.reviewVerses + b.reviewVerses, memorizationLines: a.memorizationLines + b.memorizationLines, reviewLines: a.reviewLines + b.reviewLines, memorizationPages: a.memorizationPages + b.memorizationPages, reviewPages: a.reviewPages + b.reviewPages });

function fromRecord(record: WeekStudentRecord, day?: DayKey): StudentMetrics {
  const result = emptyMetrics(record);
  const selected = day ? DAYS.filter((item) => item.key === day) : DAYS;
  for (const item of selected) {
    const state = record.days[item.key];
    const ward = record.ward[item.key];
    if (state.a) result.present += 1;
    if (state.absent) result.absent += 1;
    if (state.h && !state.absent) { result.memorizationSessions += 1; result.memorizationVerses += ward.memorizationVerses || 0; result.memorizationLines += ward.memorizationLines || 0; }
    if (state.r && !state.absent) { result.reviewSessions += 1; result.reviewVerses += ward.reviewVerses || 0; result.reviewLines += ward.reviewLines || 0; }
  }
  result.memorizationPages = result.memorizationLines / 15;
  result.reviewPages = result.reviewLines / 15;
  return result;
}

function fromStudent(student: Student, day?: DayKey): StudentMetrics {
  const result = fromRecord({ id: student.id, name: student.name, photo: student.photo, halaqaId: student.halaqaId, days: student.days, recitationRatings: student.recitationRatings ?? { sun: {}, mon: {}, tue: {}, wed: {} }, ward: student.ward, hearts: student.hearts, heartsLostWeek: student.heartsLostWeek, xp: student.xp, coins: student.coins }, day);
  if (!day) {
    const memorization = measureStudentWork(student, "memorization");
    const review = measureStudentWork(student, "review");
    result.memorizationPages = memorization.pages; result.reviewPages = review.pages;
    result.memorizationLines = memorization.lines; result.reviewLines = review.lines;
  }
  return result;
}

function fromEntry(entry: WeekLogEntry): StudentMetrics {
  return { id: entry.id, name: entry.name, photo: entry.photo, present: entry.attendanceDays ?? 0, absent: entry.absenceDays ?? 0, memorizationSessions: entry.memorizationDays ?? 0, reviewSessions: entry.reviewDays ?? 0, memorizationVerses: entry.memorizationVerses ?? 0, reviewVerses: entry.reviewVerses ?? 0, memorizationLines: entry.memorizationLines ?? 0, reviewLines: entry.reviewLines ?? 0, memorizationPages: entry.memorizationPages ?? (entry.memorizationLines ?? 0) / 15, reviewPages: entry.reviewPages ?? (entry.reviewLines ?? 0) / 15 };
}

const logDate = (log: WeekLog): Date | null => { if (!log.savedAtIso) return null; const date = new Date(log.savedAtIso); return Number.isNaN(date.getTime()) ? null : date; };
const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (key: string) => new Date(`${key}-01T12:00:00`).toLocaleDateString("ar", { month: "long", year: "numeric" });
function logMetrics(log: WeekLog): StudentMetrics[] { return log.records?.length ? log.records.map((record) => fromRecord(record)) : (log.students ?? log.top).map(fromEntry); }

function MetricCard({ icon, label, value, tone = "grape" }: { icon: string; label: string; value: string; tone?: "grape" | "mint" | "coral" | "gold" }) {
  const colors = { grape: "border-grape-200 text-grape-600", mint: "border-mint-200 text-mint-700", coral: "border-coral-200 text-coral-600", gold: "border-gold-200 text-gold-700" };
  return <div className={`rounded-2xl border-2 bg-white p-4 ${colors[tone]}`}><div className="flex items-center gap-2 text-xs font-extrabold"><Icon name={icon} className="h-4 w-4" />{label}</div><p className="mt-2 font-display text-2xl font-extrabold text-ink">{value}</p></div>;
}

export default function StatisticsPage() {
  const { students, weeksLog, halaqas, week } = useApp();
  const [period, setPeriod] = useState<Period>("weekly");
  const [studentId, setStudentId] = useState("all");
  const [halaqaId, setHalaqaId] = useState("all");
  const [day, setDay] = useState<DayKey>("sun");
  const [selectedWeek, setSelectedWeek] = useState("current");
  const availableMonths = useMemo(() => [...new Set([monthKey(new Date()), ...weeksLog.map(logDate).filter((date): date is Date => !!date).map(monthKey)])].sort().reverse(), [weeksLog]);
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()));
  const currentStudents = useMemo(() => students.filter((student) => halaqaId === "all" || (student.halaqaId ?? "none") === halaqaId), [students, halaqaId]);

  const metrics = useMemo(() => {
    let rows: StudentMetrics[] = [];
    if (period === "daily") rows = currentStudents.map((student) => fromStudent(student, day));
    if (period === "weekly") {
      if (selectedWeek === "current") rows = currentStudents.map((student) => fromStudent(student));
      else { const log = weeksLog.find((item) => item.week === Number(selectedWeek)); rows = log ? logMetrics(log) : []; }
    }
    if (period === "monthly" || period === "all") {
      const sourceLogs = period === "monthly" ? weeksLog.filter((log) => { const date = logDate(log); return date && monthKey(date) === selectedMonth; }) : weeksLog;
      const map = new Map<string, StudentMetrics>();
      for (const student of currentStudents) map.set(student.id, emptyMetrics(student));
      for (const row of sourceLogs.flatMap(logMetrics)) {
        const blank = { ...row, present: 0, absent: 0, memorizationSessions: 0, reviewSessions: 0, memorizationVerses: 0, reviewVerses: 0, memorizationLines: 0, reviewLines: 0, memorizationPages: 0, reviewPages: 0 };
        map.set(row.id, add(map.get(row.id) ?? blank, row));
      }
      if (period === "all" || selectedMonth === monthKey(new Date())) for (const student of currentStudents) map.set(student.id, add(map.get(student.id) ?? emptyMetrics(student), fromStudent(student)));
      rows = [...map.values()];
    }
    if (halaqaId !== "all" && period !== "daily" && !(period === "weekly" && selectedWeek === "current")) { const allowed = new Set(currentStudents.map((student) => student.id)); rows = rows.filter((row) => allowed.has(row.id)); }
    return studentId === "all" ? rows : rows.filter((row) => row.id === studentId);
  }, [period, currentStudents, day, selectedWeek, selectedMonth, weeksLog, studentId, halaqaId]);

  const total = metrics.reduce((sum, item) => add(sum, item), { id: "total", name: "الإجمالي", photo: null, present: 0, absent: 0, memorizationSessions: 0, reviewSessions: 0, memorizationVerses: 0, reviewVerses: 0, memorizationLines: 0, reviewLines: 0, memorizationPages: 0, reviewPages: 0 });
  const selectedStudent = students.find((student) => student.id === studentId);
  const selectedAnalysis = selectedStudent ? analyzeStudent(selectedStudent, weeksLog) : null;

  return <div className="space-y-5">
    <SectionHead title="إحصائيات الطلاب" desc="يومية وأسبوعية وشهرية وإجمالية — مبنية على السجلات الفعلية للطلاب فقط" icon="chart" />
    <div className="rounded-3xl border border-grape-200 bg-white p-4">
      <div className="flex flex-wrap gap-2">{(["daily", "weekly", "monthly", "all"] as Period[]).map((item) => <button key={item} onClick={() => setPeriod(item)} className={`rounded-xl px-4 py-2 text-sm font-extrabold ${period === item ? "bg-grape-600 text-white" : "bg-grape-50 text-grape-600"}`}>{item === "daily" ? "يومية" : item === "weekly" ? "أسبوعية" : item === "monthly" ? "شهرية" : "إجمالية"}</button>)}</div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label className="text-xs font-extrabold text-grape-600">الحلقة<select value={halaqaId} onChange={(e) => { setHalaqaId(e.target.value); setStudentId("all"); }} className="field-control mt-1 w-full"><option value="all">جميع الحلقات</option>{halaqas.map((halaqa) => <option key={halaqa.id} value={halaqa.id}>{halaqa.name}</option>)}<option value="none">بلا حلقة</option></select></label>
        <label className="text-xs font-extrabold text-grape-600">الطالب<select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="field-control mt-1 w-full"><option value="all">جميع الطلاب</option>{currentStudents.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
        {period === "daily" && <label className="text-xs font-extrabold text-grape-600">اليوم<select value={day} onChange={(e) => setDay(e.target.value as DayKey)} className="field-control mt-1 w-full">{DAYS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>}
        {period === "weekly" && <label className="text-xs font-extrabold text-grape-600">الأسبوع<select value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)} className="field-control mt-1 w-full"><option value="current">الأسبوع الحالي ({ar(week)})</option>{weeksLog.map((log) => <option key={log.week} value={log.week}>{log.name || `الأسبوع ${ar(log.week)}`}</option>)}</select></label>}
        {period === "monthly" && <label className="text-xs font-extrabold text-grape-600">الشهر<select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="field-control mt-1 w-full">{availableMonths.map((key) => <option key={key} value={key}>{monthLabel(key)}</option>)}</select></label>}
      </div>
    </div>

    <section><div className="mb-3 flex items-center gap-3">{selectedStudent && <Avatar photo={selectedStudent.photo} name={selectedStudent.name} size={46} />}<div><h3 className="font-display text-xl font-extrabold text-ink">{selectedStudent ? selectedStudent.name : "ملخص جميع الطلاب"}</h3><p className="text-xs font-bold text-grape-500">{period === "daily" ? `بيانات يوم ${DAYS.find((item) => item.key === day)?.label}` : period === "weekly" ? "بيانات الأسبوع المحدد" : period === "monthly" ? "بيانات الشهر المحدد" : "من أول سجل متاح حتى الآن"}</p></div></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MetricCard icon="check" label="الحضور" value={ar(total.present)} tone="mint"/><MetricCard icon="alert" label="الغياب" value={ar(total.absent)} tone={total.absent ? "coral" : "grape"}/><MetricCard icon="book" label="جلسات الحفظ" value={ar(total.memorizationSessions)}/><MetricCard icon="refresh" label="جلسات المراجعة" value={ar(total.reviewSessions)}/><MetricCard icon="book" label="آيات الحفظ" value={ar(total.memorizationVerses)}/><MetricCard icon="refresh" label="آيات المراجعة" value={ar(total.reviewVerses)}/><MetricCard icon="chart" label="أسطر الحفظ" value={n(total.memorizationLines)}/><MetricCard icon="chart" label="أسطر المراجعة" value={n(total.reviewLines)}/><MetricCard icon="book" label="صفحات الحفظ" value={n(total.memorizationPages)} tone="gold"/><MetricCard icon="refresh" label="صفحات المراجعة" value={n(total.reviewPages)} tone="gold"/></div>
      <p className="mt-3 rounded-xl bg-grape-50 p-3 text-xs font-bold text-grape-500">النشاط لا يُحفظ حاليًا كحقل مستقل في البيانات، لذلك لم يُعرض له رقم تقديري.</p>
    </section>

    {studentId === "all" && <section className="overflow-x-auto rounded-3xl border border-grape-200 bg-white p-4"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b border-grape-100 text-right text-xs font-extrabold text-grape-500"><th className="p-2">الطالب</th><th className="p-2">حضور</th><th className="p-2">غياب</th><th className="p-2">جلسات الحفظ</th><th className="p-2">جلسات المراجعة</th><th className="p-2">صفحات الحفظ</th><th className="p-2">صفحات المراجعة</th></tr></thead><tbody>{metrics.map((item) => <tr key={item.id} className="border-b border-grape-50"><td className="p-2 font-extrabold text-ink">{item.name}</td><td className="p-2">{ar(item.present)}</td><td className="p-2">{ar(item.absent)}</td><td className="p-2">{ar(item.memorizationSessions)}</td><td className="p-2">{ar(item.reviewSessions)}</td><td className="p-2">{n(item.memorizationPages)}</td><td className="p-2">{n(item.reviewPages)}</td></tr>)}</tbody></table>{metrics.length === 0 && <p className="p-6 text-center text-sm font-bold text-grape-400">لا توجد بيانات فعلية لهذه الفترة.</p>}</section>}
    {selectedAnalysis && <section className="rounded-3xl border border-grape-200 bg-white p-5"><h3 className="font-display text-lg font-extrabold text-ink">ملخص الطالب الحالي</h3><p className="mt-2 text-sm font-bold leading-7 text-grape-600">الحضور هذا الأسبوع: {ar(selectedAnalysis.attendanceDays)} · الغياب: {ar(selectedAnalysis.absenceDays)} · مجموع صفحات الحفظ تاريخيًا: {n(selectedAnalysis.cumulativeMemorizationPages)} · مجموع صفحات المراجعة تاريخيًا: {n(selectedAnalysis.cumulativeReviewPages)}</p></section>}
  </div>;
}
