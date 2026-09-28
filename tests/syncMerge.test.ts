import assert from "node:assert/strict";
import test from "node:test";
import { mergeLocalChanges, type MergeConflict } from "../src/syncMerge.ts";

test("يحفظ إضافات جهازين مختلفين", () => {
  const base = { students: [{ id: "a", name: "أحمد" }] };
  const local = { students: [...base.students, { id: "b", name: "بدر" }] };
  const remote = { students: [...base.students, { id: "c", name: "خالد" }] };
  const merged = mergeLocalChanges(base, local, remote) as typeof local;
  assert.deepEqual(merged.students.map((student) => student.id).sort(), ["a", "b", "c"]);
});

test("يدمج تعديل طالبين مختلفين دون فقد أيهما", () => {
  const base = { students: [{ id: "a", coins: 50 }, { id: "b", coins: 20 }] };
  const local = { students: [{ id: "a", coins: 55 }, { id: "b", coins: 20 }] };
  const remote = { students: [{ id: "a", coins: 50 }, { id: "b", coins: 30 }] };
  const merged = mergeLocalChanges(base, local, remote) as typeof local;
  assert.deepEqual(merged.students, [{ id: "a", coins: 55 }, { id: "b", coins: 30 }]);
});

test("يطبق فروق الأرصدة المتزامنة بدل استبدال نسخة بأخرى", () => {
  const base = { students: [{ id: "a", coins: 100, coinsSpent: 0 }] };
  const local = { students: [{ id: "a", coins: 60, coinsSpent: 40 }] };
  const remote = { students: [{ id: "a", coins: 130, coinsSpent: 0 }] };
  const merged = mergeLocalChanges(base, local, remote) as typeof local;
  assert.equal(merged.students[0].coins, 90);
  assert.equal(merged.students[0].coinsSpent, 40);
});

test("لا تعيد النسخة القديمة طالبًا حذفه جهاز آخر", () => {
  const base = { students: [{ id: "a", name: "أحمد" }] };
  const local = structuredClone(base);
  const remote = { students: [] };
  const merged = mergeLocalChanges(base, local, remote) as typeof base;
  assert.deepEqual(merged.students, []);
});

test("يحافظ على السجل عند تعارض الحذف مع تعديل متزامن", () => {
  const base = { students: [{ id: "a", name: "أحمد" }] };
  const local = { students: [] };
  const remote = { students: [{ id: "a", name: "أحمد محمد" }] };
  const conflicts: MergeConflict[] = [];
  const merged = mergeLocalChanges(base, local, remote, [], conflicts) as typeof base;
  assert.equal(merged.students[0].name, "أحمد محمد");
  assert.equal(conflicts[0]?.kind, "delete-vs-update");
});

test("يحافظ على التعديل المحلي عند تعارضه مع حذف بعيد", () => {
  const base = { students: [{ id: "a", name: "أحمد" }] };
  const local = { students: [{ id: "a", name: "أحمد محمد" }] };
  const remote = { students: [] };
  const conflicts: MergeConflict[] = [];
  const merged = mergeLocalChanges(base, local, remote, [], conflicts) as typeof base;
  assert.equal(merged.students[0].name, "أحمد محمد");
  assert.equal(conflicts[0]?.kind, "delete-vs-update");
});

test("يحافظ على التعديلات اليدوية السالبة عند الدمج", () => {
  const base = { students: [{ id: "a", manualCoinsAdjust: 0 }] };
  const local = { students: [{ id: "a", manualCoinsAdjust: -10 }] };
  const remote = { students: [{ id: "a", manualCoinsAdjust: 5 }] };
  const merged = mergeLocalChanges(base, local, remote) as typeof base;
  assert.equal(merged.students[0].manualCoinsAdjust, -5);
});
