import type { DayEntry, DayKey, Student } from "./core.ts";

/** No historical inference: a policy belongs to its recorded calendar day. */
export function captureExamDay(entry: DayEntry, isTesting: boolean): DayEntry {
  // Completed recitations retain their policy even when the current mode changes.
  if (entry.h || entry.r) return entry;
  return { ...entry, testing: isTesting };
}

export function toggleExamMode(student: Student, todayDay?: DayKey): Student {
  const isTesting = !student.isTesting;
  return {
    ...student,
    isTesting,
    days: todayDay ? {
      ...student.days,
      [todayDay]: captureExamDay(student.days[todayDay], isTesting),
    } : student.days,
  };
}
