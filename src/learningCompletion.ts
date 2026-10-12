import type { DayKey, RecitationRatings, WeekDays } from "./core.ts";
/** Entered quantities are plans; completed work requires a successful evaluation. */
export function isLearningCompleted(record: { days?: WeekDays; recitationRatings?: RecitationRatings }, day: DayKey, part: "h" | "r"): boolean {
  const entry = record.days?.[day];
  const rating = record.recitationRatings?.[day]?.[part];
  return !!entry && !entry.absent && entry[part] === true && (rating === "excellent" || rating === "very-good");
}
