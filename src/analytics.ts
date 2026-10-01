import { DAYS, estimatedLinesFromVerses, levelInfo, type DayKey, type ParentContactRecord, type RecitationPart, type Student, type WeekLog, type WeekLogEntry } from "./core";
import { reviewLinesForWard, safeNonNegativeDecimal } from "./learningMetrics";
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

export type AttendanceTrend = "improving" | "stable" | "declining" | "insufficient-data";
export type AttendanceAnalysis = {
  presentDays: number;
  absentDays: number;
  evaluatedDays: number;
  unrecordedDays: number;
  attendanceRate: number | null;
  trend: AttendanceTrend;
  frequentAbsence: boolean;
  explanation: string;
};

export type LearningTrack = "memorization" | "review";
export type TrackTrend = "improving" | "stable" | "declining" | "insufficient-data";
export type RequirementStatus = "meets" | "near" | "below" | "far-below" | "unknown";
export type RatingTransition = "very-good-to-excellent" | "excellent-to-very-good" | null;
export type TrackAnalysis = {
  trend: TrackTrend;
  requirement: RequirementStatus;
  label: string;
  currentPages: number;
  expectedPages: number | null;
  completedDays: number;
  expectedDays: number | null;
  completionRate: number | null;
  quantityRate: number | null;
  consecutiveMisses: number;
  excellentCount: number;
  veryGoodCount: number;
  ratingTransition: RatingTransition;
  explanation: string;
};

export type RegisterInsight = {
  attendance: AttendanceAnalysis;
  memorization: TrackAnalysis;
  review: TrackAnalysis;
  advice: string;
};

const round = (n: number, digits = 1) => Number(n.toFixed(digits));

const trackPart = (kind: LearningTrack): RecitationPart => kind === "memorization" ? "h" : "r";

const hasPlannedWork = (student: Student, day: DayKey, kind: LearningTrack): boolean => {
  const ward = student.ward?.[day];
  if (!ward) return false;
  const mem = typeof ward.memorization === "string" ? ward.memorization.trim() : "";
  const rev = typeof ward.review === "string" ? ward.review.trim() : "";
  const memV = Number(ward.memorizationVerses) || 0;
  const memL = Number(ward.memorizationLines) || 0;
  const revV = Number(ward.reviewVerses) || 0;
  const revL = reviewLinesForWard(ward);
  const revP = safeNonNegativeDecimal(ward.reviewPages) ?? 0;
  return kind === "memorization"
    ? (mem.length > 0 || memV > 0 || memL > 0)
    : (rev.length > 0 || revV > 0 || revL > 0 || revP > 0);
};

export function pagesForWardDay(student: Student, day: DayKey, kind: LearningTrack): { pages: number; estimated: boolean } {
  const ward = student.ward?.[day];
  if (!ward) return { pages: 0, estimated: true };
  const text = (kind === "memorization" ? ward.memorization : ward.review) ?? "";
  const from = kind === "memorization" ? ward.memorizationFromVerse : ward.reviewFromVerse;
  const to = kind === "memorization" ? ward.memorizationToVerse : ward.reviewToVerse;
  const lines = Number(kind === "memorization" ? ward.memorizationLines : ward.reviewLines) || 0;
  const verses = Number(kind === "memorization" ? ward.memorizationVerses : ward.reviewVerses) || 0;
  if (kind === "review") {
    const explicitPages = safeNonNegativeDecimal(ward.reviewPages);
    if (explicitPages !== undefined) return { pages: explicitPages, estimated: false };
  }
  const parsed = text ? parseQuranRange(text) : null;
  const exact = parsed ? pagesForAyahRange(parsed.surah, from || parsed.from, to || parsed.to) : null;
  if (exact) return { pages: exact.pages, estimated: false };
  if (lines > 0) return { pages: lines / 15, estimated: true };
  if (verses > 0) return { pages: estimatedLinesFromVerses(verses) / 15, estimated: true };
  return { pages: 0, estimated: true };
}

