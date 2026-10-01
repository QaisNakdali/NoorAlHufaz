import assert from "node:assert/strict";
import test from "node:test";
import { normalizeNumericDraft } from "../src/numericInput.ts";

test("يسمح بمسح الحقل كاملًا أثناء التحرير", () => {
  assert.equal(normalizeNumericDraft(""), "");
});

test("لا يضيف صفرًا قبل الرقم الجديد", () => {
  assert.equal(normalizeNumericDraft("07"), "7");
  assert.equal(normalizeNumericDraft("015"), "15");
  assert.equal(normalizeNumericDraft("005"), "5");
});

test("يحافظ على الصفر والكسور الصحيحة", () => {
  assert.equal(normalizeNumericDraft("0"), "0");
  assert.equal(normalizeNumericDraft("0.5"), "0.5");
  assert.equal(normalizeNumericDraft("80"), "80");
});

test("يدعم الأرقام العربية والفاصلة العشرية العربية", () => {
  assert.equal(normalizeNumericDraft("٠٫٥"), "0.5");
  assert.equal(normalizeNumericDraft("٢,٢٥"), "2.25");
  assert.equal(normalizeNumericDraft("۱.۷۵"), "1.75");
});
