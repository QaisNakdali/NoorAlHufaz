/* إحصائيات الطلاب فقط — قراءة مباشرة من الكشف الحالي وأرشيف الأسابيع مع دعم الفلترة حسب الحلقة والبحث عن طالب */
import { useMemo, useState } from "react";
import { useApp } from "../appState";
import { analyzeStudent, measureStudentWork } from "../analytics";
import { ar, DAYS, type DayKey, type Student, type WeekLog, type WeekLogEntry, type WeekStudentRecord } from "../core";
import Avatar from "./Avatar";
import { Icon, SectionHead } from "./ui";
import { addCalendarDays, dateFromLocalKey, formatHijriDate, formatHijriMonth, hijriMonthKey } from "../hijriDate";
import { roundUpToQuarter } from "../statisticsNumber";

type Period = "daily" | "weekly" | "monthly" | "all";
type StudentMetrics = {
  id: string; name: string; photo: string | null; halaqaId?: string | null;
  present: number; absent: number; memorizationSessions: number; reviewSessions: number;
  memorizationVerses: number; reviewVerses: number; memorizationLines: number; reviewLines: number;
  memorizationPages: number; reviewPages: number;
};

const emptyMetrics = (student: Pick<Student, "id" | "name" | "photo" | "halaqaId">): StudentMetrics => ({
  id: student.id, name: student.name, photo: student.photo, halaqaId: student.halaqaId,
  present: 0, absent: 0, memorizationSessions: 0, reviewSessions: 0,
  memorizationVerses: 0, reviewVerses: 0, memorizationLines: 0, reviewLines: 0,
  memorizationPages: 0, reviewPages: 0,
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
});

const normalizeArabic = (text: string): string => {
  return text
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim()
    .toLowerCase();
};

function fromRecord(record: WeekStudentRecord, day?: DayKey): StudentMetrics {
  const result = emptyMetrics(record);
  const selected = day ? DAYS.filter((item) => item.key === day) : DAYS;
  for (const item of selected) {
    const state = record.days[item.key];
    const ward = record.ward[item.key];
    if (state.a) result.present += 1;
    if (state.absent) result.absent += 1;
    if (state.h && !state.absent) {
      result.memorizationSessions += 1;
      result.memorizationVerses += ward.memorizationVerses || 0;
      result.memorizationLines += ward.memorizationLines || 0;
    }
    if (state.r && !state.absent) {
      result.reviewSessions += 1;
      result.reviewVerses += ward.reviewVerses || 0;
      result.reviewLines += ward.reviewLines || 0;
    }
  }
  result.memorizationPages = result.memorizationLines / 15;
  result.reviewPages = result.reviewLines / 15;
  return result;
}

function fromStudent(student: Student, day?: DayKey): StudentMetrics {
  const result = fromRecord({
    id: student.id,
    name: student.name,
    photo: student.photo,
    halaqaId: student.halaqaId,
    days: student.days,
    recitationRatings: student.recitationRatings ?? { sun: {}, mon: {}, tue: {}, wed: {} },
    ward: student.ward,
    hearts: student.hearts,
    heartsLostWeek: student.heartsLostWeek,
    xp: student.xp,
    coins: student.coins,
  }, day);
  if (!day) {
    const memorization = measureStudentWork(student, "memorization");
    const review = measureStudentWork(student, "review");
    result.memorizationPages = memorization.pages;
    result.reviewPages = review.pages;
    result.memorizationLines = memorization.lines;
    result.reviewLines = review.lines;
  }
  return result;
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
  }
  return result;
}

function logDate(log: WeekLog): Date | null {
  return log.weekStartDateIso ? dateFromLocalKey(log.weekStartDateIso) : log.savedAtIso ? new Date(log.savedAtIso) : null;
}

function fromEntry(entry: WeekLogEntry): StudentMetrics {
  return {
    id: entry.id, name: entry.name, photo: null,
    present: 0, absent: 0,
    memorizationSessions: entry.memorizationSessions ?? 0,
    reviewSessions: entry.reviewSessions ?? 0,
    memorizationVerses: entry.memorizationVerses ?? 0,
    reviewVerses: entry.reviewVerses ?? 0,
    memorizationLines: entry.memorizationLines ?? 0,
    reviewLines: entry.reviewLines ?? 0,
    memorizationPages: entry.memorizationPages ?? 0,
    reviewPages: entry.reviewPages ?? 0,
  };
}