export function measureStudentWork(student: Student, kind: "memorization" | "review"): WorkMeasure {
  const part = kind === "memorization" ? "h" : "r";
  const completed = DAYS.filter((d) => {
    const entry = student.days?.[d.key];
    if (!entry || entry.absent || !entry.a) return false;
    const hasRating = student.recitationRatings?.[d.key]?.[part] === "excellent" || student.recitationRatings?.[d.key]?.[part] === "very-good";
    return Boolean(entry[part] || hasRating);
  });
  const verses = completed.reduce((sum, d) => sum + Number((kind === "memorization" ? student.ward?.[d.key]?.memorizationVerses : student.ward?.[d.key]?.reviewVerses) || 0), 0);
  const enteredLines = completed.reduce((sum, d) => {
    const ward = student.ward?.[d.key];
    return sum + (kind === "memorization" ? Number(ward?.memorizationLines) || 0 : reviewLinesForWard(ward));
  }, 0);
  const pageMeasures = completed.map((d) => pagesForWardDay(student, d.key, kind));
  const lines = enteredLines > 0 ? enteredLines : estimatedLinesFromVerses(verses);
  const pagesEstimated = pageMeasures.some((measure) => measure.estimated);
  const pages = pageMeasures.reduce((sum, measure) => sum + measure.pages, 0);
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
  const attendanceDays = DAYS.filter((d) => !!student.days?.[d.key]?.a && !student.days?.[d.key]?.absent).length;
  const absenceDays = DAYS.filter((d) => student.days?.[d.key]?.absent === true).length;
  const memorization = measureStudentWork(student, "memorization");
  const review = measureStudentWork(student, "review");
  const recitationSessions = memorization.sessions + review.sessions;
  const normTarget = student.name
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim()
    .toLowerCase();

  const history = weeksLog
    .map((w) => {
      const record = w.records?.find((r) => r.id === student.id || r.name.replace(/[ًٌٍَُِّْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").trim().toLowerCase() === normTarget);
      const entry = (w.students ?? w.top).find((e) => e.id === student.id || e.name.replace(/[ًٌٍَُِّْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").trim().toLowerCase() === normTarget);
      if (record || entry) {
        const memRecord = record ? measureStudentWork(record as unknown as Student, "memorization") : null;
        const revRecord = record ? measureStudentWork(record as unknown as Student, "review") : null;
        const entryMemPages = entry?.memorizationPages ?? ((entry?.memorizationLines ?? 0) / 15);
        const entryRevPages = entry?.reviewPages ?? ((entry?.reviewLines ?? 0) / 15);
        return {
          id: record?.id ?? entry?.id ?? student.id,
          name: record?.name ?? entry?.name ?? student.name,
          memorizationPages: Math.max(memRecord?.pages ?? 0, entryMemPages || 0),
          reviewPages: Math.max(revRecord?.pages ?? 0, entryRevPages || 0),
          memorizationLines: Math.max(memRecord?.lines ?? 0, entry?.memorizationLines ?? 0),
          reviewLines: Math.max(revRecord?.lines ?? 0, entry?.reviewLines ?? 0),
        };
      }
      return null;
    })
    .filter((e): e is NonNullable<typeof e> => !!e);
  const previous = history[0];
  const previousPages = previous
    ? round((previous.memorizationPages ?? (previous.memorizationLines ?? 0) / 15) + (previous.reviewPages ?? (previous.reviewLines ?? 0) / 15), 2)
    : null;
  const cumulativeMemorizationPages = round(memorization.pages + history.reduce((n, e) => n + (e.memorizationPages ?? (e.memorizationLines ?? 0) / 15), 0), 2);
  const cumulativeReviewPages = round(review.pages + history.reduce((n, e) => n + (e.reviewPages ?? (e.reviewLines ?? 0) / 15), 0), 2);
  const currentPages = memorization.pages + review.pages;
  const changePercent = previousPages && previousPages > 0 ? round(((currentPages - previousPages) / previousPages) * 100, 0) : null;
  const base = student.isTesting ? 0 : memorization.averagePagesPerDay;
  const suggestedMinPages = round(Math.max(0.25, base * 0.8), 2);
  const suggestedMaxPages = round(Math.max(0.5, base * 1.05), 2);
  const recommendations: string[] = [];

  if (student.isTesting) recommendations.push("الطالب في فترة اختبار؛ تُقرأ الكمية الحالية كمؤشر على ثبات المحفوظ وجودة الاسترجاع، ولا تُستخدم لتقدير قدرته اليومية على الحفظ الجديد.");
  if (absenceDays >= 2) recommendations.push(`لدى الطالب ${absenceDays} أيام غياب مسجلة هذا الأسبوع؛ تابع انتظام الحضور دون احتسابها ضعفًا في الحفظ أو المراجعة.`);
  if (memorization.pages >= 1 && review.pages < memorization.pages * 0.5) recommendations.push("الحفظ جيد، لكن مقدار المراجعة أقل من نصفه؛ يُفضّل تقوية المراجعة قبل زيادة الجديد.");
  if (!student.isTesting && history.length >= 2 && changePercent !== null && changePercent <= -20) recommendations.push(`الأداء انخفض ${Math.abs(changePercent)}٪ عن آخر أسبوع محفوظ؛ راجع سبب الانخفاض مع الطالب.`);
  if (changePercent !== null && changePercent >= 15 && review.sessions >= 2) recommendations.push("التقدم واضح مع وجود مراجعة منتظمة؛ يمكن زيادة الورد قليلًا مع متابعة الثبات.");
  if (!student.isTesting && history.length >= 2 && memorization.averagePagesPerDay >= 1.5 && review.sessions < memorization.sessions) recommendations.push("كمية الحفظ الجديد مرتفعة عبر أكثر من أسبوع، لكن يلزم التأكد من ثباتها بالمراجعة قبل رفع المقدار.");
  if (recommendations.length === 0 && recitationSessions > 0) recommendations.push("الأداء مستقر حاليًا؛ حافظ على المقدار نفسه أسبوعًا آخر قبل اتخاذ قرار بالزيادة.");
  if (recitationSessions === 0) recommendations.push("لا توجد جلسات تسميع مكتملة كافية لبناء توصية موثوقة هذا الأسبوع.");

  return { attendanceDays, absenceDays, recitationSessions, memorization, review, previousPages, changePercent, suggestedMinPages, suggestedMaxPages, recommendations, cumulativeMemorizationPages, cumulativeReviewPages };
}

type TrackSnapshot = {
  pages: number;
  completedDays: number;
  expectedDays: number | null;
  expectedPages: number | null;
  excellent: number;
  veryGood: number;
};

export function buildTrackSnapshot(student: Student, kind: LearningTrack): TrackSnapshot {
  const part = trackPart(kind);
  const evaluableDays = DAYS.filter((day) => {
    const entry = student.days?.[day.key];
    return !!entry && entry.absent !== true && (entry.a || entry.h || entry.r);
  });
  const plannedDays = evaluableDays.filter((day) => hasPlannedWork(student, day.key, kind));
  const completedDays = evaluableDays.filter((day) => !!student.days?.[day.key]?.[part]).length;
  const expectedPagesValue = plannedDays.reduce((sum, day) => sum + pagesForWardDay(student, day.key, kind).pages, 0);
  let excellent = 0;
  let veryGood = 0;
  for (const day of plannedDays) {
    if (!student.days?.[day.key]?.[part]) continue;
    const rating = student.recitationRatings?.[day.key]?.[part];
    if (rating === "excellent") excellent += 1;
    if (rating === "very-good") veryGood += 1;
  }
  return {
    pages: measureStudentWork(student, kind).pages,
    completedDays,
    expectedDays: evaluableDays.length,
    expectedPages: expectedPagesValue > 0 ? round(expectedPagesValue, 2) : null,
    excellent,
    veryGood,
  };
}

function historySnapshot(entry: WeekLogEntry, kind: LearningTrack): TrackSnapshot {
  const prefix = kind === "memorization" ? "memorization" : "review";
  return {
    pages: entry[`${prefix}Pages` as "memorizationPages" | "reviewPages"] ?? round((entry[`${prefix}Lines` as "memorizationLines" | "reviewLines"] ?? 0) / 15, 2),
    completedDays: entry[`${prefix}Days` as "memorizationDays" | "reviewDays"] ?? 0,
    expectedDays: entry[`${prefix}ExpectedDays` as "memorizationExpectedDays" | "reviewExpectedDays"] ?? null,
    expectedPages: entry[`${prefix}ExpectedPages` as "memorizationExpectedPages" | "reviewExpectedPages"] ?? null,
    excellent: entry[`${prefix}Excellent` as "memorizationExcellent" | "reviewExcellent"] ?? 0,
    veryGood: entry[`${prefix}VeryGood` as "memorizationVeryGood" | "reviewVeryGood"] ?? 0,
  };
}

const ratio = (actual: number, expected: number | null): number | null => expected && expected > 0 ? actual / expected : null;

function requirementFrom(dayRate: number | null, quantityRate: number | null): RequirementStatus {
  const rates = [dayRate, quantityRate].filter((value): value is number => value !== null);
  if (!rates.length) return "unknown";
  const result = Math.min(...rates);
  if (result >= 0.95) return "meets";
  if (result >= 0.75) return "near";
  if (result >= 0.5) return "below";
  return "far-below";
}

const average = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

function detectTrend(history: TrackSnapshot[], current: TrackSnapshot): TrackTrend {
  // كامل المسيرة يبني خط الأساس، بينما آخر أسبوعين مع الحالي يمثلون الأداء القريب.
  const series = [...history, current];
  const comparable = series
    .map((snapshot) => {
      const dayRate = ratio(snapshot.completedDays, snapshot.expectedDays);
      const quantityRate = ratio(snapshot.pages, snapshot.expectedPages);
      const rates = [dayRate, quantityRate].filter((value): value is number => value !== null);
      return rates.length ? average(rates) : null;
    })
    .filter((value): value is number => value !== null);

  const ratingSeries = series
    .filter((snapshot) => snapshot.excellent + snapshot.veryGood > 0)
    .map((snapshot) => (snapshot.excellent * 2 + snapshot.veryGood) / (snapshot.excellent + snapshot.veryGood));
  const legacyPages = history.map((snapshot) => snapshot.pages);
  legacyPages.push(current.pages);
  const hasBroadComparableHistory = comparable.length >= Math.max(2, Math.ceil(series.length * 0.6));
  const source = hasBroadComparableHistory ? comparable : legacyPages.length >= 2 ? legacyPages : ratingSeries.length >= 2 ? ratingSeries : [];
  if (source.length < 2) return "insufficient-data";
  const recentSize = Math.min(3, Math.max(1, Math.ceil(source.length / 3)));
  const historical = source.slice(0, -recentSize);
  const recentValues = source.slice(-recentSize);
  const before = average(historical.length ? historical : source.slice(0, -1));
  const recent = average(recentValues);
  const change = recent - before;
  const threshold = hasBroadComparableHistory ? 0.12 : 0.25;
  if (change >= threshold) return "improving";
  if (change <= -threshold) return "declining";
  return "stable";
}

function detectRatingTransition(student: Student, kind: LearningTrack): RatingTransition {
  const part = trackPart(kind);
  const ratings = DAYS
    .filter((day) => !student.days[day.key].absent && student.days[day.key][part])
    .map((day) => student.recitationRatings?.[day.key]?.[part])
    .filter((rating): rating is "excellent" | "very-good" => !!rating);
  if (ratings.length < 2) return null;
  const split = Math.max(1, Math.floor(ratings.length / 2));
  const score = (values: ("excellent" | "very-good")[]) => average(values.map((value) => value === "excellent" ? 2 : 1));
  const before = score(ratings.slice(0, split));
  const recent = score(ratings.slice(split));
  if (recent - before >= 0.5) return "very-good-to-excellent";
  if (before - recent >= 0.5) return "excellent-to-very-good";
  return null;
}

function consecutiveMisses(student: Student, kind: LearningTrack): number {
  const part = trackPart(kind);
  let current = 0;
  let longest = 0;
  for (const day of DAYS) {
    const entry = student.days[day.key];
    if (entry.absent || (!entry.a && !entry.h && !entry.r)) continue;
    if (student.days[day.key][part]) current = 0;
    else {
      current += 1;
      longest = Math.max(longest, current);
    }
  }
  return longest;
}

/** مصدر موحّد للحضور: الغياب الصريح فقط، واليوم غير المحدد يبقى «غير مسجل». */
export function analyzeAttendance(student: Student, weeksLog: WeekLog[]): AttendanceAnalysis {
  const presentDays = DAYS.filter((day) => !!student.days[day.key]?.a && !student.days[day.key]?.absent).length;
  const absentDays = DAYS.filter((day) => student.days[day.key].absent === true).length;
  const evaluatedDays = presentDays + absentDays;
  const attendanceRate = evaluatedDays > 0 ? round((presentDays / evaluatedDays) * 100, 1) : null;
  const historicRates = [...weeksLog]
    .sort((a, b) => a.week - b.week)
    .map((log) => (log.students ?? log.top).find((entry) => entry.id === student.id))
    .filter((entry): entry is WeekLogEntry => !!entry && entry.absenceDays !== undefined)
    .map((entry) => {
      const total = entry.evaluatedDays ?? ((entry.attendanceDays ?? 0) + (entry.absenceDays ?? 0));
      return total > 0 ? (entry.attendanceDays ?? 0) / total : null;
    })
    .filter((value): value is number => value !== null);
  const currentRate = attendanceRate === null ? null : attendanceRate / 100;
  const trendSource = currentRate === null ? historicRates : [...historicRates, currentRate];
  let trend: AttendanceTrend = "insufficient-data";
  if (trendSource.length >= 2) {
    const recentSize = Math.min(2, Math.max(1, Math.ceil(trendSource.length / 3)));
    const historical = trendSource.slice(0, -recentSize);
    const recent = trendSource.slice(-recentSize);
    const change = average(recent) - average(historical.length ? historical : trendSource.slice(0, -1));
    trend = change >= 0.15 ? "improving" : change <= -0.15 ? "declining" : "stable";
  }
  const frequentAbsence = absentDays >= 2 || historicRates.filter((rate) => rate <= 0.5).length >= 2;
  let explanation = evaluatedDays === 0
    ? "لم تُسجّل حالة الحضور أو الغياب لهذا الأسبوع بعد."
    : absentDays === 0
      ? `الحضور ${presentDays} من ${evaluatedDays} أيام مسجلة، ولا يوجد غياب صريح هذا الأسبوع.`
      : `الحضور ${presentDays} أيام والغياب ${absentDays} أيام من أصل ${evaluatedDays} أيام مسجلة.`;
  if (trend === "declining") explanation += " ارتفع الغياب مؤخرًا مقارنة بالفترة السابقة.";
  else if (trend === "improving") explanation += " تحسن الانتظام مؤخرًا مقارنة بالفترة السابقة.";
  else if (frequentAbsence) explanation += " يظهر نمط غياب متكرر ويستحسن متابعة الانتظام.";
  return { presentDays, absentDays, evaluatedDays, unrecordedDays: Math.max(0, DAYS.length - evaluatedDays), attendanceRate, trend, frequentAbsence, explanation };
}

/** يحلل مسارًا واحدًا فقط، ولا يقرأ أي بيانات من المسار الآخر. */
export function analyzeLearningTrack(student: Student, weeksLog: WeekLog[], kind: LearningTrack): TrackAnalysis {
  const noun = kind === "memorization" ? "الحفظ" : "المراجعة";
  const current = buildTrackSnapshot(student, kind);
  const historyEntries = [...weeksLog]
    .sort((a, b) => a.week - b.week)
    .map((log) => (log.students ?? log.top).find((entry) => entry.id === student.id))
    .filter((entry): entry is NonNullable<typeof entry> => !!entry);
  const history = (kind === "memorization" ? historyEntries.filter((entry) => entry.isTesting !== true) : historyEntries)
    .map((entry) => historySnapshot(entry, kind));
  const completionRate = ratio(current.completedDays, current.expectedDays);
  const quantityRate = ratio(current.pages, current.expectedPages);
  const requirement = requirementFrom(completionRate, quantityRate);
  const ratingTransition = detectRatingTransition(student, kind);
  const limitedHistory = history.length < 2;
  const trend = student.isTesting && kind === "memorization" ? "insufficient-data" : limitedHistory ? "insufficient-data" : ratingTransition === "very-good-to-excellent"
    ? "improving"
    : ratingTransition === "excellent-to-very-good"
      ? "declining"
      : detectTrend(history, current);
  const misses = consecutiveMisses(student, kind);
  const dayEvidence = current.expectedDays
    ? `${current.completedDays} من ${current.expectedDays} أيام مطلوبة`
    : "عدد الأيام المطلوبة غير محدد في خطة الورد";
  const requirementText: Record<RequirementStatus, string> = {
    meets: "يحقق المطلوب",
    near: "قريب من المطلوب",
    below: "أقل من المطلوب",
    "far-below": "بعيد عن المطلوب",
    unknown: "المطلوب غير محدد",
  };
  const trendText: Record<TrackTrend, string> = {
    improving: "ويتحسن مقارنة بالفترة السابقة",
    stable: requirement === "meets" ? "ومستقر على مستوى جيد" : "بنمط متقارب دون بلوغ المطلوب",
    declining: "ويتراجع مقارنة بالمستوى السابق",
    "insufficient-data": "ولا توجد بيانات تاريخية كافية لتحديد الاتجاه",
  };
  const quality = current.completedDays > 0 && current.excellent === current.completedDays
    ? "ممتاز"
    : current.completedDays > 0 && current.veryGood === current.completedDays
      ? "جيد جدًا"
      : null;
  const label = requirement === "meets" && quality ? `${noun} ${quality} ويحقق المطلوب` : `${noun} ${requirementText[requirement]}`;
  const transitionText = ratingTransition === "very-good-to-excellent"
    ? "؛ ارتفع التقييم مؤخرًا من جيد جدًا إلى ممتاز"
    : ratingTransition === "excellent-to-very-good"
      ? "؛ انخفض التقييم مؤخرًا من ممتاز إلى جيد جدًا"
      : "";
  const testText = student.isTesting && kind === "memorization" ? "؛ الطالب في فترة اختبار، لذلك لا تُستخدم كمية التسميع الحالية للحكم على قدرة الحفظ الجديد" : "";
  const newStudentText = limitedHistory && !student.isTesting ? "؛ لا توجد أسابيع تاريخية كافية للحكم على تحسن أو تراجع الطالب" : "";
  const explanation = `${noun} ${requirementText[requirement]} (${dayEvidence}) ${trendText[trend]}${transitionText}${testText}${newStudentText}${misses >= 2 ? `؛ توجد ${misses} أيام متتالية دون إنجاز` : ""}.`;

  return {
    trend,
    requirement,
    label,
    currentPages: current.pages,
    expectedPages: current.expectedPages,
    completedDays: current.completedDays,
    expectedDays: current.expectedDays,
    completionRate,
    quantityRate,
    consecutiveMisses: misses,
    excellentCount: current.excellent,
    veryGoodCount: current.veryGood,
    ratingTransition,
    explanation,
  };
}

export function buildRegisterInsight(student: Student, weeksLog: WeekLog[]): RegisterInsight {
  const attendance = analyzeAttendance(student, weeksLog);
  const memorization = analyzeLearningTrack(student, weeksLog, "memorization");
  const review = analyzeLearningTrack(student, weeksLog, "review");
  const m = memorization;
  const r = review;
  let advice: string;

  if (student.isTesting) advice = `الطالب في فترة اختبار؛ ${m.completedDays > 0 ? "بيانات التسميع الحالية تقيس ثبات المحفوظ ولا تحدد قدرته الطبيعية على الحفظ الجديد" : "لم تُسجّل جلسات اختبار مكتملة بعد"}. ${r.explanation}`;
  else if (m.ratingTransition === "very-good-to-excellent" && r.requirement === "meets") advice = "الحفظ في تحسن واضح من جيد جدًا إلى ممتاز، والمراجعة تحقق المطلوب.";
  else if (r.ratingTransition === "very-good-to-excellent" && m.requirement === "meets") advice = "المراجعة في تحسن واضح من جيد جدًا إلى ممتاز، والحفظ يحقق المطلوب.";
  else if (m.ratingTransition === "excellent-to-very-good") advice = "تراجع تقييم الحفظ مؤخرًا من ممتاز إلى جيد جدًا؛ يُفضّل متابعة السبب خلال الأيام القادمة.";
  else if (r.ratingTransition === "excellent-to-very-good") advice = "تراجع تقييم المراجعة مؤخرًا من ممتاز إلى جيد جدًا؛ يُفضّل متابعة السبب خلال الأيام القادمة.";
  else if (m.trend === "improving" && r.trend === "improving" && m.requirement === "meets" && r.requirement === "meets") advice = "يوجد تحسن واضح ومستمر في الحفظ والمراجعة، وقد وصل الطالب حاليًا إلى تحقيق المطلوب.";
  else if (m.trend === "improving" && r.trend === "improving") advice = `يوجد تحسن واضح في الحفظ والمراجعة، لكن ${m.requirement !== "meets" ? `الحفظ ما زال ${m.completedDays} من ${m.expectedDays ?? 4}` : `المراجعة ما زالت ${r.completedDays} من ${r.expectedDays ?? 4}`} أيام مطلوبة.`;
  else if (m.trend === "improving" && r.trend === "declining") advice = "الحفظ في تحسن، لكن المراجعة تتراجع مقارنة بالمستوى السابق وتحتاج متابعة.";
  else if (m.trend === "declining" && r.trend === "declining") advice = "يوجد تراجع في الحفظ والمراجعة؛ يُفضّل متابعة الطالب ومعرفة السبب.";
  else if (m.trend === "declining") advice = `يوجد تراجع في انتظام الحفظ مقارنة بمستوى الطالب المعتاد؛ يحقق حاليًا ${m.completedDays} من ${m.expectedDays ?? 4} أيام، ويُفضّل متابعة السبب.`;
  else if (r.trend === "declining") advice = `يوجد تراجع في انتظام المراجعة مقارنة بمستوى الطالب المعتاد؛ يحقق حاليًا ${r.completedDays} من ${r.expectedDays ?? 4} أيام، ويُفضّل متابعة السبب.`;
  else if (m.trend === "improving" && (m.requirement === "below" || m.requirement === "far-below")) advice = `الحفظ يتحسن مقارنة بالفترة السابقة، لكنه ما زال أقل من المطلوب (${m.completedDays} من ${m.expectedDays ?? "؟"} أيام).`;
  else if (r.trend === "improving" && (r.requirement === "below" || r.requirement === "far-below")) advice = `المراجعة تتحسن مقارنة بالفترة السابقة، لكنها ما زالت أقل من المطلوب (${r.completedDays} من ${r.expectedDays ?? "؟"} أيام).`;
  else if (m.trend === "stable" && (m.requirement === "below" || m.requirement === "far-below")) advice = `الحفظ أقل من المطلوب بشكل مستمر؛ يحقق الطالب ${m.completedDays} من ${m.expectedDays ?? 4} أيام، ويُفضّل وضع هدف تدريجي لرفع الانتظام.`;
  else if (r.trend === "stable" && (r.requirement === "below" || r.requirement === "far-below")) advice = `المراجعة أقل من المطلوب بشكل مستمر؛ يحقق الطالب ${r.completedDays} من ${r.expectedDays ?? 4} أيام، ويُفضّل متابعة سبب النقص.`;
  else if (m.requirement === "meets" && (r.requirement === "below" || r.requirement === "far-below")) advice = `الحفظ يحقق المطلوب، لكن المراجعة أنجزت ${r.completedDays} من ${r.expectedDays ?? "؟"} أيام وتحتاج اهتمامًا أكثر.`;
  else if (r.requirement === "meets" && (m.requirement === "below" || m.requirement === "far-below")) advice = `المراجعة تحقق المطلوب، لكن الحفظ أنجز ${m.completedDays} من ${m.expectedDays ?? "؟"} أيام فقط.`;
  else if (m.consecutiveMisses >= 2 && r.consecutiveMisses >= 2) advice = "يتكرر عدم إنجاز الحفظ والمراجعة في أيام متتالية؛ وهذه حالة تستحق متابعة المعلم.";
  else if (m.consecutiveMisses >= 2) advice = "الطالب لا يحقق الحفظ المطلوب بشكل متكرر؛ تابع انتظامه في أيام الحفظ.";
  else if (r.consecutiveMisses >= 2) advice = "المراجعة أقل من المطلوب بشكل متكرر؛ تابع انتظام الطالب في أيام المراجعة.";
  else if (m.requirement === "meets" && r.requirement === "meets") advice = "الحفظ والمراجعة يحققان الخطة الحالية؛ راقب استمرار المستوى في الأسابيع القادمة.";
  else if (m.requirement === "unknown" && r.requirement === "unknown") advice = `لا يمكن قياس المطلوب للمستوى ${levelInfo(student.xp).level} قبل تحديد خطة الحفظ والمراجعة.`;
  else advice = `${m.explanation} ${r.explanation}`;

  if (attendance.absentDays > 0) {
    const attendanceNote = attendance.frequentAbsence
      ? `لدى الطالب غياب متكرر (${attendance.absentDays} أيام هذا الأسبوع)، ويستحسن متابعة الانتظام.`
      : `أداء الطالب في أيام التقييم منفصل عن غيابه؛ يوجد ${attendance.absentDays} يوم غياب مسجل هذا الأسبوع.`;
    advice = `${advice} ${attendanceNote}`;
  }

  return { attendance, memorization, review, advice };
}


export type StudentTrendResult = {
  label: "تحسن بعد التواصل" | "يتحسن" | "مستقر" | "يتراجع" | "بحاجة إلى متابعة" | "منتظم";
  tone: "mint" | "coral" | "gold" | "grape";
  explanation: string;
};

export function analyzeStudentTrend(
  student: Student,
  weeksLog: WeekLog[] = [],
  parentContacts: ParentContactRecord[] = []
): StudentTrendResult {
  const normTarget = student.name
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim()
    .toLowerCase();

  const contacts = parentContacts
    .filter((c) => c.studentId === student.id || c.studentName.replace(/[ًٌٍَُِّْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").trim().toLowerCase() === normTarget)
    .sort((a, b) => b.contactDateIso.localeCompare(a.contactDateIso));

  const currPresent = DAYS.filter((d) => !!student.days?.[d.key]?.a && !student.days?.[d.key]?.absent).length;
  const currAbsent = DAYS.filter((d) => student.days?.[d.key]?.absent === true).length;

  // 1. إذا كان هناك تواصل سابق مسجل
  if (contacts.length > 0) {
    // الطالب حضر بشكل مستمر وبلا غياب في الأيام اللاحقة
    if (currPresent >= 2 && currAbsent === 0) {
      return {
        label: "تحسن بعد التواصل",
        tone: "mint",
        explanation: "تحسن بالفعل وأصبح أكثر انتظامًا في الحضور بعد التواصل مع ولي الأمر",
      };
    }
    // الطالب ما زال يغيب بعد التواصل
    if (currAbsent >= 2) {
      return {
        label: "بحاجة إلى متابعة",
        tone: "coral",
        explanation: "تكرر الغياب مجددًا بعد التواصل مع ولي الأمر ويتطلب متابعة مستمرة",
      };
    }
  }

  // 2. تحليل السجلات عبر الأسابيع التاريخية
  const chronologicalWeeks = [...weeksLog]
    .filter((w) => w && w.week != null)
    .sort((a, b) => Number(a.week) - Number(b.week));

  const weekHist: { present: number; absent: number }[] = [];
  for (const w of chronologicalWeeks) {
    const record = w.records?.find((r) => r.id === student.id || r.name.replace(/[ًٌٍَُِّْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").trim().toLowerCase() === normTarget);
    const entry = (w.students ?? w.top)?.find((e) => e.id === student.id || e.name.replace(/[ًٌٍَُِّْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").trim().toLowerCase() === normTarget);
    if (record && record.days) {
      const p = DAYS.filter((d) => !!record.days?.[d.key]?.a && !record.days?.[d.key]?.absent).length;
      const ab = DAYS.filter((d) => record.days?.[d.key]?.absent === true).length;
      weekHist.push({ present: p, absent: ab });
    } else if (entry) {
      weekHist.push({ present: entry.attendanceDays ?? 0, absent: entry.absenceDays ?? 0 });
    }
  }

  if (currPresent > 0 || currAbsent > 0) {
    weekHist.push({ present: currPresent, absent: currAbsent });
  }

  if (weekHist.length >= 2) {
    const mid = Math.floor(weekHist.length / 2);
    const earlier = weekHist.slice(0, mid);
    const recent = weekHist.slice(mid);

    const earlierAbsent = earlier.reduce((acc, w) => acc + w.absent, 0);
    const recentAbsent = recent.reduce((acc, w) => acc + w.absent, 0);
    const recentPresent = recent.reduce((acc, w) => acc + w.present, 0);

    // تحسن مدعوم بالبيانات عبر عدة فترات
    if (earlierAbsent >= 2 && recentAbsent === 0 && recentPresent >= 2) {
      return {
        label: "يتحسن",
        tone: "mint",
        explanation: "تحسن ملحوظ وانخفاض واضح في الغياب مقارنة بالفترات السابقة",
      };
    }

    // تراجع في الحضور
    if (earlierAbsent <= 1 && recentAbsent >= 2) {
      return {
        label: "يتراجع",
        tone: "coral",
        explanation: "تراجع في معدل الحضور وزيادة في الغيابات بالفترة الأخيرة",
      };
    }
  }

  if (currAbsent >= 3) {
    return {
      label: "بحاجة إلى متابعة",
      tone: "coral",
      explanation: "تكرار ملحوظ في الغياب يستدعي المتابعة المباشرة",
    };
  }

  if (currPresent >= 3 && currAbsent === 0) {
    return {
      label: "مستقر",
      tone: "mint",
      explanation: "حضور منتظم وأداء مستقر بدون انقطاع",
    };
  }

  return {
    label: "مستقر",
    tone: "grape",
    explanation: "سجل الحضور في المستوى الطبيعي والمستقر",
  };
}
export type ParentRecommendation = {
  id: string;
  category: "spaced-repetition" | "active-recall" | "routine" | "encouragement" | "adjustment" | "exam-prep";
  title: string;
  body: string;
  badge: string;
  tone: "mint" | "grape" | "gold" | "coral";
  educationalPrinciple: string;
};

export type ParentGuidanceReport = {
  headline: string;
  summary: string;
  overallStatus: "excellent" | "improving" | "stable" | "needs-attention";
  comparisonText: string;
  recommendations: ParentRecommendation[];
};

/**
 * محرك النصائح التربوية والتعليمية الذكية لولي الأمر
 * مبني على تحليل بيانات الطالب الفعلية التراكمية عبر الأسابيع والمبادئ التعليمية المعتمدة
 */
export function generateParentAIGuidance(
  student: Student,
  weeksLog: WeekLog[] = [],
  parentContacts: ParentContactRecord[] = []
): ParentGuidanceReport {
  const normTarget = student.name
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim()
    .toLowerCase();

  // 1. حسابات الأسبوع الحالي
  const currPresent = DAYS.filter((d) => !!student.days?.[d.key]?.a && !student.days?.[d.key]?.absent).length;
  const currAbsent = DAYS.filter((d) => student.days?.[d.key]?.absent === true).length;
  
  let currExcellent = 0;
  let currVeryGood = 0;
  let currMemSessions = 0;
  let currRevSessions = 0;

  for (const d of DAYS) {
    const st = student.days?.[d.key];
    const rt = student.recitationRatings?.[d.key];
    if (st?.a && !st.absent) {
      if (st.h || rt?.h === "excellent" || rt?.h === "very-good") {
        currMemSessions += 1;
        if (rt?.h === "excellent") currExcellent += 1;
        if (rt?.h === "very-good") currVeryGood += 1;
      }
      if (st.r || rt?.r === "excellent" || rt?.r === "very-good") {
        currRevSessions += 1;
        if (rt?.r === "excellent") currExcellent += 1;
        if (rt?.r === "very-good") currVeryGood += 1;
      }
    }
  }

  // 2. تحليل الأسابيع السابقة المتراكمة
  const pastRecords = weeksLog
    .map((log) => {
      const rec = log.records?.find((r) => r.id === student.id || r.name.replace(/[ًٌٍَُِّْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").trim().toLowerCase() === normTarget);
      if (rec) return rec;
      const topEntry = (log.students ?? log.top ?? []).find((e) => e.id === student.id || e.name.replace(/[ًٌٍَُِّْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").trim().toLowerCase() === normTarget);
      return topEntry ? (topEntry as any) : null;
    })
    .filter(Boolean);

  let pastPresentSum = 0;
  let pastAbsentSum = 0;
  let pastExcSum = 0;
  let pastVgSum = 0;
  let pastWeeksCount = pastRecords.length;

  for (const pr of pastRecords) {
    if (pr.days) {
      const p = DAYS.filter((d) => !!pr.days?.[d.key]?.a && !pr.days?.[d.key]?.absent).length;
      const a = DAYS.filter((d) => pr.days?.[d.key]?.absent === true).length;
      pastPresentSum += p;
      pastAbsentSum += a;
      for (const d of DAYS) {
        if (pr.recitationRatings?.[d.key]?.h === "excellent") pastExcSum += 1;
        if (pr.recitationRatings?.[d.key]?.h === "very-good") pastVgSum += 1;
        if (pr.recitationRatings?.[d.key]?.r === "excellent") pastExcSum += 1;
        if (pr.recitationRatings?.[d.key]?.r === "very-good") pastVgSum += 1;
      }
    } else {
      pastPresentSum += pr.attendanceDays ?? 0;
      pastAbsentSum += pr.absenceDays ?? 0;
      pastExcSum += (pr.memorizationExcellent ?? 0) + (pr.reviewExcellent ?? 0);
      pastVgSum += (pr.memorizationVeryGood ?? 0) + (pr.reviewVeryGood ?? 0);
    }
  }

  const avgPastAbsence = pastWeeksCount > 0 ? pastAbsentSum / pastWeeksCount : 0;
  const isAbsenceSpike = currAbsent > avgPastAbsence + 0.5 && currAbsent >= 1;
  const isRecovering = pastWeeksCount > 0 && avgPastAbsence >= 1 && currAbsent === 0 && currPresent >= 2;
  const isHighPerformer = currPresent >= 3 && currAbsent === 0 && currExcellent >= currVeryGood && (student.heartsLostWeek ?? 0) === 0;
  const hasTesting = student.isTesting === true;

  // تحديد الحالة العامة ومقارنة التاريخ
  let overallStatus: "excellent" | "improving" | "stable" | "needs-attention" = "stable";
  let headline = "مستوى الطالب مستقر مع مؤشرات إيجابية";
  let summary = `تظهر السجلات التراكمية استقرارًا في التسميع والحضور خلال الفترة الحالية.`;
  let comparisonText = `مقارنة بالأسابيع السابقة: الطالب يحافظ على وتيرة ثابتة بمعدل حضور ${currPresent} أيام هذا الأسبوع.`;

  if (isRecovering) {
    overallStatus = "improving";
    headline = "تطور ملحوظ وتحسن في الانتظام والتسميع";
    summary = `أظهر الطالب تحسنًا إيجابيًا في التقييم والحضور خلال الأيام الأخيرة مقارنة بالفترة السابقة، ومن المفيد الحفاظ على هذا النمط.`;
    comparisonText = `مقارنة بالأسابيع السابقة: انخفضت أيام الغياب وعاد الطالب للالتزام التام بحضور الجلسات.`;
  } else if (isHighPerformer) {
    overallStatus = "excellent";
    headline = "أداء متميز وتفوق في الحفظ والمراجعة";
    summary = `يواصل الطالب تحقيق تقييمات ممتازة مع التزام كامل بالحضور والمحافظة على القلوب ومكافآت الأسبوع.`;
    comparisonText = `مقارنة بالأسابيع السابقة: استمرار في أعلى درجات التقييم دون تسجيل أي غياب.`;
  } else if (isAbsenceSpike) {
    overallStatus = "needs-attention";
    headline = "تراجع طفيف يرتبط بالغياب وتفاوت الحضور";
    summary = `تظهر البيانات انخفاضًا في وتيرة التسميع خلال الفترة الأخيرة مقارنة بالأسابيع السابقة، مع تسجيل أيام غياب أكثر من المعتاد. قد يكون من المفيد مساعدة الطالب على تثبيت روتين الحضور اليومي.`;
    comparisonText = `مقارنة بالأسابيع السابقة: ارتفع معدل الغياب هذا الأسبوع إلى (${currAbsent}) يوم، مما أثر على فرص التسميع اليومية.`;
  } else if (currVeryGood > currExcellent && currVeryGood >= 2) {
    overallStatus = "needs-attention";
    headline = "الحفظ منجز ولكن بحاجة إلى تعزيز الإتقان والمراجعة";
    summary = `الطالب منتظم في التسميع، لكن تكررت درجات (جيد جدًا)، مما يشير إلى الحاجة للتركيز على جودة الحفظ والمراجعة الذهنية المسبقة.`;
    comparisonText = `مقارنة بالأسابيع السابقة: التسميع حاضر ولكن درجات الإتقان تتطلب تثبيتًا أكبر للمحفوظ القديم.`;
  }

  // بناء التوصيات المستندة إلى المبادئ التعليمية
  const recs: ParentRecommendation[] = [];

  // 1. التكرار المتباعد (Spaced Repetition)
  recs.push({
    id: "spaced-rep",
    category: "spaced-repetition",
    badge: "مبدأ التكرار المتباعد",
    title: "توزيع المراجعة على مدار الأسبوع",
    body: "تقسيم السور المحفوظة إلى مقاطع ومراجعتها على فترات زمنية متفرقة (بدل مراجعتها دفعة واحدة في يوم واحد) يرسخ الآيات في الذاكرة طويلة المدى ويمنع تفلتها.",
    tone: "grape",
    educationalPrinciple: "التكرار المتباعد (Spaced Repetition) يعزز بقاء المعلومات بنسبة تتجاوز 70% مقارنة بالمراجعة المركزة بيوم واحد.",
  });

  // 2. الاسترجاع النشط (Active Recall)
  recs.push({
    id: "active-recall",
    category: "active-recall",
    badge: "الاسترجاع النشط",
    title: "التسميع الذاتي والمراجعة الغيبية",
    body: "اطلب من ابنك قراءة الآيات غيبًا في المنزل قبل موعد الحلقة، ومحاولة تذكر بدايات ونهايات الآيات دون النظر في المصحف إلا عند الحاجة للتصحيح.",
    tone: "mint",
    educationalPrinciple: "الاسترجاع النشط (Active Recall) يجبر الذهن على استخراج المحفوظ مما يقوي الروابط العصبية للآيات.",
  });

  // 3. ضبط الكمية أو تثبيت الروتين
  if (isAbsenceSpike || currVeryGood > currExcellent) {
    recs.push({
      id: "quantity-adjustment",
      category: "adjustment",
      badge: "ضبط وتدرج الأهداف",
      title: "التركيز على إتقان نصف صفحة بجودة عالية",
      body: "عند وجود انشغال أو تراجع مؤقت، تقليل مقدار الحفظ اليومي قليلًا مع إتقانه التام أفضل تربويًا من حفظ مقدار كبير غير متقن، مما يرفع ثقة الطالب بنفسه.",
      tone: "coral",
      educationalPrinciple: "الواقعية في الهدف التعليمي تحمي الطالب من الإحباط وتعزز ثبات الإنجاز التراكمي.",
    });
  } else {
    recs.push({
      id: "positive-reinforce",
      category: "encouragement",
      badge: "التعزيز الإيجابي",
      title: "تقدير الجهد والمثابرة اليومية",
      body: "امتدح حرص ابنك على الحضور ومحافظته على عملاته وقلوبه في المنصة؛ فمكافأة الاستمرار والجهد تبني دافعية ذاتية قوية ومستدامة.",
      tone: "gold",
      educationalPrinciple: "التعزيز المعنوي المستمر يرسخ العلاقة الوجدانية الإيجابية مع كتاب الله.",
    });
  }

  // 4. في حال وجود اختبار قادم
  if (hasTesting) {
    recs.push({
      id: "exam-readiness",
      category: "exam-prep",
      badge: "استعداد للاختبار",
      title: "خطة مراجعة مركزة للسور المطلوبة",
      body: "الطالب مسجل لديه اختبار قريب؛ قسّم السور المحددة للاختبار إلى أجزاء صغيرة مع تسميع كل جزء مرتين يوميًا حتى موعد الاختبار لضمان الطمأنينة والإتقان.",
      tone: "gold",
      educationalPrinciple: "التحضير الموزع المبكر يزيل قلق الاختبارات ويثبت جودة الأداء.",
    });
  }

  return {
    headline,
    summary,
    overallStatus,
    comparisonText,
    recommendations: recs,
  };
}
