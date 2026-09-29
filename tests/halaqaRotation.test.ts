import assert from "node:assert/strict";
import test from "node:test";
import { distributionForHalaqa } from "../src/halaqaRotation.ts";

const halaqa = {
  id: "h1",
  name: "حلقة الاختبار",
  createdAt: 1,
  teachers: [
    { id: "t1", name: "الأول", createdAt: 1 },
    { id: "t2", name: "الثاني", createdAt: 2 },
    { id: "t3", name: "الثالث", createdAt: 3 },
  ],
  randomDistribution: true,
  rotationAnchorDate: "2026-09-27",
  rotationSeed: 42,
} as any;
const students = Array.from({ length: 20 }, (_, index) => ({ id: `s${index}`, name: `طالب ${index}` })) as any[];

test("التوزيع متوازن بفارق لا يزيد على طالب واحد", () => {
  const result = distributionForHalaqa(halaqa, students, new Date(2026, 8, 27, 12));
  const sizes = Object.values(result.byTeacher).map((items) => items.length);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
});

test("تحديث الصفحة في اليوم نفسه لا يغير التوزيع", () => {
  const first = distributionForHalaqa(halaqa, students, new Date(2026, 8, 28, 9));
  const second = distributionForHalaqa(halaqa, students, new Date(2026, 8, 28, 22));
  assert.deepEqual(first.teacherForStudent, second.teacherForStudent);
});

test("الخميس والجمعة والسبت تحتفظ بتوزيع الأربعاء", () => {
  const wed = distributionForHalaqa(halaqa, students, new Date(2026, 8, 30, 12));
  for (const date of [new Date(2026, 9, 1, 12), new Date(2026, 9, 2, 12), new Date(2026, 9, 3, 12)]) {
    assert.deepEqual(distributionForHalaqa(halaqa, students, date).teacherForStudent, wed.teacherForStudent);
  }
});

test("الحلقة ذات المعلم الواحد تعرض جميع الطلاب دون تدوير", () => {
  const oneTeacher = { ...halaqa, teachers: [halaqa.teachers[0]] };
  const result = distributionForHalaqa(oneTeacher, students, new Date(2026, 8, 27, 12));
  assert.equal(result.enabled, false);
  assert.equal(result.byTeacher.t1.length, students.length);
});
