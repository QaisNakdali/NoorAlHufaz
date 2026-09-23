/* إحصائيات موحّدة: الحضور مستقل عن تقييم الحفظ والمراجعة */
import { useMemo, useState } from "react";
import { useApp } from "../appState";
import { analyzeAttendance, analyzeStudent, buildRegisterInsight, type AttendanceAnalysis, type RegisterInsight } from "../analytics";
import { ar, type Student } from "../core";
import Avatar from "./Avatar";
import { Icon, SectionHead } from "./ui";

type StudentStats = { student: Student; attendance: AttendanceAnalysis; insight: RegisterInsight; weeklyMemorization: number; weeklyReview: number; cumulativeMemorization: number; cumulativeReview: number };
const pages = (value: number): string => ar(Number(value.toFixed(2)));
const trendText = (trend: RegisterInsight["memorization"]["trend"]): string => trend === "improving" ? "يتحسن" : trend === "declining" ? "يتراجع" : trend === "stable" ? "ثابت" : "بيانات غير كافية";

function MetricCard({ icon, label, value, note, tone = "grape" }: { icon: string; label: string; value: string; note?: string; tone?: "grape" | "mint" | "coral" | "gold" }) {
  const colors = { grape: "border-grape-200 bg-white text-grape-600", mint: "border-mint-300 bg-mint-50 text-mint-700", coral: "border-coral-300 bg-coral-50 text-coral-600", gold: "border-gold-300 bg-gold-50 text-gold-700" } as const;
  return <div className={`rounded-2xl border-2 p-4 ${colors[tone]}`}><div className="mb-2 flex items-center gap-2 text-sm font-extrabold"><Icon name={icon} className="h-5 w-5" />{label}</div><p className="font-display text-3xl font-extrabold text-ink">{value}</p>{note && <p className="mt-1 text-xs font-bold opacity-75">{note}</p>}</div>;
}

function AttendanceSection({ stats }: { stats: StudentStats[] }) {
  const present = stats.reduce((sum, item) => sum + item.attendance.presentDays, 0);
  const absent = stats.reduce((sum, item) => sum + item.attendance.absentDays, 0);
  const recorded = present + absent;
  const rate = recorded ? (present / recorded) * 100 : 0;
  const absentees = stats.filter((item) => item.attendance.absentDays > 0).sort((a, b) => b.attendance.absentDays - a.attendance.absentDays);
  return <section className="rounded-3xl border border-grape-200 bg-white p-5 shadow-[0_18px_45px_-34px_rgba(55,32,120,.35)]">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-display text-xl font-extrabold text-ink">الحضور والغياب</h3><p className="mt-1 text-xs font-bold text-grape-500">الغياب الصريح فقط؛ الأيام غير المسجلة لا تُحسب غيابًا ولا بيانات ناقصة.</p></div><span className="rounded-full bg-mint-100 px-3 py-1.5 text-sm font-extrabold text-mint-700">نسبة الحضور {ar(rate.toFixed(1))}٪</span></div>
    <div className="grid gap-3 sm:grid-cols-3"><MetricCard icon="check" label="أيام الحضور" value={ar(present)} tone="mint" /><MetricCard icon="alert" label="أيام الغياب" value={ar(absent)} tone={absent ? "coral" : "grape"} /><MetricCard icon="calendar" label="الأيام المسجلة" value={ar(recorded)} note="حضور + غياب صريح" /></div>
    {absentees.length > 0 && <div className="mt-4 grid gap-2 md:grid-cols-2">{absentees.map(({ student, attendance }) => <div key={student.id} className="flex items-center gap-3 rounded-2xl border border-coral-100 bg-coral-50/60 p-3"><Avatar photo={student.photo} name={student.name} size={42} /><div className="min-w-0"><p className="truncate font-display font-extrabold text-ink">{student.name}</p><p className="text-xs font-bold text-coral-600">{attendance.explanation}</p></div></div>)}</div>}
  </section>;
}

