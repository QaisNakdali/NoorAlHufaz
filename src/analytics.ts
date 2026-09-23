import { DAYS, estimatedLinesFromVerses, levelInfo, type DayKey, type RecitationPart, type Student, type WeekLog, type WeekLogEntry } from "./core";
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
  const ward = student.ward[day];
  return kind === "memorization"
    ? !!ward.memorization.trim() || ward.memorizationVerses > 0 || ward.memorizationLines > 0
    : !!ward.review.trim() || ward.reviewVerses > 0 || ward.reviewLines > 0;
};

function pagesForWardDay(student: Student, day: DayKey, kind: LearningTrack): { pages: number; estimated: boolean } {
  const ward = student.ward[day];
  const text = kind === "memorization" ? ward.memorization : ward.review;
  const from = kind === "memorization" ? ward.memorizationFromVerse : ward.reviewFromVerse;
  const to = kind === "memorization" ? ward.memorizationToVerse : ward.reviewToVerse;
  const lines = kind === "memorization" ? ward.memorizationLines : ward.reviewLines;
  const verses = kind === "memorization" ? ward.memorizationVerses : ward.reviewVerses;
  const parsed = parseQuranRange(text);
  const exact = parsed ? pagesForAyahRange(parsed.surah, from || parsed.from, to || parsed.to) : null;
  if (exact) return { pages: exact.pages, estimated: false };
  if (lines > 0) return { pages: lines / 15, estimated: true };
  if (verses > 0) return { pages: estimatedLinesFromVerses(verses) / 15, estimated: true };
  return { pages: 0, estimated: true };
}

export function measureStudentWork(student: Student, kind: "memorization" | "review"): WorkMeasure {
  const part = kind === "memorization" ? "h" : "r";
  const completed = DAYS.filter((d) => !student.days[d.key].absent && student.days[d.key][part]);
  const verses = completed.reduce((sum, d) => sum + (kind === "memorization" ? student.ward[d.key].memorizationVerses : student.ward[d.key].reviewVerses), 0);
  const enteredLines = completed.reduce((sum, d) => sum + (kind === "memorization" ? student.ward[d.key].memorizationLines : student.ward[d.key].reviewLines), 0);
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
  const attendanceDays = DAYS.filter((d) => student.days[d.key].a).length;
  const absenceDays = DAYS.filter((d) => student.days[d.key].absent === true).length;
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

  if (absenceDays >= 2) recommendations.push(`لدى الطالب ${absenceDays} أيام غياب مسجلة هذا الأسبوع؛ تابع انتظام الحضور دون احتسابها ضعفًا في الحفظ أو المراجعة.`);
  if (memorization.pages >= 1 && review.pages < memorization.pages * 0.5) recommendations.push("الحفظ جيد، لكن مقدار المراجعة أقل من نصفه؛ يُفضّل تقوية المراجعة قبل زيادة الجديد.");
  if (changePercent !== null && changePercent <= -20) recommendations.push(`الأداء انخفض ${Math.abs(changePercent)}٪ عن آخر أسبوع محفوظ؛ راجع سبب الانخفاض مع الطالب.`);
  if (changePercent !== null && changePercent >= 15 && review.sessions >= 2) recommendations.push("التقدم واضح مع وجود مراجعة منتظمة؛ يمكن زيادة الورد قليلًا مع متابعة الثبات.");
  if (memorization.averagePagesPerDay >= 1.5 && review.sessions < memorization.sessions) recommendations.push("الطالب قادر على حفظ كمية كبيرة، لكن يلزم التأكد من ثباتها بالمراجعة قبل رفع المقدار.");
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
    const entry = student.days[day.key];
    return entry.absent !== true && (entry.a || entry.h || entry.r);
  });
  const plannedDays = evaluableDays.filter((day) => hasPlannedWork(student, day.key, kind));
  const completedDays = evaluableDays.filter((day) => student.days[day.key][part]).length;
  const expectedPagesValue = plannedDays.reduce((sum, day) => sum + pagesForWardDay(student, day.key, kind).pages, 0);
  let excellent = 0;
  let veryGood = 0;
  for (const day of plannedDays) {
    if (!student.days[day.key][part]) continue;
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
  const presentDays = DAYS.filter((day) => student.days[day.key].a).length;
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
  const history = [...weeksLog]
    .sort((a, b) => a.week - b.week)
    .map((log) => (log.students ?? log.top).find((entry) => entry.id === student.id))
    .filter((entry): entry is NonNullable<typeof entry> => !!entry)
    .map((entry) => historySnapshot(entry, kind));
  const completionRate = ratio(current.completedDays, current.expectedDays);
  const quantityRate = ratio(current.pages, current.expectedPages);
  const requirement = requirementFrom(completionRate, quantityRate);
  const ratingTransition = detectRatingTransition(student, kind);
  const trend = ratingTransition === "very-good-to-excellent"
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
  const explanation = `${noun} ${requirementText[requirement]} (${dayEvidence}) ${trendText[trend]}${transitionText}${misses >= 2 ? `؛ توجد ${misses} أيام متتالية دون إنجاز` : ""}.`;

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

  if (m.ratingTransition === "very-good-to-excellent" && r.requirement === "meets") advice = "الحفظ في تحسن واضح من جيد جدًا إلى ممتاز، والمراجعة تحقق المطلوب.";
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