function logMetrics(log: WeekLog): StudentMetrics[] {
  return log.records?.length
    ? log.records.map((record) => fromRecord(record))
    : (log.students ?? log.top).map(fromEntry);
}

function MetricCard({ icon, label, value, tone = "grape" }: { icon: string; label: string; value: string; tone?: "grape" | "mint" | "coral" | "gold" }) {
  const colors = {
    grape: "border-grape-200 text-grape-600",
    mint: "border-mint-200 text-mint-700",
    coral: "border-coral-200 text-coral-600",
    gold: "border-gold-200 text-gold-700"
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
  const { students, weeksLog, halaqas, week, weekStartDateIso } = useApp();
  const [period, setPeriod] = useState<Period>("weekly");
  const [studentId, setStudentId] = useState("all");
  const [halaqaId, setHalaqaId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [day, setDay] = useState<DayKey>("sun");
  const [selectedWeek, setSelectedWeek] = useState("current");

  const monthOptions = useMemo(() => {
    const dates = [
      dateFromLocalKey(weekStartDateIso) ?? new Date(),
      ...weeksLog.map(logDate).filter((date): date is Date => !!date)
    ];
    const map = new Map<string, Date>();
    dates.forEach((date) => map.set(hijriMonthKey(date), date));
    return [...map.entries()].sort((a, b) => b[1].getTime() - a[1].getTime());
  }, [weeksLog, weekStartDateIso]);

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

  // حساب المقاييس والإحصائيات استنادًا إلى الحلقة والفترة والطلاب
  const rawMetrics = useMemo(() => {
    let rows: StudentMetrics[] = [];
    if (period === "daily") {
      rows = currentStudents.map((student) => fromStudent(student, day));
    }
    if (period === "weekly") {
      if (selectedWeek === "current") {
        rows = currentStudents.map((student) => fromStudent(student));
      } else {
        const log = weeksLog.find((item) => item.week === Number(selectedWeek));
        rows = log ? logMetrics(log) : [];
      }
    }
    if (period === "monthly" || period === "all") {
      const sourceLogs = period === "monthly"
        ? weeksLog.filter((log) => {
            const date = logDate(log);
            return date && hijriMonthKey(date) === selectedMonth;
          })
        : weeksLog;
      const map = new Map<string, StudentMetrics>();
      for (const student of currentStudents) map.set(student.id, emptyMetrics(student));
      for (const row of sourceLogs.flatMap(logMetrics)) {
        if (map.has(row.id)) {
          map.set(row.id, add(map.get(row.id)!, row));
        }
      }
      if (period === "all") {
        for (const student of currentStudents) {
          map.set(student.id, add(map.get(student.id) ?? emptyMetrics(student), fromStudent(student)));
        }
      } else if (selectedMonth === hijriMonthKey(dateFromLocalKey(weekStartDateIso) ?? new Date())) {
        for (const student of currentStudents) {
          map.set(student.id, add(map.get(student.id) ?? emptyMetrics(student), fromStudentHijriMonth(student, selectedMonth, weekStartDateIso)));
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
  }, [period, currentStudents, day, selectedWeek, selectedMonth, weeksLog, halaqaId, weekStartDateIso]);

  // تصفية النتائج بحسب الطالب المحدد أو نص البحث
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

  const total = useMemo(() => {
    return metrics.reduce((sum, item) => add(sum, item), {
      id: "total", name: "الإجمالي", photo: null,
      present: 0, absent: 0, memorizationSessions: 0, reviewSessions: 0,
      memorizationVerses: 0, reviewVerses: 0, memorizationLines: 0, reviewLines: 0,
      memorizationPages: 0, reviewPages: 0
    });
  }, [metrics]);

  const selectedStudent = useMemo(() => {
    if (studentId !== "all") return students.find((s) => s.id === studentId);
    if (searchQuery.trim() && metrics.length === 1) return students.find((s) => s.id === metrics[0].id);
    return null;
  }, [studentId, searchQuery, metrics, students]);

  const selectedAnalysis = selectedStudent ? analyzeStudent(selectedStudent, weeksLog) : null;

  const currentHalaqaName = useMemo(() => {
    if (halaqaId === "all") return "جميع الحلقات";
    if (halaqaId === "none") return "الطلاب بلا حلقة";
    return halaqas.find((h) => h.id === halaqaId)?.name ?? "الحلقة المختارة";
  }, [halaqaId, halaqas]);

  const totalSessions = total.present + total.absent;
  const attendanceRate = totalSessions > 0 ? Math.round((total.present / totalSessions) * 100) : 0;

  return (
    <div className="space-y-5 anim-fade">
      <SectionHead
        title="إحصائيات الطلاب والحلقات"
        desc="إحصائيات دقيقة وفورية مبنية على السجلات الفعلية للطلاب فقط — مع إمكانية الفلترة حسب الحلقة والبحث بالاسم"
        icon="chart"
      />

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
                {searchQuery ? `الطلاب المطابقون للبحث (${ar(searchedStudents.length)})` : `جميع طلاب ${currentHalaqaName} (${ar(currentStudents.length)})`}
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
                <option value="current">الأسبوع الحالي ({ar(week)})</option>
                {weeksLog.map((log) => (
                  <option key={log.week} value={log.week}>
                    {log.name || `الأسبوع ${ar(log.week)}`}
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
                ? (selectedWeek === "current" ? `بيانات الأسبوع الحالي (${ar(week)})` : `بيانات الأسبوع المختار (${ar(selectedWeek)})`)
                : period === "monthly"
                ? "بيانات الشهر الهجري المحدد"
                : "من أول سجل متاح حتى الآن"}
            </p>
          </div>
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
          <MetricCard icon="chart" label="آيات المراجعة" value={ar(total.reviewVerses)} />
          <MetricCard icon="chart" label="أسطر الحفظ" value={n(total.memorizationLines)} />
          <MetricCard icon="chart" label="أسطر المراجعة" value={n(total.reviewLines)} />
        </div>
      </section>

      {/* جدول تفاصيل الطلاب */}
      {studentId === "all" && (
        <section className="overflow-x-auto rounded-3xl border border-grape-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-display text-base font-extrabold text-ink">
              تفاصيل الطلاب ({ar(metrics.length)} طالب)
            </h4>
            {searchQuery && (
              <span className="rounded-full bg-gold-400/20 px-3 py-1 text-xs font-bold text-gold-700">
                تصفية حسب: «{searchQuery}»
              </span>
            )}
          </div>
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-grape-100 text-right text-xs font-extrabold text-grape-500">
                <th className="p-2">الطالب</th>
                <th className="p-2">حضور</th>
                <th className="p-2">غياب</th>
                <th className="p-2">جلسات الحفظ</th>
                <th className="p-2">جلسات المراجعة</th>
                <th className="p-2">صفحات الحفظ</th>
                <th className="p-2">صفحات المراجعة</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((item) => (
                <tr key={item.id} className="border-b border-grape-50 hover:bg-grape-50/40 transition">
                  <td className="p-2 font-extrabold text-ink flex items-center gap-2">
                    <Avatar photo={item.photo} name={item.name} size={28} />
                    {item.name}
                  </td>
                  <td className="p-2 font-bold text-mint-600">{ar(item.present)}</td>
                  <td className="p-2 font-bold text-coral-600">{ar(item.absent)}</td>
                  <td className="p-2 font-bold">{ar(item.memorizationSessions)}</td>
                  <td className="p-2 font-bold">{ar(item.reviewSessions)}</td>
                  <td className="p-2 font-bold text-gold-600">{n(item.memorizationPages)}</td>
                  <td className="p-2 font-bold text-gold-600">{n(item.reviewPages)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {metrics.length === 0 && (
            <p className="p-6 text-center text-sm font-bold text-grape-400">
              {searchQuery ? `لا يوجد طالب يطابق «${searchQuery}»` : "لا توجد بيانات فعلية لهذه الفترة في هذه الحلقة."}
            </p>
          )}
        </section>
      )}

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
    </div>
  );
}
