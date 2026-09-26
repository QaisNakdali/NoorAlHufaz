import type { Halaqa, Student } from "./core";

export const localDateKey = (date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const parseDateKey = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};

/** الخميس والجمعة والسبت لا تغيّر التوزيع؛ تعرض آخر توزيع للأربعاء. */
const effectiveTeachingDate = (date: Date): Date => {
  const out = new Date(date);
  const day = out.getDay();
  if (day >= 4) out.setDate(out.getDate() - (day - 3));
  return out;
};

const teachingDaysBetween = (from: string, to: string): number => {
  const a = parseDateKey(from);
  const b = parseDateKey(to);
  if (!a || !b) return 0;
  const start = effectiveTeachingDate(a);
  const end = effectiveTeachingDate(b);
  if (end <= start) return 0;
  let count = 0;
  const cursor = new Date(start);
  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1);
    if (cursor.getDay() <= 3) count += 1;
  }
  return count;
};

const hash = (value: string): number => {
  let out = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    out ^= value.charCodeAt(i);
    out = Math.imul(out, 16777619);
  }
  return out >>> 0;
};

const seededShuffle = <T,>(items: T[], seed: number): T[] => {
  const out = [...items];
  let state = seed || 0x9e3779b9;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = next() % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export type HalaqaDistribution = {
  enabled: boolean;
  date: string;
  cycleIndex: number;
  dayInCycle: number;
  cycleLength: number;
  byTeacher: Record<string, Student[]>;
  teacherForStudent: Record<string, string>;
};

/**
 * توزيع متوازن وحتمي. لا يستخدم Math.random ولا يتغير بتحديث الصفحة.
 * بذرة وتاريخ البداية موجودان داخل الحلقة المتزامنة، ولذلك يرى الجميع النتيجة نفسها.
 */
export function distributionForHalaqa(halaqa: Halaqa, students: Student[], date = new Date()): HalaqaDistribution {
  const teachers = halaqa.teachers ?? [];
  const dateKey = localDateKey(date);
  const effectiveDateKey = localDateKey(effectiveTeachingDate(date));
  const byTeacher = Object.fromEntries(teachers.map((teacher) => [teacher.id, [] as Student[]]));
  const teacherForStudent: Record<string, string> = {};
  const enabled = halaqa.randomDistribution === true && teachers.length > 1;
  if (teachers.length === 0) return { enabled: false, date: dateKey, cycleIndex: 0, dayInCycle: 0, cycleLength: 0, byTeacher, teacherForStudent };
  if (!enabled) {
    if (teachers.length === 1) {
      byTeacher[teachers[0].id] = [...students];
      students.forEach((student) => { teacherForStudent[student.id] = teachers[0].id; });
    }
    return { enabled: false, date: dateKey, cycleIndex: 0, dayInCycle: 0, cycleLength: teachers.length, byTeacher, teacherForStudent };
  }

  const elapsed = teachingDaysBetween(halaqa.rotationAnchorDate ?? effectiveDateKey, effectiveDateKey);
  const cycleLength = teachers.length;
  const cycleIndex = Math.floor(elapsed / cycleLength);
  const dayInCycle = elapsed % cycleLength;
  const seed = hash(`${halaqa.id}|${halaqa.rotationSeed ?? 1}|${cycleIndex}`);
  const orderedStudents = seededShuffle([...students].sort((a, b) => a.id.localeCompare(b.id)), seed);
  const teacherOrder = seededShuffle(teachers, hash(`${seed}|teachers`));
  orderedStudents.forEach((student, index) => {
    const teacher = teacherOrder[(index + dayInCycle) % teacherOrder.length];
    byTeacher[teacher.id].push(student);
    teacherForStudent[student.id] = teacher.id;
  });
  return { enabled: true, date: dateKey, cycleIndex, dayInCycle, cycleLength, byTeacher, teacherForStudent };
}
