/* صفحة الإحصائيات — تحليل شامل لمستوى الطلاب والحضور والغياب */
import { useMemo, useState } from "react";
import { useApp } from "../appState";
import { ar, DAYS, estimatedLinesFromVerses, type Student } from "../core";
import Avatar from "./Avatar";
import { Icon, Modal, SectionHead } from "./ui";

type AttendanceStats = {
  studentId: string;
  name: string;
  photo: string | null;
  attendanceDays: number;
  absenceDays: number;
  attendanceRate: number;
  lastPresentDate: Date | null;
  lastAbsentDate: Date | null;
  consecutiveAttendance: number;
  frequentAbsence: boolean; // غياب 3 أيام أو أكثر في الشهر
};

type WeeklyMemorizationStats = {
  studentId: string;
  name: string;
  photo: string | null;
  totalVerses: number;
  memorizationDays: number;
  averageVersesPerDay: number;
  successfulRecitations: number;
  failedRecitations: number;
  successRate: number;
  bestDayVerses: number;
  totalLines: number;
  totalPages: number;
  averageLinesPerDay: number;
  averagePagesPerDay: number;
  trend: "improving" | "stable" | "declining" | "insufficient-data";
  performanceStatus: "excellent" | "good" | "needs-attention";
};

type OverallStudentStats = {
  student: Student;
  attendance: AttendanceStats;
  weeklyMemorization: WeeklyMemorizationStats;
  summary: string;
  statusIndicators: {
    frequentAbsence: boolean;
    decliningMemorization: boolean;
    lowSuccessRate: boolean;
    improving: boolean;
    excellent: boolean;
  };
};

/** حساب إحصائيات الحضور والغياب للطالب */
function calculateAttendanceStats(student: Student): AttendanceStats {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  let attendanceDays = 0;
  let absenceDays = 0;
  let lastPresentDate: Date | null = null;
  let lastAbsentDate: Date | null = null;
  let consecutiveAttendance = 0;
  
  // حساب الأيام من بداية الشهر حتى الآن
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const today = now.getDate();
  
  // نفترض أن أيام الحلقة هي الأحد والاثنين والأربعاء (3 أيام أسبوعيًا)
  // هذا تبسيط - يمكن تعديله حسب جدول الحلقة الفعلي
  let expectedDays = 0;
  for (let d = 1; d <= today; d++) {
    const date = new Date(now.getFullYear(), now.getMonth(), d);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 1 || dayOfWeek === 3) { // أحد، اثنين، أربعاء
      expectedDays++;
    }
  }
  
  // حساب الحضور من سجلات الأسبوع الحالي
  DAYS.forEach(day => {
    if (student.days[day.key].a) {
      attendanceDays++;
      // تقريب تاريخ آخر حضور (نفترض أن الأسبوع الحالي بدأ منذ أقل من أسبوع)
      const daysAgo = ["sun", "mon", "tue", "wed"].indexOf(day.key);
      const presentDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      if (!lastPresentDate || presentDate > lastPresentDate) {
        lastPresentDate = presentDate;
      }
    } else {
      // يعتبر غياب إذا كان اليوم قد مر
      const daysAgo = ["sun", "mon", "tue", "wed"].indexOf(day.key);
      const absentDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      if (absentDate <= now) {
        absenceDays++;
        if (!lastAbsentDate || absentDate > lastAbsentDate) {
          lastAbsentDate = absentDate;
        }
      }
    }
  });
  
  // حساب الحضور المتتالي
  const dayOrder = ["sun", "mon", "tue", "wed"];
  for (let i = 0; i < dayOrder.length; i++) {
    if (student.days[dayOrder[i] as keyof typeof student.days].a) {
      consecutiveAttendance++;
    } else {
      break;
    }
  }
  
  const totalDays = attendanceDays + absenceDays;
  const attendanceRate = totalDays > 0 ? (attendanceDays / totalDays) * 100 : 0;
  const frequentAbsence = absenceDays >= 3;
  
  return {
    studentId: student.id,
    name: student.name,
    photo: student.photo,
    attendanceDays,
    absenceDays,
    attendanceRate,
    lastPresentDate,
    lastAbsentDate,
    consecutiveAttendance,
    frequentAbsence,
  };
}

