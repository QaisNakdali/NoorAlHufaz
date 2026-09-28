import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SHOP_ITEMS,
  calculateStudentTotals,
  denseXpRanking,
  emptyRecitationRatings,
  emptyWeekDays,
  isChampionEligible,
  seedStudents,
  weekCoinsOf,
  weekXpOf,
} from "../src/core.ts";

test("معرفات الطلاب الافتراضيين والمنتجات غير مكررة", () => {
  const students = seedStudents();
  assert.equal(new Set(students.map((student) => student.id)).size, students.length);
  assert.equal(new Set(DEFAULT_SHOP_ITEMS.map((item) => item.id)).size, DEFAULT_SHOP_ITEMS.length);
});

test("الغياب لا يمنح ولا يخصم نقاط الحفظ والمراجعة", () => {
  const days = emptyWeekDays();
  days.sun = { a: false, h: false, r: false, absent: true };
  assert.equal(weekXpOf(days), 0);
  assert.equal(weekCoinsOf(days), 0);
});

test("ممتاز وجيد جدًا يمنحان المكافأة نفسها", () => {
  const excellent = emptyWeekDays();
  excellent.sun = { a: true, h: true, r: true };
  const veryGood = structuredClone(excellent);
  assert.equal(weekXpOf(excellent), weekXpOf(veryGood));
  assert.equal(weekCoinsOf(excellent), weekCoinsOf(veryGood));
});

test("الترتيب الكثيف لا يترك مراكز مفقودة", () => {
  const students = [
    { id: "a", name: "أ", xp: 100 },
    { id: "b", name: "ب", xp: 100 },
    { id: "c", name: "ج", xp: 90 },
    { id: "d", name: "د", xp: 80 },
  ] as any;
  assert.deepEqual(denseXpRanking(students).map((entry) => entry.rank), [1, 1, 2, 3]);
});

test("شراء مسجل في coinsSpent يبقى مخصومًا بعد إعادة الحساب", () => {
  const student = {
    ...seedStudents()[0],
    inventory: [], bag: [], awards: [], manualCoinsAdjust: 20, coinsSpent: 0,
  };
  const before = calculateStudentTotals(student, [], 1, DEFAULT_SHOP_ITEMS, 40);
  const after = calculateStudentTotals({ ...student, coinsSpent: 5 }, [], 1, DEFAULT_SHOP_ITEMS, 40);
  assert.equal(after.coins, before.coins - 5);
});

test("بطل الأسبوع المختلط يقبل ممتاز وجيد جدًا ولا يقبل غيابًا", () => {
  const student = seedStudents()[0];
  student.recitationRatings = emptyRecitationRatings();
  for (const day of Object.keys(student.days) as Array<keyof typeof student.days>) {
    student.days[day] = { a: true, h: true, r: true };
    student.recitationRatings[day] = { h: day === "sun" ? "very-good" : "excellent", r: "excellent" };
  }
  assert.equal(isChampionEligible(student, false, [], "mixed"), true);
  assert.equal(isChampionEligible(student, false, [], "excellent"), false);
  student.days.wed = { a: false, h: false, r: false, absent: true };
  assert.equal(isChampionEligible(student, false, [], "mixed"), false);
});
