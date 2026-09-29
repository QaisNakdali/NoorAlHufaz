import assert from "node:assert/strict";
import test from "node:test";
import { addCalendarDays, isTeachingWeekStart, localDateKey } from "../src/hijriDate.ts";

test("بداية أسبوع الحلقة يجب أن تكون يوم الأحد", () => {
  assert.equal(isTeachingWeekStart("2026-09-27"), true);
  assert.equal(isTeachingWeekStart("2026-09-28"), false);
  assert.equal(isTeachingWeekStart("bad-date"), false);
});

test("تواريخ أيام الحلقة تعبر نهاية الشهر والسنة بحساب تقويمي حقيقي", () => {
  assert.equal(localDateKey(addCalendarDays("2026-12-27", 1)), "2026-12-28");
  assert.equal(localDateKey(addCalendarDays("2026-12-27", 3)), "2026-12-30");
  assert.equal(localDateKey(addCalendarDays("2027-01-31", 1)), "2027-02-01");
  assert.equal(localDateKey(addCalendarDays("2027-01-31", 3)), "2027-02-03");
});