/** حساب إحصائيات الحفظ الأسبوعية */
function calculateWeeklyMemorizationStats(student: Student): WeeklyMemorizationStats {
  const records = student.memorizationRecords || [];
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // بداية الأسبوع (الأحد)
  startOfWeek.setHours(0, 0, 0, 0);
  
  const weekRecords = records.filter(r => {
    const recordDate = new Date(r.date);
    return recordDate >= startOfWeek;
  });
  
  const plannedDays = DAYS.filter((d) => student.ward[d.key].memorization || student.ward[d.key].memorizationVerses > 0);
  const completedPlannedDays = plannedDays.filter((d) => student.days[d.key].h);
  const totalLines = completedPlannedDays.reduce((sum, d) => sum + estimatedLinesFromVerses(student.ward[d.key].memorizationVerses), 0);
  const totalPages = totalLines / 15;
  
  const totalVerses = weekRecords.reduce((sum, r) => sum + r.versesCount, 0);
  const successfulRecitations = completedPlannedDays.length || weekRecords.filter(r => r.success).length;
  const failedRecitations = Math.max(0, plannedDays.length - completedPlannedDays.length);
  const successRate = plannedDays.length > 0 ? (completedPlannedDays.length / plannedDays.length) * 100 : (weekRecords.length > 0 ? (weekRecords.filter(r => r.success).length / weekRecords.length) * 100 : 0);
  
  // تجميع الآيات المحفوظة في كل يوم
  const versesByDate: Record<string, number> = {};
  weekRecords.forEach(r => {
    const dateKey = r.date.split('T')[0];
    versesByDate[dateKey] = (versesByDate[dateKey] || 0) + r.versesCount;
  });
  
  const memorizationDays = completedPlannedDays.length || Object.keys(versesByDate).length;
  const averageVersesPerDay = memorizationDays > 0 ? totalVerses / memorizationDays : 0;
  const bestDayVerses = Math.max(...Object.values(versesByDate), 0);
  
  // تحديد الاتجاه (trend) بناءً على مقارنة النصف الأول والثاني من الأسبوع
  const dates = Object.keys(versesByDate).sort();
  let trend: "improving" | "stable" | "declining" | "insufficient-data" = "insufficient-data";
  
  if (dates.length >= 4) {
    const mid = Math.floor(dates.length / 2);
    const firstHalf = dates.slice(0, mid).reduce((sum, d) => sum + versesByDate[d], 0) / mid;
    const secondHalf = dates.slice(mid).reduce((sum, d) => sum + versesByDate[d], 0) / (dates.length - mid);
    
    const change = ((secondHalf - firstHalf) / firstHalf) * 100;
    if (change > 15) trend = "improving";
    else if (change < -15) trend = "declining";
    else trend = "stable";
  } else if (dates.length >= 2) {
    trend = "stable";
  }
  
  // تحديد حالة الأداء
  let performanceStatus: "excellent" | "good" | "needs-attention" = "needs-attention";
  const hasMeasuredWork = totalLines > 0 || totalPages > 0 || totalVerses > 0;
  if (successRate >= 80 && hasMeasuredWork) {
    performanceStatus = "excellent";
  } else if (successRate >= 60 && hasMeasuredWork) {
    performanceStatus = "good";
  }
  
  return {
    studentId: student.id,
    name: student.name,
    photo: student.photo,
    totalVerses,
    memorizationDays,
    averageVersesPerDay,
    successfulRecitations,
    failedRecitations,
    successRate,
    bestDayVerses,
    totalLines,
    totalPages,
    averageLinesPerDay: memorizationDays > 0 ? totalLines / memorizationDays : 0,
    averagePagesPerDay: memorizationDays > 0 ? totalPages / memorizationDays : 0,
    trend,
    performanceStatus,
  };
}

