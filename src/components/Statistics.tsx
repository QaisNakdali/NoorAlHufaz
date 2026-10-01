/* إحصائيات الطلاب فقط — قراءة مباشرة من الكشف الحالي وأرشيف الأسابيع مع فصل إحصائيات الحفظ عن المراجعة والترتيب التنازلي التلقائي حسب الصفحات */
import { useMemo, useState, useEffect } from "react";
import { useApp, DEFAULT_ABSENCE_MESSAGE, DEFAULT_NOT_HEARD_MESSAGE } from "../appState";
import { analyzeStudent, analyzeStudentTrend, measureStudentWork, pagesForWardDay } from "../analytics";
import { ar, DAYS, type DayKey, type Student, type WeekLog, type WeekLogEntry, type WeekStudentRecord, type ParentContactRecord, estimatedLinesFromVerses } from "../core";
import Avatar from "./Avatar";
import { Icon, Modal, SectionHead } from "./ui";
import { addCalendarDays, dateFromLocalKey, formatHijriDate, formatHijriMonth, formatTeachingWeek, hijriMonthKey, localDateKey } from "../hijriDate";
import { roundUpToQuarter } from "../statisticsNumber";
import { reviewLinesForWard } from "../learningMetrics";

type Period = "daily" | "weekly" | "monthly" | "all";
type StatsView = "both" | "memorization" | "review";

type StudentMetrics = {
  id: string;
  name: string;
  photo: string | null;
  halaqaId?: string | null;
  present: number;
  absent: number;
  memorizationSessions: number;
  reviewSessions: number;
  memorizationVerses: number;
  reviewVerses: number;
  memorizationLines: number;
  reviewLines: number;
  memorizationPages: number;
  reviewPages: number;
  notHeardMem: number;
  notHeardRev: number;
  notHeardBoth: number;
  rank?: number;
};

const emptyMetrics = (student: Pick<Student, "id" | "name" | "photo" | "halaqaId">): StudentMetrics => ({
  id: student.id,
  name: student.name,
  photo: student.photo,
  halaqaId: student.halaqaId,
  present: 0,
  absent: 0,
  memorizationSessions: 0,
  reviewSessions: 0,
  memorizationVerses: 0,
  reviewVerses: 0,
  memorizationLines: 0,
  reviewLines: 0,
  memorizationPages: 0,
  reviewPages: 0,
  notHeardMem: 0,
  notHeardRev: 0,
  notHeardBoth: 0,
});

const n = (value: number) => ar(roundUpToQuarter(value));

const add = (a: StudentMetrics, b: StudentMetrics): StudentMetrics => ({
  ...a,
  present: a.present + b.present,
  absent: a.absent + b.absent,
  memorizationSessions: a.memorizationSessions + b.memorizationSessions,
  reviewSessions: a.reviewSessions + b.reviewSessions,
  memorizationVerses: a.memorizationVerses + b.memorizationVerses,
  reviewVerses: a.reviewVerses + b.reviewVerses,
  memorizationLines: a.memorizationLines + b.memorizationLines,
  reviewLines: a.reviewLines + b.reviewLines,
  memorizationPages: a.memorizationPages + b.memorizationPages,
  reviewPages: a.reviewPages + b.reviewPages,
  notHeardMem: (a.notHeardMem ?? 0) + (b.notHeardMem ?? 0),
  notHeardRev: (a.notHeardRev ?? 0) + (b.notHeardRev ?? 0),
  notHeardBoth: (a.notHeardBoth ?? 0) + (b.notHeardBoth ?? 0),
});

/**
 * فحص حالة اليوم الواحد للطالب بدقة وحيادية وفق السجلات الأصلية الفعلية:
 * 1. إذا لم يُسجل شيء لليوم -> لا يُحسب حضور ولا غياب ولا عدم تسميع (عدم وجود بيانات لا يعني لم يسمع).
 * 2. إذا كان الطالب غائباً -> يُحسب في الغياب فقط، ولا يُحسب في "لم يسمع" قطعاً (لا حفظ ولا مراجعة ولا كلاهما).
 * 3. إذا لم يُسجل حضور للطالب -> لا يُحسب "لم يسمع".
 * 4. إذا كان الطالب حاضراً:
 *    - لم يسمع الحفظ: حاضر ولم يُسجل له تسميع الحفظ (أو تقييمه "لم يحفظ").
 *    - لم يسمع المراجعة: حاضر ولم يُسجل له تسميع المراجعة (أو تقييمه "لم يراجع").
 *    - كلاهما: حاضر ولم يُسجل له الحفظ والمراجعة معاً في نفس هذا اليوم.
 */
function checkDayRecitation(
  state?: { a?: boolean; h?: boolean; r?: boolean; absent?: boolean } | null,
  ward?: { memorization?: string; review?: string; memorizationLines?: number; reviewLines?: number; memorizationVerses?: number; reviewVerses?: number; reviewPages?: number } | null,
  ratings?: { h?: any; r?: any } | null
): {
  isAbsent: boolean;
  isPresent: boolean;
  notHeardMem: boolean;
  notHeardRev: boolean;
  notHeardBoth: boolean;
} {
  if (!state) {
    return { isAbsent: false, isPresent: false, notHeardMem: false, notHeardRev: false, notHeardBoth: false };
  }
  if (state.absent === true) {
    return { isAbsent: true, isPresent: false, notHeardMem: false, notHeardRev: false, notHeardBoth: false };
  }
  if (!state.a) {
    return { isAbsent: false, isPresent: false, notHeardMem: false, notHeardRev: false, notHeardBoth: false };
  }

  // الطالب حاضر في هذا اليوم (state.a === true && !state.absent)
  const hasMem = Boolean(state.h || ratings?.h === "excellent" || ratings?.h === "very-good");
  const hasRev = Boolean(state.r || ratings?.r === "excellent" || ratings?.r === "very-good");

  const notHeardMem = !hasMem;
  const notHeardRev = !hasRev;
  const notHeardBoth = !hasMem && !hasRev;

  return {
    isAbsent: false,
    isPresent: true,
    notHeardMem,
    notHeardRev,
    notHeardBoth,
  };
}

function formatAbsenceCount(count: number): string {
  if (count === 1) return "غياب واحد";
  if (count === 2) return "غيابان";
  if (count >= 3 && count <= 10) return `${ar(count)} غيابات`;
  return `${ar(count)} غياب`;
}

function formatNotHeardCount(count: number): string {
  if (count === 1) return "مرة واحدة";
  if (count === 2) return "مرتان";
  if (count >= 3 && count <= 10) return `${ar(count)} مرات`;
  return `${ar(count)} مرة`;
}

const normalizeArabic = (text: string): string => {
  return (text ?? "")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim()
    .toLowerCase();
};

/**
 * تهيئة رقم الهاتف لفتح واتساب بشكل صحيح وموثوق
 */
