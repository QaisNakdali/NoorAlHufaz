import { DAYS, estimatedLinesFromVerses, type Student, type WeekLog } from "./core";

export type WorkMeasure = {
  sessions: number;
  verses: number;
  lines: number;
  pages: number;
  pagesEstimated: boolean;
  averagePagesPerDay: number;
};

export type StudentAnalysis = {
  attendanceDays: number;
  absenceDays: number;
  recitationSessions: number;
  memorization: WorkMeasure;
  review: WorkMeasure;
  previousPages: number | null;
  changePercent: number | null;
  suggestedMinPages: number;
  suggestedMaxPages: number;
  recommendations: string[];
};

const round = (n: number, digits = 1) => Number(n.toFixed(digits));

function measure(student: Student, kind: "memorization" | "review"): WorkMeasure {
  const part = kind === "memorization" ? "h" : "r";
  const completed = DAYS.filter((d) => student.days[d.key][part]);
  const verses = completed.reduce((sum, d) => sum + (kind === "memorization" ? student.ward[d.key].memorizationVerses : student.ward[d.key].reviewVerses), 0);
  const enteredLines = completed.reduce((sum, d) => sum + (kind === "memorization" ? student.ward[d.key].memorizationLines : student.ward[d.key].reviewLines), 0);
  const pagesEstimated = enteredLines <= 0 && verses > 0;
  const lines = enteredLines > 0 ? enteredLines : estimatedLinesFromVerses(verses);
  const pages = lines / 15;
  return {
    sessions: completed.length,
    verses,
    lines: round(lines, 1),
    pages: round(pages, 2),
    pagesEstimated,
    averagePagesPerDay: completed.length ? round(pages / completed.length, 2) : 0,
  };
}

export function analyzeStudent(student: Student, weeksLog: WeekLog[]): StudentAnalysis {
  const attendanceDays = DAYS.filter((d) => student.days[d.key].a).length;
  const absenceDays = DAYS.length - attendanceDays;
  const memorization = measure(student, "memorization");
  const review = measure(student, "review");
  const recitationSessions = memorization.sessions + review.sessions;
  const previous = weeksLog.find((w) => w.top.some((e) => e.id === student.id))?.top.find((e) => e.id === student.id);
  const previousPages = previous ? round(((previous.memorizationLines ?? 0) + (previous.reviewLines ?? 0)) / 15, 2) : null;
  const currentPages = memorization.pages + review.pages;
  const changePercent = previousPages && previousPages > 0 ? round(((currentPages - previousPages) / previousPages) * 100, 0) : null;
  const base = memorization.averagePagesPerDay;
  const suggestedMinPages = round(Math.max(0.25, base * 0.8), 2);
  const suggestedMaxPages = round(Math.max(0.5, base * 1.05), 2);
  const recommendations: string[] = [];

  if (absenceDays >= 2) recommendations.push("الغياب مؤثر على القياس هذا الأسبوع؛ راعِ انتظام الحضور قبل زيادة الورد.");
  if (memorization.pages >= 1 && review.pages < memorization.pages * 0.5) recommendations.push("الحفظ جيد، لكن مقدار المراجعة أقل من نصفه؛ يُفضّل تقوية المراجعة قبل زيادة الجديد.");
  if (changePercent !== null && changePercent <= -20) recommendations.push(`الأداء انخفض ${Math.abs(changePercent)}٪ عن آخر أسبوع محفوظ؛ راجع سبب الانخفاض مع الطالب.`);
  if (changePercent !== null && changePercent >= 15 && review.sessions >= 2) recommendations.push("التقدم واضح مع وجود مراجعة منتظمة؛ يمكن زيادة الورد قليلًا مع متابعة الثبات.");
  if (memorization.averagePagesPerDay >= 1.5 && review.sessions < memorization.sessions) recommendations.push("الطالب قادر على حفظ كمية كبيرة، لكن يلزم التأكد من ثباتها بالمراجعة قبل رفع المقدار.");
  if (recommendations.length === 0 && recitationSessions > 0) recommendations.push("الأداء مستقر حاليًا؛ حافظ على المقدار نفسه أسبوعًا آخر قبل اتخاذ قرار بالزيادة.");
  if (recitationSessions === 0) recommendations.push("لا توجد جلسات تسميع مكتملة كافية لبناء توصية موثوقة هذا الأسبوع.");

  return { attendanceDays, absenceDays, recitationSessions, memorization, review, previousPages, changePercent, suggestedMinPages, suggestedMaxPages, recommendations };
}
