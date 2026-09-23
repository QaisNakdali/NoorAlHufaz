import { DAYS, estimatedLinesFromVerses, type Student, type WeekLog } from "./core";
import { pagesForAyahRange, parseQuranRange } from "./quranPages";

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
  cumulativeMemorizationPages: number;
  cumulativeReviewPages: number;
};

export type LearningTrack = "memorization" | "review";
export type TrackTrend = "excellent" | "improving" | "stable" | "declining" | "needs-attention" | "insufficient-data";
export type TrackAnalysis = {
  trend: TrackTrend;
  label: string;
  currentPages: number;
  weeklyPages: number[];
};

export type RegisterInsight = {
  memorization: TrackAnalysis;
  review: TrackAnalysis;
  advice: string;
};

const round = (n: number, digits = 1) => Number(n.toFixed(digits));

export function measureStudentWork(student: Student, kind: "memorization" | "review"): WorkMeasure {
  const part = kind === "memorization" ? "h" : "r";
  const completed = DAYS.filter((d) => student.days[d.key][part]);
  const verses = completed.reduce((sum, d) => sum + (kind === "memorization" ? student.ward[d.key].memorizationVerses : student.ward[d.key].reviewVerses), 0);
  const enteredLines = completed.reduce((sum, d) => sum + (kind === "memorization" ? student.ward[d.key].memorizationLines : student.ward[d.key].reviewLines), 0);
  let exactPages = 0;
  let hasExactPageData = false;
  for (const d of completed) {
    const ward = student.ward[d.key];
    const text = kind === "memorization" ? ward.memorization : ward.review;
    const from = kind === "memorization" ? ward.memorizationFromVerse : ward.reviewFromVerse;
    const to = kind === "memorization" ? ward.memorizationToVerse : ward.reviewToVerse;
    const parsed = parseQuranRange(text);
    const range = parsed
      ? pagesForAyahRange(parsed.surah, from || parsed.from, to || parsed.to)
      : null;
    if (range) {
      exactPages += range.pages;
      hasExactPageData = true;
    }
  }
  const lines = enteredLines > 0 ? enteredLines : estimatedLinesFromVerses(verses);
  const pagesEstimated = !hasExactPageData;
  const pages = hasExactPageData ? exactPages : lines / 15;
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
  const memorization = measureStudentWork(student, "memorization");
  const review = measureStudentWork(student, "review");
  const recitationSessions = memorization.sessions + review.sessions;
  const history = weeksLog
    .map((w) => (w.students ?? w.top).find((e) => e.id === student.id))
    .filter((e): e is NonNullable<typeof e> => !!e);
  const previous = history[0];
  const previousPages = previous
    ? round((previous.memorizationPages ?? (previous.memorizationLines ?? 0) / 15) + (previous.reviewPages ?? (previous.reviewLines ?? 0) / 15), 2)
    : null;
  const cumulativeMemorizationPages = round(memorization.pages + history.reduce((n, e) => n + (e.memorizationPages ?? (e.memorizationLines ?? 0) / 15), 0), 2);
  const cumulativeReviewPages = round(review.pages + history.reduce((n, e) => n + (e.reviewPages ?? (e.reviewLines ?? 0) / 15), 0), 2);
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

  return { attendanceDays, absenceDays, recitationSessions, memorization, review, previousPages, changePercent, suggestedMinPages, suggestedMaxPages, recommendations, cumulativeMemorizationPages, cumulativeReviewPages };
}

const trackLabel = (kind: LearningTrack, trend: TrackTrend): string => {
  const noun = kind === "memorization" ? "الحفظ" : "المراجعة";
  const suffix: Record<TrackTrend, string> = {
    excellent: "ممتاز",
    improving: "يتحسن",
    stable: "مستقر",
    declining: "يتراجع",
    "needs-attention": "يحتاج متابعة",
    "insufficient-data": "لا توجد بيانات كافية",
  };
  return `${noun} ${suffix[trend]}`;
};

/** يحلل مسارًا واحدًا فقط، ولا يقرأ أي بيانات من المسار الآخر. */
export function analyzeLearningTrack(student: Student, weeksLog: WeekLog[], kind: LearningTrack): TrackAnalysis {
  const current = measureStudentWork(student, kind);
  const field = kind === "memorization" ? "memorizationPages" : "reviewPages";
  const linesField = kind === "memorization" ? "memorizationLines" : "reviewLines";
  const history = [...weeksLog]
    .sort((a, b) => a.week - b.week)
    .map((log) => (log.students ?? log.top).find((entry) => entry.id === student.id))
    .filter((entry): entry is NonNullable<typeof entry> => !!entry)
    .map((entry) => round(entry[field] ?? (entry[linesField] ?? 0) / 15, 2));
  const weeklyPages = [...history, current.pages].slice(-6);
  const activeWeeks = weeklyPages.filter((pages) => pages > 0).length;

  let trend: TrackTrend;
  if (weeklyPages.length < 2) trend = current.sessions === 0 ? "insufficient-data" : "stable";
  else {
    const split = Math.max(1, Math.floor(weeklyPages.length / 2));
    const earlier = weeklyPages.slice(0, split);
    const recent = weeklyPages.slice(split);
    const avg = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    const earlierAverage = avg(earlier);
    const recentAverage = avg(recent);
    const baseline = Math.max(0.25, earlierAverage);
    const change = (recentAverage - earlierAverage) / baseline;
    if (activeWeeks === 0 || (current.sessions === 0 && recentAverage === 0)) trend = "needs-attention";
    else if (change >= 0.2) trend = "improving";
    else if (change <= -0.2) trend = "declining";
    else if (current.pages >= 1.5 && activeWeeks >= Math.min(3, weeklyPages.length)) trend = "excellent";
    else trend = "stable";
  }

  return { trend, label: trackLabel(kind, trend), currentPages: current.pages, weeklyPages };
}

export function buildRegisterInsight(student: Student, weeksLog: WeekLog[]): RegisterInsight {
  const memorization = analyzeLearningTrack(student, weeksLog, "memorization");
  const review = analyzeLearningTrack(student, weeksLog, "review");
  const m = memorization.trend;
  const r = review.trend;
  let advice: string;

  if ((m === "improving" || m === "excellent") && (r === "improving" || r === "excellent")) advice = "الطالب يتقدم في الحفظ والمراجعة معًا بشكل جيد.";
  else if (m === "declining" && r === "declining") advice = "يوجد تراجع في الحفظ والمراجعة مؤخرًا؛ يُفضّل متابعة الطالب ومعرفة السبب.";
  else if ((m === "improving" || m === "excellent") && (r === "declining" || r === "needs-attention")) advice = "الحفظ يتقدم جيدًا، لكن المراجعة غير مستقرة وتحتاج إلى متابعة.";
  else if (m === "stable" && (r === "improving" || r === "excellent")) advice = "الحفظ مستقر، بينما المراجعة تتحسن بشكل ملحوظ.";
  else if (m === "declining" && (r === "stable" || r === "excellent")) advice = "يوجد تراجع في معدل الحفظ، بينما المراجعة مستقرة حاليًا.";
  else if ((m === "declining" || m === "needs-attention") && (r === "improving" || r === "excellent")) advice = "المراجعة جيدة، ويُفضّل متابعة مقدار الحفظ الجديد.";
  else if (m === "insufficient-data" && r === "insufficient-data") advice = "لا توجد بيانات تاريخية كافية بعد؛ استمر في التسجيل لبناء تحليل أدق.";
  else advice = `${memorization.label}، و${review.label}؛ حافظ على المتابعة قبل تغيير مقدار الورد.`;

  return { memorization, review, advice };
}
