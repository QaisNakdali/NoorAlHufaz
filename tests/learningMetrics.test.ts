import assert from "node:assert/strict";
import test from "node:test";
import { reviewLinesForWard, reviewLinesFromPages, safeNonNegativeDecimal } from "../src/learningMetrics.ts";

test("تحويل صفحات المراجعة إلى أسطر يحافظ على الكسور بدقة", () => {
  assert.equal(reviewLinesFromPages(0.25), 3.75);
  assert.equal(reviewLinesFromPages(0.5), 7.5);
  assert.equal(reviewLinesFromPages(0.75), 11.25);
  assert.equal(reviewLinesFromPages(1), 15);
  assert.equal(reviewLinesFromPages(1.5), 22.5);
  assert.equal(reviewLinesFromPages(2.5), 37.5);
});

test("صفحات المراجعة الجديدة تتقدم على الأسطر القديمة دون تعديل السجل القديم", () => {
  assert.equal(reviewLinesForWard({ reviewPages: 0.5, reviewLines: 99 }), 7.5);
  assert.equal(reviewLinesForWard({ reviewLines: 8 }), 8);
});

test("يرفض القيم الرقمية غير الصالحة والسالبة", () => {
  assert.equal(safeNonNegativeDecimal(-1), undefined);
  assert.equal(safeNonNegativeDecimal(Number.NaN), undefined);
  assert.equal(safeNonNegativeDecimal(Number.POSITIVE_INFINITY), undefined);
  assert.equal(safeNonNegativeDecimal("2.5"), 2.5);
});