function LearningSection({ title, kind, stats }: { title: string; kind: "memorization" | "review"; stats: StudentStats[] }) {
  const weekly = stats.reduce((sum, item) => sum + (kind === "memorization" ? item.weeklyMemorization : item.weeklyReview), 0);
  const cumulative = stats.reduce((sum, item) => sum + (kind === "memorization" ? item.cumulativeMemorization : item.cumulativeReview), 0);
  const improving = stats.filter((item) => item.insight[kind].trend === "improving").length;
  const declining = stats.filter((item) => item.insight[kind].trend === "declining").length;
  return <section className="rounded-3xl border border-grape-200 bg-white p-5 shadow-[0_18px_45px_-34px_rgba(55,32,120,.35)]">
    <div className="mb-4"><h3 className="font-display text-xl font-extrabold text-ink">{title}</h3><p className="mt-1 text-xs font-bold text-grape-500">يُقاس من أيام الأداء المتاحة فقط، وتُستبعد أيام الغياب من المقام.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MetricCard icon={kind === "memorization" ? "book" : "refresh"} label="هذا الأسبوع" value={`${pages(weekly)} صفحة`} /><MetricCard icon="chart" label="الإجمالي التراكمي" value={`${pages(cumulative)} صفحة`} /><MetricCard icon="trendingUp" label="طلاب تحسنوا" value={ar(improving)} tone="mint" /><MetricCard icon="trendingDown" label="طلاب تراجعوا" value={ar(declining)} tone={declining ? "coral" : "grape"} /></div>
    <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="border-b border-grape-100 text-right text-xs font-extrabold text-grape-500"><th className="p-2">الطالب</th><th className="p-2">أيام التقييم</th><th className="p-2">الصفحات</th><th className="p-2">الاتجاه</th><th className="p-2">الحالة</th></tr></thead><tbody>{stats.map(({ student, insight }) => { const item = insight[kind]; return <tr key={student.id} className="border-b border-grape-50"><td className="p-2 font-extrabold text-ink">{student.name}</td><td className="p-2">{ar(item.completedDays)} / {ar(item.expectedDays ?? 0)}</td><td className="p-2">{pages(item.currentPages)}</td><td className="p-2">{trendText(item.trend)}</td><td className="p-2 font-bold text-grape-600">{item.label}</td></tr>; })}</tbody></table></div>
  </section>;
}

function StudentAnalysisList({ stats }: { stats: StudentStats[] }) {
  const ordered = [...stats].sort((a, b) => Number(b.attendance.frequentAbsence) - Number(a.attendance.frequentAbsence) || Number(b.insight.memorization.trend === "declining") - Number(a.insight.memorization.trend === "declining"));
  return <section className="rounded-3xl border border-grape-200 bg-white p-5 shadow-[0_18px_45px_-34px_rgba(55,32,120,.35)]"><div className="mb-4"><h3 className="font-display text-xl font-extrabold text-ink">تحليل الطلاب وتوصيات المعلم</h3><p className="mt-1 text-xs font-bold text-grape-500">الحضور والحفظ والمراجعة مسارات مستقلة، وتُدمج فقط في التوصية النهائية.</p></div><div className="grid gap-3 lg:grid-cols-2">{ordered.map(({ student, attendance, insight }) => <article key={student.id} className="rounded-2xl border border-grape-100 bg-grape-50/35 p-4"><div className="flex items-center gap-3"><Avatar photo={student.photo} name={student.name} size={46} /><div><h4 className="font-display text-lg font-extrabold text-ink">{student.name}</h4><p className="text-xs font-bold text-grape-500">الحضور: {attendance.attendanceRate === null ? "غير مسجل" : `${ar(attendance.attendanceRate)}٪`} · الغياب: {ar(attendance.absentDays)}</p></div></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><p className="rounded-xl bg-white p-2 text-xs font-bold text-grape-700"><span className="text-grape-400">الحفظ:</span> {insight.memorization.explanation}</p><p className="rounded-xl bg-white p-2 text-xs font-bold text-amber-700"><span className="text-amber-500">المراجعة:</span> {insight.review.explanation}</p></div><p className="mt-3 rounded-xl bg-grape-600/8 p-3 text-xs font-extrabold leading-5 text-grape-700">💡 {insight.advice}</p></article>)}</div></section>;
}