/** توليد ملخص نصي لحالة الطالب */
function generateStudentSummary(
  attendance: AttendanceStats,
  memorization: WeeklyMemorizationStats
): string {
  const parts: string[] = [];
  
  // جزء الحضور
  if (attendance.attendanceRate >= 90) {
    parts.push("التزام ممتاز بالحضور");
  } else if (attendance.attendanceRate >= 75) {
    parts.push("حضور جيد");
  } else if (attendance.frequentAbsence) {
    parts.push("⚠️ غياب متكرر يحتاج متابعة");
  } else {
    parts.push("حضور متوسط");
  }
  
  // جزء الحفظ
  if (memorization.trend === "improving") {
    parts.push("مستوى الحفظ في تحسن");
  } else if (memorization.trend === "declining") {
    parts.push("⚠️ تراجع في مستوى الحفظ");
  } else if (memorization.trend === "stable" && memorization.averageVersesPerDay >= 3) {
    parts.push("مستوى الحفظ مستقر");
  } else if (memorization.trend === "insufficient-data") {
    parts.push("بيانات غير كافية للتحليل");
  }
  
  // جزء التسميع
  if (memorization.successRate >= 80) {
    parts.push("نسبة نجاح التسميع مرتفعة");
  } else if (memorization.successRate >= 60) {
    parts.push("نسبة نجاح التسميع جيدة");
  } else if (memorization.successRate > 0) {
    parts.push("⚠️ يحتاج تحسين في التسميع");
  }
  
  if (parts.length === 0) {
    return "بيانات غير كافية للتحليل";
  }
  
  return parts.join("، ") + ".";
}

