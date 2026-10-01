import assert from "node:assert/strict";
import test from "node:test";
import { buildWardUpdate, canRecordMemorization } from "../src/learningRules.ts";

const previous = { memorization: "الملك", review: "القلم", memorizationVerses: 5, memorizationLines: 3.5, reviewVerses: 20, reviewLines: 30 };

test("طالب الاختبار لا يستطيع إنشاء أو استبدال حفظ جديد", () => {
  const next = buildWardUpdate(previous, { ...previous, memorization: "البقرة", memorizationVerses: 9, memorizationLines: 7, review: "النبأ", reviewPages: 0.5 }, true);
  assert.equal(canRecordMemorization(true), false);
  assert.equal(next.memorization, "الملك");
  assert.equal(next.memorizationVerses, 5);
  assert.equal(next.memorizationLines, 3.5);
  assert.equal(next.review, "النبأ");
  assert.equal(next.reviewPages, 0.5);
});

test("التسجيل الجديد يجعل صفحات المراجعة المصدر ولا يكتب آيات أو أسطرًا مشتقة", () => {
  const next = buildWardUpdate(previous, { ...previous, reviewPages: 1.5 }, false);
  assert.equal(next.reviewPages, 1.5);
  assert.equal(next.reviewVerses, undefined);
  assert.equal(next.reviewLines, undefined);
});

test("السجل القديم بلا صفحات يحتفظ بآياته وأسطره", () => {
  const next = buildWardUpdate(previous, previous, false);
  assert.equal(next.reviewPages, undefined);
  assert.equal(next.reviewVerses, 20);
  assert.equal(next.reviewLines, 30);
});

test("القيمة الصفرية لا تُخزن كصفحات مراجعة جديدة", () => {
  const empty = { memorization: "", review: "", memorizationVerses: 0, memorizationLines: 0 };
  const next = buildWardUpdate(empty, { ...empty, reviewPages: 0 }, false);
  assert.equal(next.reviewPages, undefined);
});