function formatPhoneForWhatsApp(raw?: string | null): string | null {
  if (!raw) return null;
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  let cleaned = "";
  for (const ch of String(raw)) {
    const idx = arabicDigits.indexOf(ch);
    if (idx !== -1) {
      cleaned += idx;
    } else if (/[0-9+]/.test(ch)) {
      cleaned += ch;
    }
  }

  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  if (cleaned.startsWith("00")) cleaned = cleaned.slice(2);

  // الأرقام السعودية: إذا بدأ بـ 05 وكان 10 أرقام -> 9665XXXXXXXX
  if (cleaned.startsWith("05") && cleaned.length === 10) {
    cleaned = "966" + cleaned.slice(1);
  } else if (cleaned.startsWith("5") && cleaned.length === 9) {
    cleaned = "966" + cleaned;
  }

  if (cleaned.length >= 8 && cleaned.length <= 15 && /^[0-9]+$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

/**
 * تعبئة متغيرات رسالة واتساب
 */
function fillTemplate(
  template: string,
  vars: {
    studentName: string;
    recitationType?: string;
    absenceCount?: number;
    date?: string;
  }
): string {
  let res = template || "";
  res = res.replace(/\{اسم الطالب\}/g, vars.studentName || "");
  res = res.replace(/\{نوع التسميع\}/g, vars.recitationType || "التسميع");
  res = res.replace(/\{عدد الغيابات\}/g, vars.absenceCount != null ? ar(vars.absenceCount) : "");
  res = res.replace(/\{التاريخ\}/g, vars.date || "");
  return res;
}

/**
 * حساب مقاييس الطالب من سجله الفعلي اليومي
 */
function fromRecord(record: WeekStudentRecord, day?: DayKey): StudentMetrics {
  const result = emptyMetrics(record);
  const mockStudent = record as unknown as Student;

  if (!day) {
    for (const d of DAYS) {
      const state = record.days?.[d.key];
      const ward = record.ward?.[d.key] ?? { memorization: "", review: "", memorizationVerses: 0, reviewVerses: 0, memorizationLines: 0, reviewLines: 0 };
      const ratings = record.recitationRatings?.[d.key];

      const res = checkDayRecitation(state, ward, ratings);
      if (res.isPresent) result.present += 1;
      if (res.isAbsent) result.absent += 1;
      if (res.notHeardMem) result.notHeardMem += 1;
      if (res.notHeardRev) result.notHeardRev += 1;
      if (res.notHeardBoth) result.notHeardBoth += 1;

      // حساب الجلسات والصفحات فقط للأيام التي سَمّع فيها الطالب بالفعل:
      const hasMem = Boolean(state?.h || ratings?.h === "excellent" || ratings?.h === "very-good");
      const hasRev = Boolean(state?.r || ratings?.r === "excellent" || ratings?.r === "very-good");

      if (hasMem && res.isPresent) {
        result.memorizationSessions += 1;
        result.memorizationVerses += Number(ward.memorizationVerses) || 0;
        const lines = Number(ward.memorizationLines) || (ward.memorizationVerses ? estimatedLinesFromVerses(ward.memorizationVerses) : 0);
        result.memorizationLines += lines;
        result.memorizationPages += pagesForWardDay(mockStudent, d.key, "memorization").pages;
      }

      if (hasRev && res.isPresent) {
        result.reviewSessions += 1;
        result.reviewVerses += Number(ward.reviewVerses) || 0;
        const lines = ward.reviewPages !== undefined ? reviewLinesForWard(ward) : (Number(ward.reviewLines) || (ward.reviewVerses ? estimatedLinesFromVerses(ward.reviewVerses) : 0));
        result.reviewLines += lines;
        result.reviewPages += pagesForWardDay(mockStudent, d.key, "review").pages;
      }
    }
    return result;
  }

  // إذا تم تحديد يوم معين:
  const state = record.days?.[day];
  const ward = record.ward?.[day] ?? { memorization: "", review: "", memorizationVerses: 0, reviewVerses: 0, memorizationLines: 0, reviewLines: 0 };
  const ratings = record.recitationRatings?.[day];

  const res = checkDayRecitation(state, ward, ratings);
  if (res.isPresent) result.present = 1;
  if (res.isAbsent) result.absent = 1;
  if (res.notHeardMem) result.notHeardMem = 1;
  if (res.notHeardRev) result.notHeardRev = 1;
  if (res.notHeardBoth) result.notHeardBoth = 1;

  const hasMem = Boolean(state?.h || ratings?.h === "excellent" || ratings?.h === "very-good");
  const hasRev = Boolean(state?.r || ratings?.r === "excellent" || ratings?.r === "very-good");

  if (hasMem && res.isPresent) {
    result.memorizationSessions = 1;
    result.memorizationVerses += Number(ward.memorizationVerses) || 0;
    const lines = Number(ward.memorizationLines) || (ward.memorizationVerses ? estimatedLinesFromVerses(ward.memorizationVerses) : 0);
    result.memorizationLines = lines;
    result.memorizationPages += pagesForWardDay(mockStudent, day, "memorization").pages;
  }

  if (hasRev && res.isPresent) {
    result.reviewSessions = 1;
    result.reviewVerses += Number(ward.reviewVerses) || 0;
    const lines = ward.reviewPages !== undefined ? reviewLinesForWard(ward) : (Number(ward.reviewLines) || (ward.reviewVerses ? estimatedLinesFromVerses(ward.reviewVerses) : 0));
    result.reviewLines = lines;
    result.reviewPages += pagesForWardDay(mockStudent, day, "review").pages;
  }

  return result;
}

function fromStudent(student: Student, day?: DayKey): StudentMetrics {
  return fromRecord({
    id: student.id,
    name: student.name,
    photo: student.photo,
    guardianPhone: student.guardianPhone,
    halaqaId: student.halaqaId,
    days: student.days,
    recitationRatings: student.recitationRatings ?? { sun: {}, mon: {}, tue: {}, wed: {} },
    ward: student.ward,
    hearts: student.hearts,
    heartsLostWeek: student.heartsLostWeek,
    xp: student.xp,
    coins: student.coins,
  }, day);
}

function fromStudentHijriMonth(student: Student, monthKey: string, weekStartDateIso: string): StudentMetrics {
  const result = emptyMetrics(student);
  for (let i = 0; i < DAYS.length; i += 1) {
    const dayDate = addCalendarDays(weekStartDateIso, i);
    if (hijriMonthKey(dayDate) !== monthKey) continue;
    const day = DAYS[i];
    const single = fromStudent(student, day.key);
    result.present += single.present;
    result.absent += single.absent;
    result.memorizationSessions += single.memorizationSessions;
    result.reviewSessions += single.reviewSessions;
    result.memorizationVerses += single.memorizationVerses;
    result.reviewVerses += single.reviewVerses;
    result.memorizationLines += single.memorizationLines;
    result.reviewLines += single.reviewLines;
    result.memorizationPages += single.memorizationPages;
    result.reviewPages += single.reviewPages;
    result.notHeardMem += single.notHeardMem;
    result.notHeardRev += single.notHeardRev;
    result.notHeardBoth += single.notHeardBoth;
  }
  return result;
}

function logDate(log: WeekLog): Date | null {
  return log.weekStartDateIso ? dateFromLocalKey(log.weekStartDateIso) : log.savedAtIso ? new Date(log.savedAtIso) : null;
}

function fromEntry(entry: WeekLogEntry): StudentMetrics {
  const memLines = entry.memorizationLines ?? 0;
  const revLines = entry.reviewLines ?? 0;
  const memPages = typeof entry.memorizationPages === "number" ? entry.memorizationPages : (memLines > 0 ? memLines / 15 : 0);
  const revPages = typeof entry.reviewPages === "number" ? entry.reviewPages : (revLines > 0 ? revLines / 15 : 0);
  const present = entry.attendanceDays ?? 0;
  const absent = entry.absenceDays ?? 0;
  const memSessions = entry.memorizationSessions ?? entry.memorizationDays ?? 0;
  const revSessions = entry.reviewSessions ?? entry.reviewDays ?? 0;
  const notHeardMem = Math.max(0, present - memSessions);
  const notHeardRev = Math.max(0, present - revSessions);

  return {
    id: entry.id,
    name: entry.name,
    photo: entry.photo ?? null,
    present,
    absent,
    memorizationSessions: memSessions,
    reviewSessions: revSessions,
    memorizationVerses: entry.memorizationVerses ?? 0,
    reviewVerses: entry.reviewVerses ?? 0,
    memorizationLines: memLines,
    reviewLines: revLines,
    memorizationPages: memPages,
    reviewPages: revPages,
    notHeardMem,
    notHeardRev,
    notHeardBoth: Math.min(notHeardMem, notHeardRev),
  };
}

function logMetrics(log: WeekLog, allStudents?: Student[]): StudentMetrics[] {
  const map = new Map<string, StudentMetrics>();

  // 1. قراءة السجلات التفصيلية اليومية أولاً إن وُجدت (المصدر الدقيق والأصلي)
  if (Array.isArray(log.records) && log.records.length > 0) {
    for (const record of log.records) {
      if (!record || !record.name) continue;
      const m = fromRecord(record);
      map.set(record.id, m);
    }
  }

  // 2. دمج إحصائيات الطلاب المحفوظة في الأسبوع لتكملة أي طالب قديم غير موجود في records
  const studentEntries = [
    ...(Array.isArray(log.students) ? log.students : []),
    ...(Array.isArray(log.top) ? log.top : []),
  ];

  for (const entry of studentEntries) {
    if (!entry || !entry.name) continue;
    if (map.has(entry.id)) {
      const existing = map.get(entry.id)!;
      if (!existing.photo && entry.photo) existing.photo = entry.photo;
      continue;
    }
    const existingByName = [...map.values()].find((m) => normalizeArabic(m.name) === normalizeArabic(entry.name));
    if (existingByName) {
      if (!existingByName.photo && entry.photo) existingByName.photo = entry.photo;
      continue;
    }
    map.set(entry.id, fromEntry(entry));
  }

  const list = [...map.values()];
  if (allStudents?.length) {
    const photoMap = new Map(allStudents.map((s) => [s.id, s.photo]));
    const namePhotoMap = new Map(allStudents.map((s) => [normalizeArabic(s.name), s.photo]));
    for (const item of list) {
      if (!item.photo) {
        item.photo = photoMap.get(item.id) ?? namePhotoMap.get(normalizeArabic(item.name)) ?? null;
      }
    }
  }
  return list;
}

function MetricCard({
  icon,
  label,
  value,
  tone = "grape",
}: {
  icon: string;
  label: string;
  value: string;
  tone?: "grape" | "mint" | "coral" | "gold";
}) {
  const colors = {
    grape: "border-grape-200 text-grape-600",
    mint: "border-mint-200 text-mint-700",
    coral: "border-coral-200 text-coral-600",
    gold: "border-gold-200 text-gold-700",
  };
  return (
    <div className={`rounded-2xl border-2 bg-white p-4 ${colors[tone]}`}>
      <div className="flex items-center gap-2">
        <Icon name={icon} className="h-5 w-5 shrink-0" />
        <span className="text-xs font-extrabold text-grape-600">{label}</span>
      </div>
      <p className="mt-2 font-display text-2xl font-extrabold text-ink">{value}</p>
    </div>
  );
}

export default function StatisticsPage() {
  const {
    students = [],
    weeksLog = [],
    halaqas = [],
    week = 1,
    weekStartDateIso = "",
    parentContacts = [],
    contactMessages,
    setContactMessage,
    resetContactMessage,
    recordParentContact,
    removeParentContact,
    toast,
  } = useApp();

  const [archiveTab, setArchiveTab] = useState<"absence" | "notHeard">("absence");
  const [period, setPeriod] = useState<Period>("all");
  const [studentId, setStudentId] = useState("all");
  const [halaqaId, setHalaqaId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [day, setDay] = useState<DayKey>("sun");
  const [selectedWeek, setSelectedWeek] = useState("current");
  const [statsView, setStatsView] = useState<StatsView>("both");
  const [notHeardTab, setNotHeardTab] = useState<"all" | "mem" | "rev">("all");
  const [detailsCategory, setDetailsCategory] = useState<"absent" | "all" | "both" | "mem" | "rev" | null>(null);
  const [modalSearch, setModalSearch] = useState("");

  // إعدادات رسائل الواتساب
  const [showMessageSettings, setShowMessageSettings] = useState(false);
  const [absenceTemplateInput, setAbsenceTemplateInput] = useState(contactMessages?.absence || DEFAULT_ABSENCE_MESSAGE);
  const [notHeardTemplateInput, setNotHeardTemplateInput] = useState(contactMessages?.notHeard || DEFAULT_NOT_HEARD_MESSAGE);

  // مزامنة حالة نصوص القوالب عند تغير إعدادات التطبيق
  useEffect(() => {
    if (contactMessages?.absence) setAbsenceTemplateInput(contactMessages.absence);
    if (contactMessages?.notHeard) setNotHeardTemplateInput(contactMessages.notHeard);
  }, [contactMessages]);

  // حالة طي وتوسعة الأقسام مع الحفظ في التخزين المحلي
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem("noor_stats_collapsed");
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      absent: false,
      notHeard: false,
      archive: false,
    };
  });

  const toggleCollapse = (section: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [section]: !prev[section] };
      try {
        localStorage.setItem("noor_stats_collapsed", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // استبعاد أي تكرار محتمل في أرقام الأسابيع لحماية الحسابات من التكرار
  const uniqueLogs = useMemo(() => {
    const map = new Map<number, WeekLog>();
    for (const log of weeksLog) {
      if (log && log.week != null) {
        map.set(Number(log.week), log);
      }
    }
    return [...map.values()];
  }, [weeksLog]);

  const monthOptions = useMemo(() => {
    const dates = [
      dateFromLocalKey(weekStartDateIso) ?? new Date(),
      ...uniqueLogs.map(logDate).filter((date): date is Date => !!date),
    ];
    const map = new Map<string, Date>();
    dates.forEach((date) => map.set(hijriMonthKey(date), date));
    return [...map.entries()].sort((a, b) => b[1].getTime() - a[1].getTime());
  }, [uniqueLogs, weekStartDateIso]);

  const [selectedMonth, setSelectedMonth] = useState(() => hijriMonthKey(dateFromLocalKey(weekStartDateIso) ?? new Date()));

  // تصفية الطلاب حسب الحلقة المختارة بدقة
  const currentStudents = useMemo(() => {
    if (halaqaId === "all") return students;
    if (halaqaId === "none") return students.filter((s) => !s.halaqaId);
    return students.filter((s) => s.halaqaId === halaqaId);
  }, [students, halaqaId]);

  // الطلاب بعد تطبيق البحث بالاسم (إن وُجد)
  const searchedStudents = useMemo(() => {
    const q = normalizeArabic(searchQuery);
    if (!q) return currentStudents;
    return currentStudents.filter((s) => normalizeArabic(s.name).includes(q));
  }, [currentStudents, searchQuery]);

  // حساب المقاييس والإحصائيات استنادًا إلى الحلقة والفترة والطلاب الفعليين
  const rawMetrics = useMemo(() => {
    let rows: StudentMetrics[] = [];
    if (period === "daily") {
      rows = currentStudents.map((student) => fromStudent(student, day));
    }
    if (period === "weekly") {
      if (selectedWeek === "current") {
        rows = currentStudents.map((student) => fromStudent(student));
      } else {
        const log = uniqueLogs.find((item) => item.week === Number(selectedWeek));
        if (log) {
          const logRows = logMetrics(log, students);
          const nameToStudent = new Map(currentStudents.map((s) => [normalizeArabic(s.name), s]));
          rows = logRows.map((r) => {
            const matched = currentStudents.find((s) => s.id === r.id) || nameToStudent.get(normalizeArabic(r.name));
            if (matched) {
              return { ...r, id: matched.id, name: matched.name, halaqaId: matched.halaqaId, photo: matched.photo ?? r.photo };
            }
            return r;
          });
        } else {
          rows = [];
        }
      }
    }
    if (period === "monthly" || period === "all") {
      // استبعاد الأسبوع الحالي من الأرشيف حتى لا يُحسب مرتين مع الكشف النشط
      const sourceLogs = (
        period === "monthly"
          ? uniqueLogs.filter((log) => {
              const date = logDate(log);
              return date && hijriMonthKey(date) === selectedMonth;
            })
          : uniqueLogs
      ).filter((log) => Number(log.week) !== Number(week));

      const map = new Map<string, StudentMetrics>();
      for (const student of currentStudents) {
        map.set(student.id, emptyMetrics(student));
      }

      const nameToStudentId = new Map<string, string>();
      for (const student of currentStudents) {
        nameToStudentId.set(normalizeArabic(student.name), student.id);
      }

      for (const log of sourceLogs) {
        const rowsForLog = logMetrics(log, students);
        for (const row of rowsForLog) {
          const targetId = map.has(row.id) ? row.id : nameToStudentId.get(normalizeArabic(row.name));
          if (targetId && map.has(targetId)) {
            map.set(targetId, add(map.get(targetId)!, row));
          } else if (halaqaId === "all" && !targetId) {
            map.set(row.id, row);
            nameToStudentId.set(normalizeArabic(row.name), row.id);
          }
        }
      }

      if (period === "all") {
        for (const student of currentStudents) {
          if (map.has(student.id)) {
            map.set(student.id, add(map.get(student.id)!, fromStudent(student)));
          }
        }
      } else if (selectedMonth === hijriMonthKey(dateFromLocalKey(weekStartDateIso) ?? new Date())) {
        for (const student of currentStudents) {
          if (map.has(student.id)) {
            map.set(student.id, add(map.get(student.id)!, fromStudentHijriMonth(student, selectedMonth, weekStartDateIso)));
          }
        }
      }
      rows = [...map.values()];
    }

    // التأكد من حصر الطلاب ضمن طلاب الحلقة المختارة دائمًا
    if (halaqaId !== "all") {
      const allowed = new Set(currentStudents.map((student) => student.id));
      rows = rows.filter((row) => allowed.has(row.id));
    }

    return rows;
  }, [period, currentStudents, day, selectedWeek, selectedMonth, uniqueLogs, week, students, halaqaId, weekStartDateIso]);

  // تصفية المقاييس العامة حسب الطالب المحدد أو نص البحث أولاً
  const metrics = useMemo(() => {
    let list = rawMetrics;
    if (studentId !== "all") {
      list = list.filter((row) => row.id === studentId);
    } else if (searchQuery.trim()) {
      const q = normalizeArabic(searchQuery);
      list = list.filter((row) => normalizeArabic(row.name).includes(q));
    }
    return list;
  }, [rawMetrics, studentId, searchQuery]);

  // 1. ترتيب إحصائيات الحفظ تنازليًا من الأكثر إلى الأقل حسب إجمالي صفحات الحفظ
  const memorizationRanked = useMemo(() => {
    const sorted = [...metrics].sort((a, b) => {
      const diffPages = b.memorizationPages - a.memorizationPages;
      if (Math.abs(diffPages) > 0.0001) return diffPages;
      const diffVerses = b.memorizationVerses - a.memorizationVerses;
      if (diffVerses !== 0) return diffVerses;
      const diffSessions = b.memorizationSessions - a.memorizationSessions;
      if (diffSessions !== 0) return diffSessions;
      const nameDiff = a.name.localeCompare(b.name, "ar");
      if (nameDiff !== 0) return nameDiff;
      return a.id.localeCompare(b.id);
    });
    return sorted.map((item, idx) => ({ ...item, rank: idx + 1 }));
  }, [metrics]);

  // 2. ترتيب إحصائيات المراجعة تنازليًا من الأكثر إلى الأقل حسب إجمالي صفحات المراجعة
  const reviewRanked = useMemo(() => {
    const sorted = [...metrics].sort((a, b) => {
      const diffPages = b.reviewPages - a.reviewPages;
      if (Math.abs(diffPages) > 0.0001) return diffPages;
      const diffVerses = b.reviewVerses - a.reviewVerses;
      if (diffVerses !== 0) return diffVerses;
      const diffSessions = b.reviewSessions - a.reviewSessions;
      if (diffSessions !== 0) return diffSessions;
      const nameDiff = a.name.localeCompare(b.name, "ar");
      if (nameDiff !== 0) return nameDiff;
      return a.id.localeCompare(b.id);
    });
    return sorted.map((item, idx) => ({ ...item, rank: idx + 1 }));
  }, [metrics]);

  const sortedMemorization = memorizationRanked;
  const sortedReview = reviewRanked;

  // 1. الطلاب الغائبون مع استبعاد المؤرشفين (الحالات النشطة بحاجة لمتابعة)
  // مصدر وحيد للبيانات: العدد في البطاقة يطابق تماماً طول هذه المصفوفة
  const absentRanked = useMemo(() => {
    return metrics
      .map((s) => {
        const studentAbsenceContacts = parentContacts.filter(
          (c) => (c.studentId === s.id || normalizeArabic(c.studentName) === normalizeArabic(s.name)) && c.type === "absence"
        );
        const lastContactedCount = studentAbsenceContacts.length > 0
          ? Math.max(...studentAbsenceContacts.map((c) => c.absenceCountAtContact ?? 0))
          : 0;
        const activeAbsence = Math.max(0, s.absent - lastContactedCount);
        return {
          ...s,
          activeAbsence,
          lastContactedCount,
          hasPriorContact: studentAbsenceContacts.length > 0,
        };
      })
      .filter((s) => s.activeAbsence > 0)
      .sort((a, b) => b.activeAbsence - a.activeAbsence || a.name.localeCompare(b.name, "ar"));
  }, [metrics, parentContacts]);

  // 2. الطلاب الذين لم يسمعوا الحفظ والمراجعة معًا في نفس اليوم مع استبعاد المؤرشفين
  const notHeardBothRanked = useMemo(() => {
    return metrics
      .map((s) => {
        const studentContacts = parentContacts.filter(
          (c) => (c.studentId === s.id || normalizeArabic(c.studentName) === normalizeArabic(s.name)) && c.type === "notHeard"
        );
        const lastBoth = studentContacts.length > 0
          ? Math.max(...studentContacts.map((c) => c.notHeardBothAtContact ?? 0))
          : 0;
        const activeCount = Math.max(0, s.notHeardBoth - lastBoth);
        return {
          ...s,
          activeCount,
          lastContactedCount: lastBoth,
          hasPriorContact: studentContacts.length > 0,
        };
      })
      .filter((s) => s.activeCount > 0)
      .sort((a, b) => b.activeCount - a.activeCount || a.name.localeCompare(b.name, "ar"));
  }, [metrics, parentContacts]);

  // 3. الطلاب الذين لم يسمعوا الحفظ مع استبعاد المؤرشفين
  const notHeardMemRanked = useMemo(() => {
    return metrics
      .map((s) => {
        const studentContacts = parentContacts.filter(
          (c) => (c.studentId === s.id || normalizeArabic(c.studentName) === normalizeArabic(s.name)) && c.type === "notHeard"
        );
        const lastMem = studentContacts.length > 0
          ? Math.max(...studentContacts.map((c) => c.notHeardMemAtContact ?? 0))
          : 0;
        const activeCount = Math.max(0, s.notHeardMem - lastMem);
        return {
          ...s,
          activeCount,
          lastContactedCount: lastMem,
          hasPriorContact: studentContacts.length > 0,
        };
      })
      .filter((s) => s.activeCount > 0)
      .sort((a, b) => b.activeCount - a.activeCount || a.name.localeCompare(b.name, "ar"));
  }, [metrics, parentContacts]);

  // 4. الطلاب الذين لم يسمعوا المراجعة مع استبعاد المؤرشفين
  const notHeardRevRanked = useMemo(() => {
    return metrics
      .map((s) => {
        const studentContacts = parentContacts.filter(
          (c) => (c.studentId === s.id || normalizeArabic(c.studentName) === normalizeArabic(s.name)) && c.type === "notHeard"
        );
        const lastRev = studentContacts.length > 0
          ? Math.max(...studentContacts.map((c) => c.notHeardRevAtContact ?? 0))
          : 0;
        const activeCount = Math.max(0, s.notHeardRev - lastRev);
        return {
          ...s,
          activeCount,
          lastContactedCount: lastRev,
          hasPriorContact: studentContacts.length > 0,
        };
      })
      .filter((s) => s.activeCount > 0)
      .sort((a, b) => b.activeCount - a.activeCount || a.name.localeCompare(b.name, "ar"));
  }, [metrics, parentContacts]);

  // قائمة موحدة: يظهر كل طالب مرة واحدة مع إبقاء عدادي الحفظ والمراجعة مستقلين.
  // نعتمد القوائم النشطة نفسها حتى لا نعيد حالات سبق أرشفتها بعد التواصل.
  const notHeardAllRanked = useMemo(() => {
    const byId = new Map<string, any>();
    for (const item of notHeardMemRanked) {
      byId.set(item.id, {
        ...item,
        activeMemCount: item.activeCount,
        activeRevCount: 0,
      });
    }
    for (const item of notHeardRevRanked) {
      const current = byId.get(item.id);
      byId.set(item.id, {
        ...(current || item),
        activeMemCount: current?.activeMemCount ?? 0,
        activeRevCount: item.activeCount,
      });
    }
    return [...byId.values()]
      .map((item) => ({
        ...item,
        activeCount: item.activeMemCount + item.activeRevCount,
      }))
      .sort((a, b) => b.activeCount - a.activeCount || a.name.localeCompare(b.name, "ar"));
  }, [notHeardMemRanked, notHeardRevRanked]);

  // أرشيف الغائبين المفلتر
  const absenceArchive = useMemo(() => {
    const list = parentContacts.filter((c) => c.type === "absence");
    if (studentId !== "all") {
      return list.filter((c) => c.studentId === studentId);
    }
    if (searchQuery.trim()) {
      const q = normalizeArabic(searchQuery);
      return list.filter((c) => normalizeArabic(c.studentName).includes(q));
    }
    if (halaqaId !== "all") {
      const allowedStudentIds = new Set(currentStudents.map((s) => s.id));
      return list.filter((c) => allowedStudentIds.has(c.studentId));
    }
    return list;
  }, [parentContacts, studentId, searchQuery, halaqaId, currentStudents]);

  // أرشيف الذين لم يسمعوا المفلتر
  const notHeardArchive = useMemo(() => {
    const list = parentContacts.filter((c) => c.type === "notHeard");
    if (studentId !== "all") {
      return list.filter((c) => c.studentId === studentId);
    }
    if (searchQuery.trim()) {
      const q = normalizeArabic(searchQuery);
      return list.filter((c) => normalizeArabic(c.studentName).includes(q));
    }
    if (halaqaId !== "all") {
      const allowedStudentIds = new Set(currentStudents.map((s) => s.id));
      return list.filter((c) => allowedStudentIds.has(c.studentId));
    }
    return list;
  }, [parentContacts, studentId, searchQuery, halaqaId, currentStudents]);

  const total = useMemo(() => {
    return metrics.reduce((sum, item) => add(sum, item), {
      id: "total",
      name: "الإجمالي",
      photo: null,
      present: 0,
      absent: 0,
      memorizationSessions: 0,
      reviewSessions: 0,
      memorizationVerses: 0,
      reviewVerses: 0,
      memorizationLines: 0,
      reviewLines: 0,
      memorizationPages: 0,
      reviewPages: 0,
      notHeardMem: 0,
      notHeardRev: 0,
      notHeardBoth: 0,
    });
  }, [metrics]);

  const selectedStudent = useMemo(() => {
    if (studentId !== "all") return students.find((s) => s.id === studentId);
    if (searchQuery.trim() && metrics.length === 1) return students.find((s) => s.id === metrics[0].id);
    return null;
  }, [studentId, searchQuery, metrics, students]);

  const selectedAnalysis = selectedStudent ? analyzeStudent(selectedStudent, uniqueLogs) : null;

  const currentHalaqaName = useMemo(() => {
    if (halaqaId === "all") return "جميع الحلقات";
    if (halaqaId === "none") return "الطلاب بلا حلقة";
    return halaqas.find((h) => h.id === halaqaId)?.name ?? "الحلقة المختارة";
  }, [halaqaId, halaqas]);

  const totalSessions = total.present + total.absent;
  const attendanceRate = totalSessions > 0 ? Math.round((total.present / totalSessions) * 100) : 0;

  // إعداد بيانات نافذة التفاصيل Modal
  const activeCategoryData = useMemo(() => {
    if (detailsCategory === "absent") {
      return {
        title: "قائمة الطلاب الغائبين",
        countLabel: "طالب غائب بحاجة لمتابعة",
        icon: "alert",
        tone: "coral",
        list: absentRanked,
        formatCount: (item: any) =>
          item.lastContactedCount > 0
            ? `${formatAbsenceCount(item.activeAbsence)} جديدة (إجمالي غيابه: ${ar(item.absent)})`
            : formatAbsenceCount(item.activeAbsence),
        contactType: "absence" as const,
      };
    }
    if (detailsCategory === "all") {
      return {
        title: "جميع الطلاب الذين لديهم عدم تسميع",
        countLabel: "طالب بحاجة لمتابعة",
        icon: "book",
        tone: "amber",
        list: notHeardAllRanked,
        formatCount: (item: any) =>
          `لم يسمع حفظ: ${ar(item.activeMemCount)} · لم يسمع مراجعة: ${ar(item.activeRevCount)}`,
        contactType: "notHeard" as const,
      };
    }
    if (detailsCategory === "both") {
      return {
        title: "الطلاب الذين لم يسمعوا الحفظ والمراجعة في اليوم نفسه",
        countLabel: "طالب بحاجة لمتابعة",
        icon: "book",
        tone: "amber",
        list: notHeardBothRanked,
        formatCount: (item: any) =>
          `${formatNotHeardCount(item.activeCount)} (حفظ ومراجعة معًا)`,
        contactType: "notHeard" as const,
      };
    }
    if (detailsCategory === "mem") {
      return {
        title: "قائمة الطلاب الذين لم يسمعوا الحفظ",
        countLabel: "طالب بحاجة لمتابعة",
        icon: "book",
        tone: "grape",
        list: notHeardMemRanked,
        formatCount: (item: any) =>
          item.lastContactedCount > 0
            ? `${formatNotHeardCount(item.activeCount)} جديدة (إجمالي: ${ar(item.notHeardMem)} حفظ)`
            : `${formatNotHeardCount(item.activeCount)} (حفظ)`,
        contactType: "notHeard" as const,
      };
    }
    if (detailsCategory === "rev") {
      return {
        title: "قائمة الطلاب الذين لم يسمعوا المراجعة",
        countLabel: "طالب بحاجة لمتابعة",
        icon: "refresh",
        tone: "grape",
        list: notHeardRevRanked,
        formatCount: (item: any) =>
          item.lastContactedCount > 0
            ? `${formatNotHeardCount(item.activeCount)} جديدة (إجمالي: ${ar(item.notHeardRev)} مراجعة)`
            : `${formatNotHeardCount(item.activeCount)} (مراجعة)`,
        contactType: "notHeard" as const,
      };
    }
    return null;
  }, [detailsCategory, absentRanked, notHeardAllRanked, notHeardBothRanked, notHeardMemRanked, notHeardRevRanked]);

  const filteredModalList = useMemo(() => {
    if (!activeCategoryData) return [];
    if (!modalSearch.trim()) return activeCategoryData.list;
    const q = normalizeArabic(modalSearch);
    return activeCategoryData.list.filter((s: any) => normalizeArabic(s.name).includes(q));
  }, [activeCategoryData, modalSearch]);

  /**
   * إجراء التواصل عبر واتساب مع التحقق من الرقم ونقل الطالب تلقائيًا إلى الأرشيف
   */
  const handleContactWhatsApp = (
    item: StudentMetrics & { activeAbsence?: number; activeCount?: number },
    category: "absence" | "notHeard",
    specificRecitationType?: "all" | "both" | "mem" | "rev"
  ) => {
    const stObj = students.find((s) => s.id === item.id);
    const rawPhone = stObj?.guardianPhone;

    if (!rawPhone || !rawPhone.trim()) {
      toast("error", "لا يوجد رقم ولي أمر مسجل لهذا الطالب. يمكنك إضافة الرقم من بيانات الطالب.");
      return;
    }

    const formatted = formatPhoneForWhatsApp(rawPhone);
    if (!formatted) {
      toast("error", "تعذر فتح WhatsApp لهذا الرقم. يرجى التأكد من صحة رقم ولي الأمر وأن الرقم مسجل على WhatsApp.");
      return;
    }

    const template =
      category === "absence"
        ? (contactMessages?.absence || DEFAULT_ABSENCE_MESSAGE)
        : (contactMessages?.notHeard || DEFAULT_NOT_HEARD_MESSAGE);

    const typeKey = specificRecitationType || notHeardTab;
    const recitationType =
      typeKey === "all"
        ? "الحفظ أو المراجعة"
        : typeKey === "both"
        ? "الحفظ والمراجعة معًا"
        : typeKey === "mem"
        ? "الحفظ"
        : "المراجعة";

    const msg = fillTemplate(template, {
      studentName: item.name,
      recitationType,
      absenceCount: item.absent,
      date: formatHijriDate(new Date(), { day: "numeric", month: "long" }),
    });

    const url = `https://wa.me/${formatted}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");

    // نقل الطالب تلقائيًا إلى الأرشيف بعد بدء التواصل عبر واتساب بنجاح مع حفظ لقطة الحالة
    recordParentContact({
      studentId: item.id,
      studentName: item.name,
      studentPhoto: item.photo,
      guardianPhone: rawPhone.trim(),
      type: category,
      contactDateIso: localDateKey(new Date()),
      contactDateHijri: formatHijriDate(new Date(), { day: "numeric", month: "long", year: "numeric" }),
      absenceCountAtContact: item.absent,
      notHeardBothAtContact: item.notHeardBoth,
      notHeardMemAtContact: item.notHeardMem,
      notHeardRevAtContact: item.notHeardRev,
      statusText: "تم التواصل عبر واتساب",
    });
  };

  return (
    <div className="space-y-5 anim-fade">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHead
          title="إحصائيات الطلاب والحلقات"
          desc="إحصائيات دقيقة وفورية مبنية على السجلات الفعلية للطلاب فقط — مع فصل إحصائيات الحفظ عن المراجعة والترتيب التلقائي حسب الصفحات"
          icon="chart"
        />
        <button
          type="button"
          onClick={() => setShowMessageSettings(true)}
          className="flex items-center gap-2 rounded-2xl border-2 border-grape-200 bg-white px-4 py-2.5 text-xs font-black text-grape-700 shadow-sm hover:border-grape-400 hover:bg-grape-50 transition active:scale-95"
          title="تخصيص نص رسائل الواتساب للغائبين والذين لم يسمعوا"
        >
          <Icon name="settings" className="h-4 w-4 text-grape-600" />
          <span>إعدادات رسائل WhatsApp</span>
        </button>
      </div>

      <div className="rounded-3xl border border-grape-200 bg-white p-4">
        {/* مبدلات الفترة */}
        <div className="flex flex-wrap gap-2">
          {(["daily", "weekly", "monthly", "all"] as Period[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPeriod(item)}
              className={`rounded-xl px-4 py-2 text-sm font-extrabold transition ${
                period === item ? "bg-grape-600 text-white shadow" : "bg-grape-50 text-grape-600 hover:bg-grape-100"
              }`}
            >
              {item === "daily" ? "يومية" : item === "weekly" ? "أسبوعية" : item === "monthly" ? "شهرية" : "إجمالية"}
            </button>
          ))}
        </div>

        {/* فلاتر: الحلقة + البحث عن طالب + اختيار الطالب + اليوم/الأسبوع/الشهر */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* فلتر الحلقة */}
          <label className="text-xs font-extrabold text-grape-600">
            الحلقة
            <select
              value={halaqaId}
              onChange={(e) => {
                setHalaqaId(e.target.value);
                setStudentId("all");
              }}
              className="field-control mt-1 w-full"
            >
              <option value="all">جميع الحلقات ({ar(students.length)} طالب)</option>
              {halaqas.map((h) => {
                const count = students.filter((s) => s.halaqaId === h.id).length;
                return (
                  <option key={h.id} value={h.id}>
                    {h.name} ({ar(count)} طالب)
                  </option>
                );
              })}
              {students.some((s) => !s.halaqaId) && (
                <option value="none">
                  بلا حلقة ({ar(students.filter((s) => !s.halaqaId).length)} طالب)
                </option>
              )}
            </select>
          </label>

          {/* مربع البحث عن طالب */}
          <label className="text-xs font-extrabold text-grape-600">
            بحث عن طالب
            <div className="relative mt-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setStudentId("all");
                }}
                placeholder="اكتب اسم الطالب..."
                className="field-control w-full pe-8"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 end-2 flex items-center text-xs font-extrabold text-grape-400 hover:text-coral-500"
                >
                  ✕
                </button>
              )}
            </div>
          </label>

          {/* اختيار طالب محدد من القائمة */}
          <label className="text-xs font-extrabold text-grape-600">
            اختيار طالب
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="field-control mt-1 w-full"
            >
              <option value="all">
                {searchQuery
                  ? `الطلاب المطابقون للبحث (${ar(searchedStudents.length)})`
                  : `جميع طلاب ${currentHalaqaName} (${ar(currentStudents.length)})`}
              </option>
              {searchedStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </label>

          {/* اليوم (في اليومية) */}
          {period === "daily" && (
            <label className="text-xs font-extrabold text-grape-600">
              اليوم
              <select
                value={day}
                onChange={(e) => setDay(e.target.value as DayKey)}
                className="field-control mt-1 w-full"
              >
                {DAYS.map((item, index) => (
                  <option key={item.key} value={item.key}>
                    {item.label} · {formatHijriDate(addCalendarDays(weekStartDateIso, index), { day: "numeric", month: "long" })}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* الأسبوع (في الأسبوعية) */}
          {period === "weekly" && (
            <label className="text-xs font-extrabold text-grape-600">
              الأسبوع
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="field-control mt-1 w-full"
              >
                <option value="current">الأسبوع الحالي ({formatTeachingWeek(weekStartDateIso)})</option>
                {uniqueLogs.map((log) => (
                  <option key={log.week} value={log.week}>
                    {log.weekStartDateIso ? formatTeachingWeek(log.weekStartDateIso) : (log.name || `أسبوع محفوظ رقم ${ar(log.week)}`)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* الشهر (في الشهرية) */}
          {period === "monthly" && (
            <label className="text-xs font-extrabold text-grape-600">
              الشهر الهجري
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="field-control mt-1 w-full"
              >
                {monthOptions.map(([key, date]) => (
                  <option key={key} value={key}>
                    {formatHijriMonth(date)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {/* بطاقات الإحصائيات الشاملة */}
      <section>
        <div className="mb-3 flex items-center gap-3">
          {selectedStudent && <Avatar photo={selectedStudent.photo} name={selectedStudent.name} size={46} />}
          <div>
            <h3 className="font-display text-xl font-extrabold text-ink">
              {selectedStudent ? selectedStudent.name : `ملخص ${currentHalaqaName}`}
            </h3>
            <p className="text-xs font-bold text-grape-500">
              {period === "daily"
                ? `بيانات يوم ${DAYS.find((item) => item.key === day)?.label}`
                : period === "weekly"
                ? selectedWeek === "current"
                  ? `بيانات الأسبوع الحالي (${ar(week)})`
                  : `بيانات الأسبوع المختار (${ar(selectedWeek)})`
                : period === "monthly"
                ? "بيانات الشهر الهجري المحدد"
                : "من أول سجل متاح حتى الآن (جميع الأسابيع الماضية + الأسبوع الحالي)"}
            </p>
          </div>
        </div>

        {/* 4 بطاقات تفاعلية رئيسية: الغائبون | كلاهما | لم يسمعوا الحفظ | لم يسمعوا المراجعة (العدد مطابق 100% للقائمة) */}
        <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setDetailsCategory("absent")}
            className="group rounded-2xl border-2 border-coral-200 bg-white p-4 text-start transition hover:border-coral-400 hover:bg-coral-50/40 hover:shadow-sm"
            title="اضغط لفتح القائمة الكاملة للطلاب الغائبين"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-black text-coral-700">
                <Icon name="alert" className="h-4 w-4 shrink-0" />
                الطلاب الغائبون
              </span>
              <span className="rounded-full bg-coral-100 px-2 py-0.5 text-[10px] font-black text-coral-800 group-hover:bg-coral-200 transition">
                عرض القائمة ↲
              </span>
            </div>
            <p className="mt-2 font-display text-2xl font-black text-coral-700">
              {ar(absentRanked.length)} <span className="text-xs font-bold text-coral-600">طالب</span>
            </p>
            <p className="mt-1 text-[11px] font-bold text-grape-500">
              إجمالي {ar(total.absent)} حالة غياب مسجلة
            </p>
          </button>

          <button
            type="button"
            onClick={() => setDetailsCategory("both")}
            className="group rounded-2xl border-2 border-amber-200 bg-white p-4 text-start transition hover:border-amber-400 hover:bg-amber-50/40 hover:shadow-sm"
            title="اضغط لفتح القائمة الكاملة للطلاب الذين لم يسمعوا الحفظ والمراجعة معًا"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-black text-amber-800">
                <Icon name="book" className="h-4 w-4 shrink-0" />
                لم يسمع كلاهما معًا
              </span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-900 group-hover:bg-amber-200 transition">
                عرض القائمة ↲
              </span>
            </div>
            <p className="mt-2 font-display text-2xl font-black text-amber-800">
              {ar(notHeardBothRanked.length)} <span className="text-xs font-bold text-amber-700">طالب</span>
            </p>
            <p className="mt-1 text-[11px] font-bold text-grape-500">
              إجمالي {ar(total.notHeardBoth)} يوم لم يُسمّع فيه الاثنين
            </p>
          </button>

          <button
            type="button"
            onClick={() => setDetailsCategory("mem")}
            className="group rounded-2xl border-2 border-grape-200 bg-white p-4 text-start transition hover:border-grape-400 hover:bg-grape-50/40 hover:shadow-sm"
            title="اضغط لفتح القائمة الكاملة للطلاب الذين لم يسمعوا الحفظ"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-black text-grape-700">
                <Icon name="book" className="h-4 w-4 shrink-0" />
                لم يسمعوا الحفظ
              </span>
              <span className="rounded-full bg-grape-100 px-2 py-0.5 text-[10px] font-black text-grape-800 group-hover:bg-grape-200 transition">
                عرض القائمة ↲
              </span>
            </div>
            <p className="mt-2 font-display text-2xl font-black text-grape-700">
              {ar(notHeardMemRanked.length)} <span className="text-xs font-bold text-grape-600">طالب</span>
            </p>
            <p className="mt-1 text-[11px] font-bold text-grape-500">
              إجمالي {ar(total.notHeardMem)} حالة عدم تسميع حفظ
            </p>
          </button>

          <button
            type="button"
            onClick={() => setDetailsCategory("rev")}
            className="group rounded-2xl border-2 border-grape-200 bg-white p-4 text-start transition hover:border-grape-400 hover:bg-grape-50/40 hover:shadow-sm"
            title="اضغط لفتح القائمة الكاملة للطلاب الذين لم يسمعوا المراجعة"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-black text-grape-700">
                <Icon name="refresh" className="h-4 w-4 shrink-0" />
                لم يسمعوا المراجعة
              </span>
              <span className="rounded-full bg-grape-100 px-2 py-0.5 text-[10px] font-black text-grape-800 group-hover:bg-grape-200 transition">
                عرض القائمة ↲
              </span>
            </div>
            <p className="mt-2 font-display text-2xl font-black text-grape-700">
              {ar(notHeardRevRanked.length)} <span className="text-xs font-bold text-grape-600">طالب</span>
            </p>
            <p className="mt-1 text-[11px] font-bold text-grape-500">
              إجمالي {ar(total.notHeardRev)} حالة عدم تسميع مراجعة
            </p>
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon="users" label="إجمالي الطلاب" value={ar(metrics.length)} tone="grape" />
          <MetricCard icon="check" label="الحضور" value={ar(total.present)} tone="mint" />
          <MetricCard icon="alert" label="الغياب" value={ar(total.absent)} tone={total.absent ? "coral" : "grape"} />
          <MetricCard icon="shield" label="نسبة الحضور" value={`${ar(attendanceRate)}٪`} tone="mint" />

          <MetricCard icon="book" label="جلسات الحفظ" value={ar(total.memorizationSessions)} />
          <MetricCard icon="refresh" label="جلسات المراجعة" value={ar(total.reviewSessions)} />
          <MetricCard icon="book" label="صفحات الحفظ" value={n(total.memorizationPages)} tone="gold" />
          <MetricCard icon="refresh" label="صفحات المراجعة" value={n(total.reviewPages)} tone="gold" />

          <MetricCard icon="chart" label="آيات الحفظ" value={ar(total.memorizationVerses)} />
          <MetricCard icon="chart" label="أسطر الحفظ" value={n(total.memorizationLines)} />
        </div>
      </section>

      {/* ملخص الطالب الفردي */}
      {selectedAnalysis && (
        <section className="rounded-3xl border border-grape-200 bg-white p-5">
          <h3 className="font-display text-lg font-extrabold text-ink">
            ملخص أداء الطالب: {selectedStudent?.name}
          </h3>
          <p className="mt-2 text-sm font-bold leading-7 text-grape-600">
            الحضور هذا الأسبوع: {ar(selectedAnalysis.attendanceDays)} · الغياب: {ar(selectedAnalysis.absenceDays)} · مجموع صفحات الحفظ تاريخيًا: {n(selectedAnalysis.cumulativeMemorizationPages)} · مجموع صفحات المراجعة تاريخيًا: {n(selectedAnalysis.cumulativeReviewPages)}
          </p>
        </section>
      )}

      {/* قسم إحصائيات الطلاب الغائبين والطلاب الذين حصلوا على "لم يسمع" مع إمكانية الطي والتوسعة والتواصل عبر واتساب */}
      <section className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          {/* 1. قسم الطلاب الغائبون */}
          <div className="flex flex-col rounded-3xl border border-grape-200 bg-white p-4 sm:p-5 shadow-sm">
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggleCollapse("absent")}
              className="flex cursor-pointer select-none flex-col items-stretch gap-3 border-b border-grape-100 pb-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-coral-50 text-coral-600">
                  <Icon name="alert" className="h-5 w-5" strokeWidth={2.2} />
                </span>
                <div>
                  <h4 className="font-display text-base font-extrabold text-ink flex items-center gap-2">
                    <span>الطلاب الغائبون</span>
                    <span className="rounded-full bg-coral-100 px-2.5 py-0.5 text-xs font-black text-coral-800">
                      {ar(absentRanked.length)} طالب
                    </span>
                  </h4>
                  <p className="text-xs font-bold text-grape-500 mt-0.5">
                    مرتبون من الأكثر غيابًا إلى الأقل غيابًا (الحالات النشطة بحاجة لمتابعة)
                  </p>
                </div>
              </div>
              <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailsCategory("absent");
                  }}
                  className="min-h-10 flex-1 rounded-xl border border-coral-200 bg-coral-50/60 px-3 py-2 text-xs font-black text-coral-700 transition hover:bg-coral-100 sm:min-h-0 sm:flex-none sm:py-1.5"
                >
                  فتح التفاصيل ↲
                </button>
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-grape-50 text-grape-600 transition hover:bg-grape-100">
                  {collapsed.absent ? "▼" : "▲"}
                </span>
              </div>
            </div>

            {!collapsed.absent && (
              <div className="mt-3 flex-1 anim-fade">
                {absentRanked.length > 0 ? (
                  <div className="max-h-[380px] overflow-y-auto space-y-2 pe-1">
                    {absentRanked.map((item, idx) => {
                      const stObj = students.find((s) => s.id === item.id);
                      const trend = stObj ? analyzeStudentTrend(stObj, weeksLog, parentContacts) : null;
                      const hasPhone = Boolean(stObj?.guardianPhone?.trim());

                      return (
                        <div
                          key={item.id}
                          className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-grape-100 bg-grape-50/30 p-2.5 hover:bg-grape-50/80 transition"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-black text-grape-600 border border-grape-200 shadow-sm shrink-0">
                              {ar(idx + 1)}
                            </span>
                            <Avatar photo={item.photo} name={item.name} size={34} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-extrabold text-ink">{item.name}</span>
                                {trend && (
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-black border ${
                                      trend.tone === "mint"
                                        ? "bg-mint-50 border-mint-200 text-mint-700"
                                        : trend.tone === "coral"
                                        ? "bg-coral-50 border-coral-200 text-coral-600"
                                        : "bg-grape-50 border-grape-200 text-grape-600"
                                    }`}
                                    title={trend.explanation}
                                  >
                                    {trend.label}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                <span className="text-[11px] font-bold text-coral-600">
                                  {item.lastContactedCount > 0 ? (
                                    <span>{formatAbsenceCount(item.activeAbsence)} جديدة (إجمالي غيابه: {ar(item.absent)})</span>
                                  ) : (
                                    <span>{formatAbsenceCount(item.activeAbsence)}</span>
                                  )}
                                </span>
                                {hasPhone ? (
                                  <span className="text-[10px] font-mono text-grape-400">
                                    📱 {stObj?.guardianPhone}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-coral-400">
                                    (لا يوجد رقم مسجل)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleContactWhatsApp(item, "absence")}
                            className="flex items-center gap-1.5 rounded-xl bg-grape-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-sm hover:bg-grape-700 transition active:scale-95 shrink-0 ms-auto sm:ms-0"
                            title="التواصل مع ولي الأمر عبر واتساب ونقل الحالة إلى الأرشيف"
                          >
                            <Icon name="check" className="h-3.5 w-3.5" />
                            <span>تواصل مع ولي الأمر</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex h-36 items-center justify-center rounded-2xl border-2 border-dashed border-grape-100 bg-grape-50/40 p-4 text-center text-xs font-bold text-grape-400">
                    {searchQuery ? `لا يوجد طالب غائب يطابق «${searchQuery}»` : "لا توجد حالات غياب نشطة بحاجة لمتابعة حاليًا (جميع الحالات عولجت بالتواصل أو لا يوجد غياب) 👏"}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. قسم الطلاب الذين حصلوا على "لم يسمع" */}
          <div className="flex flex-col rounded-3xl border border-grape-200 bg-white p-4 sm:p-5 shadow-sm">
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggleCollapse("notHeard")}
              className="flex cursor-pointer select-none flex-col items-stretch gap-3 border-b border-grape-100 pb-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-50 text-amber-600">
                  <Icon name="book" className="h-5 w-5" strokeWidth={2.2} />
                </span>
                <div>
                  <h4 className="font-display text-base font-extrabold text-ink flex items-center gap-2">
                    <span>الطلاب الذين حصلوا على «لم يسمع»</span>
                  </h4>
                  <p className="text-xs font-bold text-grape-500 mt-0.5">
                    مرتبون من الأكثر إلى الأقل (حاضر ولم يُسمّع — حالات بحاجة لمتابعة)
                  </p>
                </div>
              </div>
              <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailsCategory(notHeardTab);
                  }}
                  className="min-h-10 flex-1 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs font-black text-amber-800 transition hover:bg-amber-100 sm:min-h-0 sm:flex-none sm:py-1.5"
                >
                  فتح التفاصيل ↲
                </button>
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-grape-50 text-grape-600 transition hover:bg-grape-100">
                  {collapsed.notHeard ? "▼" : "▲"}
                </span>
              </div>
            </div>

            {!collapsed.notHeard && (
              <div className="anim-fade mt-3 flex flex-col flex-1">
                {/* تبويبات الأقسام الثلاثة: الكل | حفظ | مراجعة (الكل بلا تكرار للطالب) */}
                <div className="flex items-center gap-1.5 rounded-xl bg-grape-100/70 p-1">
                  <button
                    type="button"
                    onClick={() => setNotHeardTab("all")}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-extrabold transition ${
                      notHeardTab === "all"
                        ? "bg-grape-600 text-white shadow-sm"
                        : "text-grape-700 hover:bg-white/60"
                    }`}
                  >
                    الكل ({ar(notHeardAllRanked.length)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotHeardTab("mem")}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-extrabold transition ${
                      notHeardTab === "mem"
                        ? "bg-grape-600 text-white shadow-sm"
                        : "text-grape-700 hover:bg-white/60"
                    }`}
                  >
                    حفظ ({ar(notHeardMemRanked.length)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotHeardTab("rev")}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-extrabold transition ${
                      notHeardTab === "rev"
                        ? "bg-grape-600 text-white shadow-sm"
                        : "text-grape-700 hover:bg-white/60"
                    }`}
                  >
                    مراجعة ({ar(notHeardRevRanked.length)})
                  </button>
                </div>

                <div className="mt-3 flex-1">
                  {(() => {
                    const currentList =
                      notHeardTab === "all"
                        ? notHeardAllRanked
                        : notHeardTab === "mem"
                        ? notHeardMemRanked
                        : notHeardRevRanked;

                    const labelSuffix =
                      notHeardTab === "all"
                        ? "الكل"
                        : notHeardTab === "mem"
                        ? "حفظ"
                        : "مراجعة";

                    if (currentList.length === 0) {
                      return (
                        <div className="flex h-36 items-center justify-center rounded-2xl border-2 border-dashed border-grape-100 bg-grape-50/40 p-4 text-center text-xs font-bold text-grape-400">
                          لا يوجد طلاب بحاجة لمتابعة في «لم يسمع ({labelSuffix})» لهذه الفترة 🎉
                        </div>
                      );
                    }

                    return (
                      <div className="max-h-[380px] overflow-y-auto space-y-2 pe-1">
                        {currentList.map((item, idx) => {
                          const stObj = students.find((s) => s.id === item.id);
                          const trend = stObj ? analyzeStudentTrend(stObj, weeksLog, parentContacts) : null;
                          const hasPhone = Boolean(stObj?.guardianPhone?.trim());
                          const totalVal =
                            notHeardTab === "mem"
                              ? item.notHeardMem
                              : item.notHeardRev;

                          return (
                            <div
                              key={item.id}
                              className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-grape-100 bg-grape-50/30 p-2.5 hover:bg-grape-50/80 transition"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-black text-grape-600 border border-grape-200 shadow-sm shrink-0">
                                  {ar(idx + 1)}
                                </span>
                                <Avatar photo={item.photo} name={item.name} size={34} />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate text-sm font-extrabold text-ink">{item.name}</span>
                                    {trend && (
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-[10px] font-black border ${
                                          trend.tone === "mint"
                                            ? "bg-mint-50 border-mint-200 text-mint-700"
                                            : trend.tone === "coral"
                                            ? "bg-coral-50 border-coral-200 text-coral-600"
                                            : "bg-grape-50 border-grape-200 text-grape-600"
                                        }`}
                                        title={trend.explanation}
                                      >
                                        {trend.label}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                    <span className="text-[11px] font-bold text-amber-700">
                                      {notHeardTab === "all" ? (
                                        <span>لم يسمع حفظ: {ar(item.activeMemCount)} · لم يسمع مراجعة: {ar(item.activeRevCount)}</span>
                                      ) : item.lastContactedCount > 0 ? (
                                        <span>{formatNotHeardCount(item.activeCount)} جديدة (إجمالي: {ar(totalVal)} {labelSuffix})</span>
                                      ) : (
                                        <span>{formatNotHeardCount(item.activeCount)} ({labelSuffix})</span>
                                      )}
                                    </span>
                                    {hasPhone ? (
                                      <span className="text-[10px] font-mono text-grape-400">
                                        📱 {stObj?.guardianPhone}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-bold text-coral-400">
                                        (لا يوجد رقم مسجل)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleContactWhatsApp(item, "notHeard", notHeardTab)}
                                className="flex items-center gap-1.5 rounded-xl bg-grape-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-sm hover:bg-grape-700 transition active:scale-95 shrink-0 ms-auto sm:ms-0"
                                title="التواصل مع ولي الأمر عبر واتساب ونقل الحالة إلى الأرشيف"
                              >
                                <Icon name="check" className="h-3.5 w-3.5" />
                                <span>تواصل مع ولي الأمر</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. أقسام الأرشيف: أرشيف الغائبين + أرشيف الذين لم يسمعوا مع إمكانية الطي والتوسعة وإعادة الطالب للقائمة */}
        <div className="rounded-3xl border border-grape-200 bg-white p-4 sm:p-5 shadow-sm">
          <div
            role="button"
            tabIndex={0}
            onClick={() => toggleCollapse("archive")}
            className="flex cursor-pointer select-none flex-wrap items-center justify-between gap-3 border-b border-grape-100 pb-3"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-grape-100 text-grape-700">
                <Icon name="archive" className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <div>
                <h4 className="font-display text-base font-extrabold text-ink flex items-center gap-2">
                  <span>أرشيف متابعة وتواصل أولياء الأمور</span>
                  <span className="rounded-full bg-grape-100 px-2.5 py-0.5 text-xs font-black text-grape-800">
                    {ar(absenceArchive.length + notHeardArchive.length)} حالة مؤرشفة
                  </span>
                </h4>
                <p className="text-xs font-bold text-grape-500 mt-0.5">
                  سجل الحالات التي تم التواصل بشأنها مع الاحتفاظ الدائم بالبيانات الفعلية وقت التواصل
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* أزرار التبديل بين أرشيف الغائبين وأرشيف لم يسمع */}
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 rounded-xl bg-grape-100/70 p-1"
              >
                <button
                  type="button"
                  onClick={() => setArchiveTab("absence")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                    archiveTab === "absence"
                      ? "bg-coral-500 text-white shadow-sm"
                      : "text-grape-700 hover:bg-white/60"
                  }`}
                >
                  أرشيف الغائبين ({ar(absenceArchive.length)})
                </button>
                <button
                  type="button"
                  onClick={() => setArchiveTab("notHeard")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                    archiveTab === "notHeard"
                      ? "bg-amber-500 text-ink shadow-sm"
                      : "text-grape-700 hover:bg-white/60"
                  }`}
                >
                  أرشيف الذين لم يسمعوا ({ar(notHeardArchive.length)})
                </button>
              </div>
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-grape-50 text-grape-600 transition hover:bg-grape-100">
                {collapsed.archive ? "▼" : "▲"}
              </span>
            </div>
          </div>

          {!collapsed.archive && (
            <div className="mt-4 anim-fade">
              {archiveTab === "absence" ? (
                <div>
                  {absenceArchive.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {absenceArchive.map((rec) => {
                        const stObj = students.find((s) => s.id === rec.studentId || normalizeArabic(s.name) === normalizeArabic(rec.studentName));
                        const trend = stObj ? analyzeStudentTrend(stObj, weeksLog, parentContacts) : null;
                        const phone = rec.guardianPhone || stObj?.guardianPhone;

                        return (
                          <div
                            key={rec.id}
                            className="flex flex-col justify-between rounded-2xl border-2 border-grape-100 bg-grape-50/20 p-3.5 hover:border-grape-200 transition"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2 border-b border-grape-100/70 pb-2">
                                <div className="flex items-center gap-2">
                                  <Avatar photo={rec.studentPhoto ?? stObj?.photo ?? null} name={rec.studentName} size={34} />
                                  <div>
                                    <p className="font-display text-sm font-extrabold text-ink">{rec.studentName}</p>
                                    <p className="text-[10px] font-bold text-grape-400">تاريخ التواصل: {rec.contactDateHijri}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => { if (window.confirm(`هل تريد حذف سجل التواصل مع ولي أمر ${rec.studentName}؟`)) removeParentContact(rec.id); }}
                                  className="text-grape-400 hover:text-coral-500 text-xs font-extrabold px-1"
                                  title="حذف هذا السجل من الأرشيف"
                                >
                                  ✕
                                </button>
                              </div>

                              <div className="mt-2.5 space-y-1 text-xs">
                                <p className="font-extrabold text-coral-700">
                                  الغياب: {ar(rec.absenceCountAtContact ?? 0)} مرات (وقت التواصل)
                                </p>
                                {phone && (
                                  <p className="font-mono text-[11px] text-grape-500">
                                    📱 {phone}
                                  </p>
                                )}
                                <p className="font-bold text-mint-700 flex items-center gap-1">
                                  <Icon name="check" className="h-3.5 w-3.5" />
                                  <span>الحالة: {rec.statusText}</span>
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-grape-100/80 flex items-center justify-between gap-2">
                              {trend ? (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-black border ${
                                    trend.tone === "mint"
                                      ? "bg-mint-50 border-mint-200 text-mint-700"
                                      : trend.tone === "coral"
                                      ? "bg-coral-50 border-coral-200 text-coral-600"
                                      : "bg-grape-50 border-grape-200 text-grape-600"
                                  }`}
                                  title={trend.explanation}
                                >
                                  {trend.label}
                                </span>
                              ) : <span />}

                              <button
                                type="button"
                                onClick={() => { if (window.confirm(`هل تريد إعادة حالة ${rec.studentName} إلى القائمة النشطة؟`)) removeParentContact(rec.id); }}
                                className="flex items-center gap-1 rounded-xl border border-grape-200 bg-white px-2.5 py-1 text-xs font-black text-grape-600 hover:border-grape-400 hover:bg-grape-50 shadow-sm transition active:scale-95"
                                title="إلغاء أرشفة هذا التواصل وإعادة الطالب للقائمة النشطة"
                              >
                                <Icon name="refresh" className="h-3 w-3" />
                                <span>إعادة إلى القائمة</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="p-8 text-center text-xs font-bold text-grape-400">
                      لا توجد حالات مسجلة في أرشيف الغائبين حتى الآن.
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  {notHeardArchive.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {notHeardArchive.map((rec) => {
                        const stObj = students.find((s) => s.id === rec.studentId || normalizeArabic(s.name) === normalizeArabic(rec.studentName));
                        const trend = stObj ? analyzeStudentTrend(stObj, weeksLog, parentContacts) : null;
                        const phone = rec.guardianPhone || stObj?.guardianPhone;

                        return (
                          <div
                            key={rec.id}
                            className="flex flex-col justify-between rounded-2xl border-2 border-grape-100 bg-grape-50/20 p-3.5 hover:border-grape-200 transition"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2 border-b border-grape-100/70 pb-2">
                                <div className="flex items-center gap-2">
                                  <Avatar photo={rec.studentPhoto ?? stObj?.photo ?? null} name={rec.studentName} size={34} />
                                  <div>
                                    <p className="font-display text-sm font-extrabold text-ink">{rec.studentName}</p>
                                    <p className="text-[10px] font-bold text-grape-400">تاريخ التواصل: {rec.contactDateHijri}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => { if (window.confirm(`هل تريد حذف سجل التواصل مع ولي أمر ${rec.studentName}؟`)) removeParentContact(rec.id); }}
                                  className="text-grape-400 hover:text-coral-500 text-xs font-extrabold px-1"
                                  title="حذف هذا السجل من الأرشيف"
                                >
                                  ✕
                                </button>
                              </div>

                              <div className="mt-2.5 space-y-1 text-xs">
                                <p className="font-bold text-ink">
                                  لم يسمع الحفظ: <strong className="text-amber-800">{ar(rec.notHeardMemAtContact ?? 0)}</strong> · المراجعة: <strong className="text-amber-800">{ar(rec.notHeardRevAtContact ?? 0)}</strong> · كلاهما: <strong className="text-amber-800">{ar(rec.notHeardBothAtContact ?? 0)}</strong>
                                </p>
                                {phone && (
                                  <p className="font-mono text-[11px] text-grape-500">
                                    📱 {phone}
                                  </p>
                                )}
                                <p className="font-bold text-mint-700 flex items-center gap-1">
                                  <Icon name="check" className="h-3.5 w-3.5" />
                                  <span>الحالة: {rec.statusText}</span>
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-grape-100/80 flex items-center justify-between gap-2">
                              {trend ? (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-black border ${
                                    trend.tone === "mint"
                                      ? "bg-mint-50 border-mint-200 text-mint-700"
                                      : trend.tone === "coral"
                                      ? "bg-coral-50 border-coral-200 text-coral-600"
                                      : "bg-grape-50 border-grape-200 text-grape-600"
                                  }`}
                                  title={trend.explanation}
                                >
                                  {trend.label}
                                </span>
                              ) : <span />}

                              <button
                                type="button"
                                onClick={() => { if (window.confirm(`هل تريد إعادة حالة ${rec.studentName} إلى القائمة النشطة؟`)) removeParentContact(rec.id); }}
                                className="flex items-center gap-1 rounded-xl border border-grape-200 bg-white px-2.5 py-1 text-xs font-black text-grape-600 hover:border-grape-400 hover:bg-grape-50 shadow-sm transition active:scale-95"
                                title="إلغاء أرشفة هذا التواصل وإعادة الطالب للقائمة النشطة"
                              >
                                <Icon name="refresh" className="h-3 w-3" />
                                <span>إعادة إلى القائمة</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="p-8 text-center text-xs font-bold text-grape-400">
                      لا توجد حالات مسجلة في أرشيف الذين لم يسمعوا حتى الآن.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* شريط التبديل بين عرض الحفظ والمراجعة */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-1.5 rounded-2xl bg-grape-100/70 p-1">
          <button
            type="button"
            onClick={() => setStatsView("both")}
            className={`rounded-xl px-4 py-2 text-xs font-extrabold transition ${
              statsView === "both"
                ? "bg-grape-600 text-white shadow-sm"
                : "text-grape-700 hover:bg-white/60"
            }`}
          >
            عرض القسمين معًا
          </button>
          <button
            type="button"
            onClick={() => setStatsView("memorization")}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
              statsView === "memorization"
                ? "bg-gold-500 text-ink shadow-sm"
                : "text-grape-700 hover:bg-white/60"
            }`}
          >
            <Icon name="book" className="h-4 w-4" />
            قسم إحصائيات الحفظ فقط
          </button>
          <button
            type="button"
            onClick={() => setStatsView("review")}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
              statsView === "review"
                ? "bg-grape-600 text-white shadow-sm"
                : "text-grape-700 hover:bg-white/60"
            }`}
          >
            <Icon name="refresh" className="h-4 w-4" />
            قسم إحصائيات المراجعة فقط
          </button>
        </div>
        <div className="text-xs font-bold text-grape-500">
          {statsView === "both"
            ? "يتم عرض إحصائيات الحفظ أولًا ثم إحصائيات المراجعة، مع الترتيب التنازلي التلقائي لكل قسم"
            : statsView === "memorization"
            ? "الطلاب مرتبون تلقائيًا من الأكثر صفحات حفظ إلى الأقل"
            : "الطلاب مرتبون تلقائيًا من الأكثر صفحات مراجعة إلى الأقل"}
        </div>
      </div>

      {/* 1. قسم إحصائيات الحفظ (منفصل ومرتب من الأكثر إلى الأقل حسب صفحات الحفظ) */}
      {(statsView === "both" || statsView === "memorization") && (
        <section className="overflow-x-auto rounded-3xl border border-grape-200 bg-white p-4 sm:p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gold-400/20 text-gold-600">
                <Icon name="book" className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <div>
                <h4 className="font-display text-lg font-extrabold text-ink flex items-center gap-2">
                  <span>إحصائيات الحفظ</span>
                  <span className="rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-black text-gold-800">
                    مرتبة من الأكثر إلى الأقل
                  </span>
                </h4>
                <p className="text-xs font-bold text-grape-500 mt-0.5">
                  الطالب صاحب أكبر عدد صفحات حفظ يظهر أولًا ({ar(sortedMemorization.length)} طالب)
                </p>
              </div>
            </div>
            {searchQuery && (
              <span className="rounded-full bg-gold-400/20 px-3 py-1 text-xs font-bold text-gold-700">
                تصفية حسب: «{searchQuery}»
              </span>
            )}
          </div>

          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-grape-100 text-right text-xs font-extrabold text-grape-500">
                <th className="p-2.5 text-center w-12">#</th>
                <th className="p-2.5">الطالب</th>
                <th className="p-2.5 text-center bg-gold-50/60 rounded-t-xl text-gold-800 font-black">
                  إجمالي صفحات الحفظ
                </th>
                <th className="p-2.5 text-center">جلسات الحفظ</th>
                <th className="p-2.5 text-center">آيات الحفظ</th>
                <th className="p-2.5 text-center">أسطر الحفظ</th>
                <th className="p-2.5 text-center">أيام الحضور</th>
                <th className="p-2.5 text-center">أيام الغياب</th>
              </tr>
            </thead>
            <tbody>
              {sortedMemorization.map((item) => (
                <tr key={item.id} className="border-b border-grape-50 hover:bg-grape-50/40 transition">
                  <td className="p-2.5 text-center font-display font-extrabold">
                    {item.rank === 1 && item.memorizationPages > 0 ? (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gold-400 text-xs font-black text-ink shadow-sm">
                        1
                      </span>
                    ) : item.rank === 2 && item.memorizationPages > 0 ? (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-black text-slate-700 shadow-sm">
                        2
                      </span>
                    ) : item.rank === 3 && item.memorizationPages > 0 ? (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-600/20 text-xs font-black text-amber-800 shadow-sm">
                        3
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-grape-400">{ar(item.rank ?? 0)}</span>
                    )}
                  </td>
                  <td className="p-2.5 font-extrabold text-ink flex items-center gap-2.5">
                    <Avatar photo={item.photo} name={item.name} size={30} />
                    <span className="text-sm font-extrabold">{item.name}</span>
                  </td>
                  <td className="p-2.5 text-center font-display text-base font-extrabold text-gold-600 bg-gold-50/30">
                    {n(item.memorizationPages)}
                  </td>
                  <td className="p-2.5 text-center font-bold text-ink">{ar(item.memorizationSessions)}</td>
                  <td className="p-2.5 text-center font-bold text-grape-600">{ar(item.memorizationVerses)}</td>
                  <td className="p-2.5 text-center font-bold text-grape-600">{n(item.memorizationLines)}</td>
                  <td className="p-2.5 text-center font-bold text-mint-600">{ar(item.present)}</td>
                  <td className="p-2.5 text-center font-bold text-coral-600">{ar(item.absent)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {sortedMemorization.length === 0 && (
            <p className="p-6 text-center text-sm font-bold text-grape-400">
              {searchQuery ? `لا يوجد طالب يطابق «${searchQuery}»` : "لا توجد بيانات حفظ مسجلة لهذه الفترة."}
            </p>
          )}
        </section>
      )}

      {/* 2. قسم إحصائيات المراجعة (منفصل ومرتب من الأكثر إلى الأقل حسب صفحات المراجعة) */}
      {(statsView === "both" || statsView === "review") && (
        <section className="overflow-x-auto rounded-3xl border border-grape-200 bg-white p-4 sm:p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-grape-100 text-grape-700">
                <Icon name="refresh" className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <div>
                <h4 className="font-display text-lg font-extrabold text-ink flex items-center gap-2">
                  <span>إحصائيات المراجعة</span>
                  <span className="rounded-full bg-grape-100 px-2.5 py-0.5 text-xs font-black text-grape-800">
                    مرتبة من الأكثر إلى الأقل
                  </span>
                </h4>
                <p className="text-xs font-bold text-grape-500 mt-0.5">
                  الطالب صاحب أكبر عدد صفحات مراجعة يظهر أولًا ({ar(sortedReview.length)} طالب)
                </p>
              </div>
            </div>
            {searchQuery && (
              <span className="rounded-full bg-gold-400/20 px-3 py-1 text-xs font-bold text-gold-700">
                تصفية حسب: «{searchQuery}»
              </span>
            )}
          </div>

          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-grape-100 text-right text-xs font-extrabold text-grape-500">
                <th className="p-2.5 text-center w-12">#</th>
                <th className="p-2.5">الطالب</th>
                <th className="p-2.5 text-center bg-grape-50/60 rounded-t-xl text-grape-800 font-black">
                  إجمالي صفحات المراجعة
                </th>
                <th className="p-2.5 text-center">جلسات المراجعة</th>
                <th className="p-2.5 text-center">أيام الحضور</th>
                <th className="p-2.5 text-center">أيام الغياب</th>
              </tr>
            </thead>
            <tbody>
              {sortedReview.map((item) => (
                <tr key={item.id} className="border-b border-grape-50 hover:bg-grape-50/40 transition">
                  <td className="p-2.5 text-center font-display font-extrabold">
                    {item.rank === 1 && item.reviewPages > 0 ? (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gold-400 text-xs font-black text-ink shadow-sm">
                        1
                      </span>
                    ) : item.rank === 2 && item.reviewPages > 0 ? (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-black text-slate-700 shadow-sm">
                        2
                      </span>
                    ) : item.rank === 3 && item.reviewPages > 0 ? (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-600/20 text-xs font-black text-amber-800 shadow-sm">
                        3
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-grape-400">{ar(item.rank ?? 0)}</span>
                    )}
                  </td>
                  <td className="p-2.5 font-extrabold text-ink flex items-center gap-2.5">
                    <Avatar photo={item.photo} name={item.name} size={30} />
                    <span className="text-sm font-extrabold">{item.name}</span>
                  </td>
                  <td className="p-2.5 text-center font-display text-base font-extrabold text-grape-700 bg-grape-50/30">
                    {n(item.reviewPages)}
                  </td>
                  <td className="p-2.5 text-center font-bold text-ink">{ar(item.reviewSessions)}</td>
                  <td className="p-2.5 text-center font-bold text-mint-600">{ar(item.present)}</td>
                  <td className="p-2.5 text-center font-bold text-coral-600">{ar(item.absent)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {sortedReview.length === 0 && (
            <p className="p-6 text-center text-sm font-bold text-grape-400">
              {searchQuery ? `لا يوجد طالب يطابق «${searchQuery}»` : "لا توجد بيانات مراجعة مسجلة لهذه الفترة."}
            </p>
          )}
        </section>
      )}

      {/* نافذة التفاصيل الشاملة المنبثقة Modal عند فتح قائمة أي بطاقة إحصائية */}
      {activeCategoryData && (
        <Modal open onClose={() => { setDetailsCategory(null); setModalSearch(""); }} wide>
          <div className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-grape-100 pb-4">
              <div className="flex items-center gap-3">
                <span className={`grid h-12 w-12 place-items-center rounded-2xl ${
                  activeCategoryData.tone === "coral" ? "bg-coral-50 text-coral-600" : activeCategoryData.tone === "amber" ? "bg-amber-50 text-amber-600" : "bg-grape-100 text-grape-700"
                }`}>
                  <Icon name={activeCategoryData.icon} className="h-6 w-6" strokeWidth={2.2} />
                </span>
                <div>
                  <h3 className="font-display text-xl font-extrabold text-ink flex items-center gap-2">
                    <span>{activeCategoryData.title}</span>
                    <span className={`rounded-full px-3 py-0.5 text-xs font-black ${
                      activeCategoryData.tone === "coral" ? "bg-coral-100 text-coral-800" : activeCategoryData.tone === "amber" ? "bg-amber-100 text-amber-900" : "bg-grape-100 text-grape-800"
                    }`}>
                      {modalSearch.trim() ? `عرض ${ar(filteredModalList.length)} من أصل ${ar(activeCategoryData.list.length)} طالب` : `${ar(activeCategoryData.list.length)} طالب`}
                    </span>
                  </h3>
                  <p className="text-xs font-bold text-grape-500 mt-1">
                    البيانات مستخرجة بدقة 100% من السجلات الأصلية الفعلية للفترة المحددة ({currentHalaqaName})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setDetailsCategory(null); setModalSearch(""); }}
                className="rounded-full p-2 text-grape-400 hover:bg-grape-100 hover:text-ink transition"
              >
                ✕
              </button>
            </div>

            {/* حقل البحث داخل النافذة */}
            <div className="relative">
              <input
                type="text"
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                placeholder="تصفية الطلاب في هذه القائمة بالاسم..."
                className="field-control w-full pe-8"
              />
              {modalSearch && (
                <button
                  type="button"
                  onClick={() => setModalSearch("")}
                  className="absolute inset-y-0 end-2 flex items-center text-xs font-extrabold text-grape-400 hover:text-coral-500"
                >
                  ✕
                </button>
              )}
            </div>

            {/* قائمة الطلاب في النافذة المنبثقة (مطابقة 100% لنفس مصفوفة البطاقة) */}
            <div className="max-h-[460px] overflow-y-auto space-y-2.5 pe-1">
              {filteredModalList.length > 0 ? (
                filteredModalList.map((item: any, idx: number) => {
                  const stObj = students.find((s) => s.id === item.id);
                  const trend = stObj ? analyzeStudentTrend(stObj, weeksLog, parentContacts) : null;
                  const hasPhone = Boolean(stObj?.guardianPhone?.trim());
                  const halaqaName = halaqas.find((h) => h.id === item.halaqaId)?.name;

                  return (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-grape-100 bg-grape-50/30 p-3 hover:bg-grape-50/80 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-black text-grape-600 border border-grape-200 shadow-sm shrink-0">
                          {ar(idx + 1)}
                        </span>
                        <Avatar photo={item.photo} name={item.name} size={38} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-base font-extrabold text-ink">{item.name}</span>
                            {halaqaName && (
                              <span className="rounded-full bg-grape-100 px-2 py-0.5 text-[10px] font-bold text-grape-700">
                                {halaqaName}
                              </span>
                            )}
                            {trend && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-black border ${
                                  trend.tone === "mint"
                                    ? "bg-mint-50 border-mint-200 text-mint-700"
                                    : trend.tone === "coral"
                                    ? "bg-coral-50 border-coral-200 text-coral-600"
                                    : "bg-grape-50 border-grape-200 text-grape-600"
                                }`}
                                title={trend.explanation}
                              >
                                {trend.label}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className={`text-xs font-black ${
                              activeCategoryData.tone === "coral" ? "text-coral-600" : activeCategoryData.tone === "amber" ? "text-amber-800" : "text-grape-700"
                            }`}>
                              {activeCategoryData.formatCount(item)}
                            </span>
                            {hasPhone ? (
                              <span className="text-[11px] font-mono text-grape-500">
                                📱 {stObj?.guardianPhone}
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold text-coral-400">
                                (لا يوجد رقم ولي أمر)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleContactWhatsApp(item, activeCategoryData.contactType, detailsCategory !== "absent" ? (detailsCategory as any) : undefined)}
                        className="flex items-center gap-1.5 rounded-xl bg-grape-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-grape-700 transition active:scale-95 shrink-0 ms-auto sm:ms-0"
                      >
                        <Icon name="check" className="h-4 w-4" />
                        <span>تواصل مع ولي الأمر</span>
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-sm font-bold text-grape-400">
                  {modalSearch ? `لا يوجد طالب يطابق «${modalSearch}» في هذه القائمة.` : "لا توجد حالات بحاجة لمتابعة في هذه الفئة."}
                </div>
              )}
            </div>

            <div className="border-t border-grape-100 pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => { setDetailsCategory(null); setModalSearch(""); }}
                className="rounded-xl bg-grape-100 px-5 py-2 text-xs font-extrabold text-grape-700 hover:bg-grape-200 transition"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* نافذة إعدادات رسائل الواتساب */}
      {showMessageSettings && (
        <Modal open onClose={() => setShowMessageSettings(false)} wide>
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-grape-100 pb-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-grape-100 text-grape-700">
                  <Icon name="settings" className="h-5 w-5" strokeWidth={2.2} />
                </span>
                <div>
                  <h3 className="font-display text-lg font-extrabold text-ink">إعدادات رسائل التواصل عبر WhatsApp</h3>
                  <p className="text-xs font-bold text-grape-500">تخصيص نص الرسائل التلقائية لأولياء الأمور مع دعم المتغيرات</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMessageSettings(false)}
                className="rounded-full p-2 text-grape-400 hover:bg-grape-100 hover:text-ink transition"
              >
                ✕
              </button>
            </div>

            <div className="rounded-2xl border border-grape-200 bg-grape-50/40 p-3.5 text-xs font-bold text-grape-600">
              <p className="font-extrabold text-grape-800 mb-1">المتغيرات التلقائية المتاحة داخل نص الرسالة:</p>
              <p className="leading-6">
                <code className="rounded bg-white px-1.5 py-0.5 border border-grape-200 text-grape-800">{"{اسم الطالب}"}</code> اسم الطالب &bull;{" "}
                <code className="rounded bg-white px-1.5 py-0.5 border border-grape-200 text-grape-800">{"{نوع التسميع}"}</code> حفظ / مراجعة / الحفظ والمراجعة &bull;{" "}
                <code className="rounded bg-white px-1.5 py-0.5 border border-grape-200 text-grape-800">{"{عدد الغيابات}"}</code> عدد مرات الغياب &bull;{" "}
                <code className="rounded bg-white px-1.5 py-0.5 border border-grape-200 text-grape-800">{"{التاريخ}"}</code> تاريخ اليوم الهجري
              </p>
            </div>

            {/* 1. رسالة الغائبين */}
            <div className="space-y-2 rounded-2xl border-2 border-coral-100 bg-white p-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-extrabold text-coral-700 flex items-center gap-2">
                  <Icon name="alert" className="h-4 w-4" />
                  <span>رسالة التواصل مع أولياء أمور الغائبين</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    resetContactMessage("absence");
                    setAbsenceTemplateInput(DEFAULT_ABSENCE_MESSAGE);
                  }}
                  className="text-xs font-bold text-grape-500 hover:text-coral-600 underline"
                >
                  استعادة النص الافتراضي
                </button>
              </div>
              <textarea
                rows={4}
                value={absenceTemplateInput}
                onChange={(e) => setAbsenceTemplateInput(e.target.value)}
                className="field-control w-full text-sm leading-relaxed"
                placeholder="اكتب نص رسالة الغائبين هنا..."
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setContactMessage("absence", absenceTemplateInput)}
                  className="rounded-xl bg-coral-500 px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-coral-600 transition"
                >
                  حفظ رسالة الغائبين
                </button>
              </div>
            </div>

            {/* 2. رسالة الذين لم يسمعوا */}
            <div className="space-y-2 rounded-2xl border-2 border-amber-100 bg-white p-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-extrabold text-amber-800 flex items-center gap-2">
                  <Icon name="book" className="h-4 w-4" />
                  <span>رسالة التواصل مع أولياء أمور الذين لم يسمعوا</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    resetContactMessage("notHeard");
                    setNotHeardTemplateInput(DEFAULT_NOT_HEARD_MESSAGE);
                  }}
                  className="text-xs font-bold text-grape-500 hover:text-amber-800 underline"
                >
                  استعادة النص الافتراضي
                </button>
              </div>
              <textarea
                rows={4}
                value={notHeardTemplateInput}
                onChange={(e) => setNotHeardTemplateInput(e.target.value)}
                className="field-control w-full text-sm leading-relaxed"
                placeholder="اكتب نص رسالة الذين لم يسمعوا هنا..."
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setContactMessage("notHeard", notHeardTemplateInput)}
                  className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-extrabold text-ink shadow-sm hover:bg-amber-600 transition"
                >
                  حفظ رسالة لم يسمعوا
                </button>
              </div>
            </div>

            <div className="flex justify-end border-t border-grape-100 pt-3">
              <button
                type="button"
                onClick={() => setShowMessageSettings(false)}
                className="rounded-xl bg-grape-100 px-5 py-2 text-xs font-extrabold text-grape-700 hover:bg-grape-200 transition"
              >
                تم وإغلاق
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