export default function StatisticsPage() {
  const { students, weeksLog, halaqas } = useApp();
  const [halaqaId, setHalaqaId] = useState("all");
  const visibleStudents = useMemo(() => halaqaId === "all" ? students : students.filter((student) => (student.halaqaId ?? "none") === halaqaId), [students, halaqaId]);
  const stats = useMemo<StudentStats[]>(() => visibleStudents.map((student) => { const overall = analyzeStudent(student, weeksLog); return { student, attendance: analyzeAttendance(student, weeksLog), insight: buildRegisterInsight(student, weeksLog), weeklyMemorization: overall.memorization.pages, weeklyReview: overall.review.pages, cumulativeMemorization: overall.cumulativeMemorizationPages, cumulativeReview: overall.cumulativeReviewPages }; }), [visibleStudents, weeksLog]);
  const presentStudents = stats.filter((item) => item.attendance.presentDays > 0).length;
  const absentStudents = stats.filter((item) => item.attendance.absentDays > 0).length;
  const improvedStudents = stats.filter((item) => item.insight.memorization.trend === "improving" || item.insight.review.trend === "improving").length;
  const declinedStudents = stats.filter((item) => item.insight.memorization.trend === "declining" || item.insight.review.trend === "declining").length;
  return <div className="space-y-6"><SectionHead title="إحصائيات وتحليل الطلاب" desc="ملخص واضح يفصل الحضور عن أداء الحفظ والمراجعة — الفترة الحالية مع الاستفادة من الأرشيف الكامل" icon="chart" />
    <div className="flex flex-wrap gap-2 rounded-2xl border border-grape-200 bg-white p-3"><button onClick={() => setHalaqaId("all")} className={`rounded-xl px-3 py-2 text-xs font-extrabold ${halaqaId === "all" ? "bg-grape-600 text-white" : "bg-grape-50 text-grape-600"}`}>جميع الحلقات</button>{halaqas.map((halaqa) => <button key={halaqa.id} onClick={() => setHalaqaId(halaqa.id)} className={`rounded-xl px-3 py-2 text-xs font-extrabold ${halaqaId === halaqa.id ? "bg-grape-600 text-white" : "bg-grape-50 text-grape-600"}`}>{halaqa.name}</button>)}<button onClick={() => setHalaqaId("none")} className={`rounded-xl px-3 py-2 text-xs font-extrabold ${halaqaId === "none" ? "bg-grape-600 text-white" : "bg-grape-50 text-grape-600"}`}>بلا حلقة</button></div>
    <section><h3 className="mb-3 font-display text-xl font-extrabold text-ink">الملخص العام</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MetricCard icon="users" label="عدد الطلاب" value={ar(stats.length)} /><MetricCard icon="check" label="حضروا هذا الأسبوع" value={ar(presentStudents)} tone="mint" /><MetricCard icon="alert" label="لديهم غياب مسجل" value={ar(absentStudents)} tone={absentStudents ? "coral" : "grape"} /><MetricCard icon="trendingUp" label="تحسنوا" value={ar(improvedStudents)} tone="mint" /><MetricCard icon="trendingDown" label="انخفض أداؤهم" value={ar(declinedStudents)} tone={declinedStudents ? "coral" : "grape"} /><MetricCard icon="book" label="صفحات الحفظ" value={pages(stats.reduce((sum, item) => sum + item.weeklyMemorization, 0))} /><MetricCard icon="refresh" label="صفحات المراجعة" value={pages(stats.reduce((sum, item) => sum + item.weeklyReview, 0))} /></div></section>
    <AttendanceSection stats={stats} /><LearningSection title="إحصائيات الحفظ" kind="memorization" stats={stats} /><LearningSection title="إحصائيات المراجعة" kind="review" stats={stats} /><StudentAnalysisList stats={stats} />
  </div>;
}
