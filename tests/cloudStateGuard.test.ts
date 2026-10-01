import assert from "node:assert/strict";
import test from "node:test";
import { hasCloudStudentCollection } from "../src/cloudStateGuard.ts";

test("يرفض نسخة سحابية جزئية قد تستبدل الطلاب ببيانات افتراضية", () => {
  assert.equal(hasCloudStudentCollection(null), false);
  assert.equal(hasCloudStudentCollection({}), false);
  assert.equal(hasCloudStudentCollection({ students: null }), false);
});

test("يقبل مصفوفة الطلاب الفارغة لأنها حالة صحيحة وليست بيانات مفقودة", () => {
  assert.equal(hasCloudStudentCollection({ students: [] }), true);
  assert.equal(hasCloudStudentCollection({ students: [{ id: "a" }] }), true);
});
