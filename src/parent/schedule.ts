import { DAYS, type DayKey, type DailyWard, type Student, type WeekLog, type WeekStudentRecord } from "../core.ts";
import { addCalendarDays, dateFromLocalKey, localDateKey } from "../hijriDate.ts";
import { isLearningCompleted } from "../learningCompletion.ts";

export type DayRecord = Pick<Student, "id" | "name" | "photo" | "halaqaId" | "days" | "ward" | "recitationRatings" | "isTesting">;
export type LearningState = "pending" | "excellent" | "very-good" | "not-completed" | "exempt" | "absent";
export type ScheduledDay = { key: DayKey; label: string; date: string; timing: "past" | "today" | "future"; attendance: "present" | "absent" | "pending"; memorization: LearningState; review: LearningState; ward: DailyWard | undefined };
const hasPlan = (ward: DailyWard | undefined) => !!ward && (!!ward.memorization?.trim() || !!ward.review?.trim() || [ward.memorizationPages,ward.memorizationLines,ward.memorizationVerses,ward.reviewPages,ward.reviewLines,ward.reviewVerses].some(n => typeof n === "number" && n > 0));
export function learningState(student: DayRecord, day: DayKey, part: "h" | "r", future: boolean): LearningState {
  const entry = student.days?.[day];
  const exempt = entry?.testing === true || (future && student.isTesting === true && entry?.testing !== false);
  if (part === "h" && exempt && !isLearningCompleted(student,day,part)) return "exempt";
  if (isLearningCompleted(student,day,part)) return student.recitationRatings?.[day]?.[part] === "very-good" ? "very-good" : "excellent";
  if (entry?.absent === true) return "absent";
  if (entry?.evaluated?.[part] === true && entry?.[part] !== true) return "not-completed";
  return "pending";
}
export function scheduleDays(student: DayRecord, weekStart: string, now = new Date()): ScheduledDay[] {
  const start = dateFromLocalKey(weekStart);
  if (!start || start.getUTCDay() !== 0) return [];
  const today = localDateKey(now);
  return DAYS.map(({key,label},i) => {
    const date = localDateKey(addCalendarDays(start,i));
    const timing = date < today ? "past" : date > today ? "future" : "today";
    const state = student.days?.[key];
    return {key,label,date,timing,attendance:state?.absent===true?"absent":state?.a===true?"present":"pending",memorization:learningState(student,key,"h",timing!=="past"),review:learningState(student,key,"r",timing==="future"),ward:student.ward?.[key]};
  });
}
export function studentSchedule(student: DayRecord, weekStart: string, now = new Date()) {
  const days = scheduleDays(student,weekStart,now), todayKey = localDateKey(now), tomorrow = localDateKey(addCalendarDays(todayKey,1));
  const future = days.filter(d=>d.date>todayKey);
  const upcoming = future.find(d=>d.date===tomorrow) ?? future.find(d=>hasPlan(d.ward)) ?? future[0] ?? null;
  const planned = upcoming && hasPlan(upcoming.ward);
  return { days, today:days.find(d=>d.date===todayKey)??null, upcoming, isTomorrow:upcoming?.date===tomorrow, isTeachingToday:dateFromLocalKey(todayKey)!.getUTCDay()<4, hasCurrentWeek:days.some(d=>d.date===todayKey), hasUpcomingPlan:!!planned };
}
export function wardQuantity(ward: DailyWard | undefined, part: "h" | "r"): string {
  if (!ward) return "";
  const page = part==="h"?ward.memorizationPages:ward.reviewPages, lines=part==="h"?ward.memorizationLines:ward.reviewLines, verses=part==="h"?ward.memorizationVerses:ward.reviewVerses;
  const from=part==="h"?ward.memorizationFromVerse:ward.reviewFromVerse,to=part==="h"?ward.memorizationToVerse:ward.reviewToVerse;
  const parts:string[]=[];
  if(typeof page==="number"&&page>0)parts.push(`${page} صفحة`);
  if(typeof lines==="number"&&lines>0&&!(typeof page==="number"&&page>0))parts.push(`${lines} سطرًا`);
  if(typeof from==="number"&&typeof to==="number"&&from>0&&to>=from)parts.push(`الآيات ${from}–${to}`);
  else if(typeof verses==="number"&&verses>0)parts.push(`${verses} آية`);
  return parts.join(" · ");
}
export const learningLabel = (state:LearningState,part:"h"|"r") => state==="excellent"?"ممتاز":state==="very-good"?"جيد جدًا":state==="not-completed"?(part==="h"?"لم يحفظ":"لم يراجع"):state==="exempt"?"معفى أثناء الاختبار":state==="absent"?"لا نتيجة في يوم الغياب":"لم يسمّع بعد";
export const attendanceLabel = (state:ScheduledDay["attendance"]) => state==="present"?"حاضر":state==="absent"?"غائب":"لم يُسجّل الحضور";
export function archiveRecord(log:WeekLog,id:string):WeekStudentRecord|undefined {return log.records?.find(s=>s.id===id);}