/** بطاقة طالب مع إحصائياته */
function StudentStatCard({ stats }: { stats: OverallStudentStats }) {
  const [showDetails, setShowDetails] = useState(false);
  
  const statusColor = 
    stats.statusIndicators.excellent ? "border-mint-500 bg-mint-50/50" :
    stats.statusIndicators.frequentAbsence || stats.statusIndicators.decliningMemorization ? "border-coral-400 bg-coral-50/50" :
    stats.statusIndicators.lowSuccessRate || stats.statusIndicators.improving ? "border-gold-400 bg-gold-50/50" :
    "border-grape-200 bg-white";
  
  return (
    <>
      <div className={`anim-slide-up rounded-3xl border-2 p-5 transition-all hover:shadow-lg ${statusColor}`}>
        <div className="flex items-start gap-4">
          <Avatar 
            photo={stats.student.photo} 
            name={stats.student.name} 
            size={64} 
            frame={stats.student.frame} 
            crown={stats.student.crown} 
            glow={stats.student.glow} 
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-xl font-extrabold text-ink truncate">{stats.student.name}</h3>
            <p className="text-sm font-bold text-grape-600 mt-1">{generateStudentSummary(stats.attendance, stats.weeklyMemorization)}</p>
            
            {/* مؤشرات الحالة السريعة */}
            <div className="flex flex-wrap gap-2 mt-2">
              {stats.statusIndicators.frequentAbsence && (
                <span className="flex items-center gap-1 rounded-full bg-coral-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
                  <Icon name="alert" className="h-3 w-3" /> غياب متكرر
                </span>
              )}
              {stats.statusIndicators.decliningMemorization && (
                <span className="flex items-center gap-1 rounded-full bg-orange-400 px-2 py-0.5 text-[10px] font-extrabold text-white">
                  <Icon name="trendingDown" className="h-3 w-3" /> تراجع الحفظ
                </span>
              )}
              {stats.statusIndicators.improving && (
                <span className="flex items-center gap-1 rounded-full bg-mint-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
                  <Icon name="trendingUp" className="h-3 w-3" /> يتحسن
                </span>
              )}
              {stats.statusIndicators.excellent && (
                <span className="flex items-center gap-1 rounded-full bg-gold-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
                  <Icon name="star" fill className="h-3 w-3" /> ممتاز
                </span>
              )}
            </div>
          </div>
          
          <button
            type="button"
            onClick={() => setShowDetails(true)}
            className="grid h-10 w-10 place-items-center rounded-full bg-grape-100 text-grape-600 transition hover:bg-grape-200"
            title="عرض التفاصيل"
          >
            <Icon name="chart" className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </div>
        
        {/* ملخص سريع */}
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t-2 border-dashed border-grape-200">
          <div className="text-center">
            <p className="text-xs font-bold text-grape-500">الحضور</p>
            <p className={`font-display text-lg font-extrabold ${stats.attendance.attendanceRate >= 75 ? 'text-mint-600' : 'text-coral-500'}`}>
              {ar(Math.round(stats.attendance.attendanceRate))}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs font-bold text-grape-500">آيات الأسبوع</p>
            <p className="font-display text-lg font-extrabold text-grape-600">{ar(stats.weeklyMemorization.totalVerses)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-bold text-grape-500">نسبة النجاح</p>
            <p className={`font-display text-lg font-extrabold ${stats.weeklyMemorization.successRate >= 70 ? 'text-mint-600' : 'text-gold-600'}`}>
              {ar(Math.round(stats.weeklyMemorization.successRate))}%
            </p>
          </div>
        </div>
      </div>
      
      {showDetails && (
        <StudentDetailModal stats={stats} onClose={() => setShowDetails(false)} />
      )}
    </>
  );
}

/** نافذة تفاصيل الطالب */
function StudentDetailModal({ stats, onClose }: { stats: OverallStudentStats; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} wide>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Avatar 
              photo={stats.student.photo} 
              name={stats.student.name} 
              size={72} 
              frame={stats.student.frame} 
              crown={stats.student.crown} 
              glow={stats.student.glow} 
            />
            <div>
              <h3 className="font-display text-2xl font-extrabold text-ink">{stats.student.name}</h3>
              <p className="text-sm font-bold text-grape-500">تحليل شامل للأداء</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-grape-100 text-grape-600 transition hover:bg-grape-200">
            <Icon name="x" className="h-5 w-5" strokeWidth={3} />
          </button>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-grape-200 bg-grape-50/60 p-4">
            <p className="text-[11px] font-extrabold text-grape-500">آخر حفظ سمعه</p>
            {stats.student.lastHeard?.memorization ? (
              <>
                <p className="mt-1 font-display text-lg font-extrabold text-ink">{stats.student.lastHeard.memorization.text}</p>
                <p className="mt-1 text-xs font-bold text-grape-600">{ar(stats.student.lastHeard.memorization.verses)} آية · {stats.student.lastHeard.memorization.day}</p>
              </>
            ) : <p className="mt-2 text-sm font-bold text-grape-400">لم يُسجّل حفظ بعد</p>}
          </div>
          <div className="rounded-2xl border border-gold-500/30 bg-gold-400/10 p-4">
            <p className="text-[11px] font-extrabold text-gold-600">آخر مراجعة سمعها</p>
            {stats.student.lastHeard?.review ? (
              <>
                <p className="mt-1 font-display text-lg font-extrabold text-ink">{stats.student.lastHeard.review.text}</p>
                <p className="mt-1 text-xs font-bold text-gold-600">{ar(stats.student.lastHeard.review.verses)} آية · {stats.student.lastHeard.review.day}</p>
              </>
            ) : <p className="mt-2 text-sm font-bold text-grape-400">لم تُسجّل مراجعة بعد</p>}
          </div>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
          {/* قسم الحضور */}
          <div className="rounded-2xl border-2 border-grape-100 bg-white p-5">
            <h4 className="flex items-center gap-2 font-display text-lg font-extrabold text-ink mb-4">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-mint-100 text-mint-600">
                <Icon name="calendar" className="h-4 w-4" strokeWidth={2.4} />
              </span>
              الحضور والغياب
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm font-bold text-grape-600">نسبة الحضور</span>
                <span className={`font-display text-lg font-extrabold ${stats.attendance.attendanceRate >= 75 ? 'text-mint-600' : 'text-coral-500'}`}>
                  {ar(Math.round(stats.attendance.attendanceRate))}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-bold text-grape-600">أيام الحضور</span>
                <span className="font-display text-lg font-extrabold text-grape-600">{ar(stats.attendance.attendanceDays)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-bold text-grape-600">أيام الغياب</span>
                <span className={`font-display text-lg font-extrabold ${stats.attendance.absenceDays >= 3 ? 'text-coral-500' : 'text-grape-600'}`}>
                  {ar(stats.attendance.absenceDays)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-bold text-grape-600">حضور متتالي</span>
                <span className="font-display text-lg font-extrabold text-grape-600">{ar(stats.attendance.consecutiveAttendance)} أيام</span>
              </div>
              {stats.attendance.frequentAbsence && (
                <div className="mt-3 rounded-xl bg-coral-50 border-2 border-coral-200 p-3">
                  <p className="flex items-center gap-2 text-sm font-extrabold text-coral-600">
                    <Icon name="alert" className="h-4 w-4" />
                    ⚠️ غياب متكرر ({ar(stats.attendance.absenceDays)} أيام)
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* قسم الحفظ */}
          <div className="rounded-2xl border-2 border-grape-100 bg-white p-5">
            <h4 className="flex items-center gap-2 font-display text-lg font-extrabold text-ink mb-4">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold-100 text-gold-600">
                <Icon name="book" className="h-4 w-4" strokeWidth={2.4} />
              </span>
              الحفظ والتسميع
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm font-bold text-grape-600">إجمالي الآيات</span>
                <span className="font-display text-lg font-extrabold text-grape-600">{ar(stats.weeklyMemorization.totalVerses)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-bold text-grape-600">متوسط الآيات/يوم</span>
                <span className="font-display text-lg font-extrabold text-grape-600">
                  {ar(stats.weeklyMemorization.averageVersesPerDay.toFixed(1))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-bold text-grape-600">الأسطر هذا الأسبوع</span>
                <span className="font-display text-lg font-extrabold text-grape-600">{ar(stats.weeklyMemorization.totalLines)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-bold text-grape-600">متوسط الأسطر/يوم</span>
                <span className="font-display text-lg font-extrabold text-grape-600">{ar(stats.weeklyMemorization.averageLinesPerDay.toFixed(1))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-bold text-grape-600">الصفحات هذا الأسبوع</span>
                <span className="font-display text-lg font-extrabold text-grape-600">{ar(stats.weeklyMemorization.totalPages)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-bold text-grape-600">متوسط الصفحات/يوم</span>
                <span className="font-display text-lg font-extrabold text-grape-600">{ar(stats.weeklyMemorization.averagePagesPerDay.toFixed(1))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-bold text-grape-600">أيام الحفظ</span>
                <span className="font-display text-lg font-extrabold text-grape-600">{ar(stats.weeklyMemorization.memorizationDays)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-bold text-grape-600">نسبة النجاح</span>
                <span className={`font-display text-lg font-extrabold ${stats.weeklyMemorization.successRate >= 70 ? 'text-mint-600' : 'text-gold-600'}`}>
                  {ar(Math.round(stats.weeklyMemorization.successRate))}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-bold text-grape-600">أفضل إنجاز يومي</span>
                <span className="font-display text-lg font-extrabold text-grape-600">{ar(stats.weeklyMemorization.bestDayVerses)} آيات</span>
              </div>
              
              {/* الاتجاه */}
              <div className="mt-3 pt-3 border-t-2 border-dashed border-grape-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-grape-600">الاتجاه</span>
                  {stats.weeklyMemorization.trend === "improving" && (
                    <span className="flex items-center gap-1 rounded-full bg-mint-500 px-2 py-1 text-xs font-extrabold text-white">
                      <Icon name="trendingUp" className="h-3.5 w-3.5" /> يتحسن
                    </span>
                  )}
                  {stats.weeklyMemorization.trend === "stable" && (
                    <span className="flex items-center gap-1 rounded-full bg-grape-500 px-2 py-1 text-xs font-extrabold text-white">
                      <Icon name="minus" className="h-3.5 w-3.5" /> مستقر
                    </span>
                  )}
                  {stats.weeklyMemorization.trend === "declining" && (
                    <span className="flex items-center gap-1 rounded-full bg-coral-500 px-2 py-1 text-xs font-extrabold text-white">
                      <Icon name="trendingDown" className="h-3.5 w-3.5" /> يتراجع
                    </span>
                  )}
                  {stats.weeklyMemorization.trend === "insufficient-data" && (
                    <span className="text-xs font-bold text-grape-400">بيانات غير كافية</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* الملخص العام */}
        <div className="mt-6 rounded-2xl border-2 border-grape-200 bg-grape-50 p-5">
          <h4 className="flex items-center gap-2 font-display text-lg font-extrabold text-ink mb-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-grape-200 text-grape-600">
              <Icon name="sparkle" className="h-4 w-4" strokeWidth={2.4} />
            </span>
            الملخص العام
          </h4>
          <p className="text-base font-bold text-grape-700 leading-relaxed">
            {generateStudentSummary(stats.attendance, stats.weeklyMemorization)}
          </p>
        </div>
      </div>
    </Modal>
  );
}

/** البطاقات الإحصائية الشاملة */
function SummaryCards({ students }: { students: Student[] }) {
  const totalStudents = students.length;
  const activeStudents = students.filter(s => {
    const hasAttendance = DAYS.some(d => s.days[d.key].a);
    const hasMemorization = (s.memorizationRecords || []).length > 0;
    return hasAttendance || hasMemorization;
  }).length;
  
  const frequentAbsentees = students.filter(s => {
    const stats = calculateAttendanceStats(s);
    return stats.frequentAbsence;
  }).length;
  
  const excellentPerformers = students.filter(s => {
    const memStats = calculateWeeklyMemorizationStats(s);
    return memStats.performanceStatus === "excellent";
  }).length;
  
  const totalVersesThisWeek = students.reduce((sum, s) => {
    const stats = calculateWeeklyMemorizationStats(s);
    return sum + stats.totalVerses;
  }, 0);
  
  const avgAttendanceRate = students.length > 0
    ? students.reduce((sum, s) => sum + calculateAttendanceStats(s).attendanceRate, 0) / students.length
    : 0;
  
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-3xl border-2 border-grape-200 bg-white p-5 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-grape-100 text-grape-600 mb-3">
          <Icon name="users" className="h-7 w-7" strokeWidth={2} />
        </div>
        <p className="font-display text-3xl font-extrabold text-ink">{ar(totalStudents)}</p>
        <p className="text-sm font-bold text-grape-500">إجمالي الطلاب</p>
      </div>
      
      <div className="rounded-3xl border-2 border-mint-300 bg-mint-50 p-5 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-mint-200 text-mint-600 mb-3">
          <Icon name="check" className="h-7 w-7" strokeWidth={2.4} />
        </div>
        <p className="font-display text-3xl font-extrabold text-mint-600">{ar(activeStudents)}</p>
        <p className="text-sm font-bold text-mint-700">طلاب نشطين</p>
      </div>
      
      <div className="rounded-3xl border-2 border-coral-300 bg-coral-50 p-5 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-coral-200 text-coral-600 mb-3">
          <Icon name="alert" className="h-7 w-7" strokeWidth={2.4} />
        </div>
        <p className="font-display text-3xl font-extrabold text-coral-600">{ar(frequentAbsentees)}</p>
        <p className="text-sm font-bold text-coral-700">غياب متكرر</p>
      </div>
      
      <div className="rounded-3xl border-2 border-gold-300 bg-gold-50 p-5 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gold-200 text-gold-600 mb-3">
          <Icon name="trophy" className="h-7 w-7" strokeWidth={2.4} />
        </div>
        <p className="font-display text-3xl font-extrabold text-gold-600">{ar(excellentPerformers)}</p>
        <p className="text-sm font-bold text-gold-700">أداء ممتاز</p>
      </div>
      
      <div className="rounded-3xl border-2 border-grape-200 bg-white p-5 text-center sm:col-span-2">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-grape-100 text-grape-600 mb-3">
          <Icon name="book" className="h-7 w-7" strokeWidth={2.4} />
        </div>
        <p className="font-display text-3xl font-extrabold text-grape-600">{ar(totalVersesThisWeek)}</p>
        <p className="text-sm font-bold text-grape-500">آيات محفوظة هذا الأسبوع</p>
      </div>
      
      <div className="rounded-3xl border-2 border-grape-200 bg-white p-5 text-center sm:col-span-2">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-grape-100 text-grape-600 mb-3">
          <Icon name="chart" className="h-7 w-7" strokeWidth={2.4} />
        </div>
        <p className="font-display text-3xl font-extrabold text-grape-600">{ar(avgAttendanceRate.toFixed(1))}%</p>
        <p className="text-sm font-bold text-grape-500">متوسط نسبة الحضور</p>
      </div>
    </div>
  );
}

/** قائمة الطلاب الذين يحتاجون متابعة */
function NeedsAttentionList({ students }: { students: Student[] }) {
  const [selected, setSelected] = useState<OverallStudentStats | null>(null);
  const needsAttention = students.map(s => ({
    student: s,
    attendance: calculateAttendanceStats(s),
    memorization: calculateWeeklyMemorizationStats(s),
  })).filter(({ attendance, memorization }) => {
    return (
      attendance.frequentAbsence ||
      memorization.trend === "declining" ||
      memorization.successRate < 60 ||
      memorization.trend === "insufficient-data"
    );
  });
  
  if (needsAttention.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-mint-300 bg-mint-50 p-6 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-mint-200 text-mint-600 mb-3">
          <Icon name="check" className="h-8 w-8" strokeWidth={2.4} />
        </div>
        <h3 className="font-display text-xl font-extrabold text-mint-700">كل الطلاب بخير!</h3>
        <p className="text-sm font-bold text-mint-600 mt-1">لا يوجد طلاب يحتاجون إلى متابعة خاصة</p>
      </div>
    );
  }
  
  return (
    <>
    <div className="rounded-3xl border border-coral-200 bg-white p-5 shadow-[0_18px_45px_-34px_rgba(201,56,87,.45)]">
      <h3 className="flex items-center gap-2 font-display text-xl font-extrabold text-coral-600 mb-4">
        <Icon name="alert" className="h-6 w-6" strokeWidth={2.4} />
        طلاب يحتاجون متابعة ({ar(needsAttention.length)})
      </h3>
      
      <div className="space-y-3">
        {needsAttention.map(({ student, attendance, memorization }) => (
          <div key={student.id} className="flex items-center justify-between rounded-2xl border-2 border-coral-100 bg-coral-50/50 p-4">
            <div className="flex items-center gap-3">
              <Avatar photo={student.photo} name={student.name} size={48} />
              <div>
                <p className="font-display text-lg font-extrabold text-ink">{student.name}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {attendance.frequentAbsence && (
                    <span className="flex items-center gap-1 rounded-full bg-coral-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
                      <Icon name="alert" className="h-3 w-3" /> غياب ({ar(attendance.absenceDays)} أيام)
                    </span>
                  )}
                  {memorization.trend === "declining" && (
                    <span className="flex items-center gap-1 rounded-full bg-orange-400 px-2 py-0.5 text-[10px] font-extrabold text-white">
                      <Icon name="trendingDown" className="h-3 w-3" /> تراجع حفظ
                    </span>
                  )}
                  {memorization.successRate < 60 && memorization.successRate > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-gold-400 px-2 py-0.5 text-[10px] font-extrabold text-white">
                      <Icon name="book" className="h-3 w-3" /> ضعف تسميع
                    </span>
                  )}
                  {memorization.trend === "insufficient-data" && (
                    <span className="flex items-center gap-1 rounded-full bg-grape-400 px-2 py-0.5 text-[10px] font-extrabold text-white">
                      <Icon name="search" className="h-3 w-3" /> بيانات قليلة
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelected({
                student,
                attendance,
                weeklyMemorization: memorization,
                summary: generateStudentSummary(attendance, memorization),
                statusIndicators: {
                  frequentAbsence: attendance.frequentAbsence,
                  decliningMemorization: memorization.trend === "declining",
                  lowSuccessRate: memorization.successRate < 60 && memorization.successRate > 0,
                  improving: memorization.trend === "improving",
                  excellent: memorization.performanceStatus === "excellent",
                },
              })}
              className="rounded-xl bg-grape-600 px-4 py-2 text-sm font-extrabold text-white transition hover:bg-grape-700"
            >
              عرض الملف
            </button>
          </div>
        ))}
      </div>
    </div>
    {selected && <StudentDetailModal stats={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

export default function StatisticsPage() {
  const { students } = useApp();
  const [filter, setFilter] = useState<"all" | "needs-attention" | "excellent">("all");
  
  const overallStats = useMemo(() => {
    return students.map(student => {
      const attendance = calculateAttendanceStats(student);
      const weeklyMemorization = calculateWeeklyMemorizationStats(student);
      
      const statusIndicators = {
        frequentAbsence: attendance.frequentAbsence,
        decliningMemorization: weeklyMemorization.trend === "declining",
        lowSuccessRate: weeklyMemorization.successRate < 60 && weeklyMemorization.successRate > 0,
        improving: weeklyMemorization.trend === "improving",
        excellent: weeklyMemorization.performanceStatus === "excellent",
      };
      
      return {
        student,
        attendance,
        weeklyMemorization,
        summary: generateStudentSummary(attendance, weeklyMemorization),
        statusIndicators,
      };
    });
  }, [students]);
  
  const filteredStats = overallStats.filter(stats => {
    if (filter === "needs-attention") {
      return stats.statusIndicators.frequentAbsence || 
             stats.statusIndicators.decliningMemorization || 
             stats.statusIndicators.lowSuccessRate;
    }
    if (filter === "excellent") {
      return stats.statusIndicators.excellent;
    }
    return true;
  });
  
  return (
    <div className="space-y-8">
      <SectionHead
        title="إحصائيات وتحليل مستوى الطلاب"
        desc="دراسة شاملة لأداء الطلاب بناءً على سجل الحفظ والحضور الفعلي"
        icon="chart"
      />
      
      {/* البطاقات الإحصائية الشاملة */}
      <SummaryCards students={students} />
      
      {/* فلترة وعرض الطلاب */}
      <div className="rounded-3xl border-2 border-grape-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h3 className="font-display text-xl font-extrabold text-ink">تحليل أداء الطلاب</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-xl px-4 py-2 text-sm font-extrabold transition ${
                filter === "all" 
                  ? "bg-grape-600 text-white shadow-[0_3px_0_#56289d]" 
                  : "bg-grape-100 text-grape-600 hover:bg-grape-200"
              }`}
            >
              الكل ({ar(students.length)})
            </button>
            <button
              type="button"
              onClick={() => setFilter("needs-attention")}
              className={`rounded-xl px-4 py-2 text-sm font-extrabold transition ${
                filter === "needs-attention" 
                  ? "bg-coral-500 text-white shadow-[0_3px_0_#b23a55]" 
                  : "bg-coral-100 text-coral-600 hover:bg-coral-200"
              }`}
            >
              يحتاجون متابعة
            </button>
            <button
              type="button"
              onClick={() => setFilter("excellent")}
              className={`rounded-xl px-4 py-2 text-sm font-extrabold transition ${
                filter === "excellent" 
                  ? "bg-mint-500 text-white shadow-[0_3px_0_#0a7a50]" 
                  : "bg-mint-100 text-mint-600 hover:bg-mint-200"
              }`}
            >
              أداء ممتاز
            </button>
          </div>
        </div>
        
        {filteredStats.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-grape-100 text-grape-400 mb-3">
              <Icon name="search" className="h-8 w-8" strokeWidth={2} />
            </div>
            <p className="font-display text-lg font-extrabold text-grape-600">لا توجد نتائج</p>
            <p className="text-sm font-bold text-grape-500 mt-1">جرب تغيير الفلتر لعرض طلاب آخرين</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredStats.map(stats => (
              <StudentStatCard key={stats.student.id} stats={stats} />
            ))}
          </div>
        )}
      </div>
      
      {/* قائمة الطلاب الذين يحتاجون متابعة */}
      <NeedsAttentionList students={students} />
    </div>
  );
}
