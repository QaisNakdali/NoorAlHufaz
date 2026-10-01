import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalSnapshot } from "../src/localSnapshot.ts";

test("النسخة النظيفة لا تكرر الحالة كاملة داخل __base", () => {
  const state = { students: [{ id: "a", name: "أحمد" }], orders: [] };
  const snapshot = buildLocalSnapshot(state, 12, false, state);
  assert.equal(snapshot.__rev, 12);
  assert.equal(snapshot.__dirty, false);
  assert.equal("__base" in snapshot, false);
  assert.deepEqual(snapshot.students, state.students);
});

test("النسخة غير المتزامنة تحتفظ بالأساس اللازم للدمج الآمن", () => {
  const base = { students: [{ id: "a", coins: 50 }] };
  const local = { students: [{ id: "a", coins: 55 }] };
  const snapshot = buildLocalSnapshot(local, 7, true, base);
  assert.equal(snapshot.__dirty, true);
  assert.deepEqual(snapshot.__base, base);
  assert.equal(snapshot.students[0].coins, 55);
});
