import type { DailyWard } from "./core.ts";
import { safeNonNegativeDecimal } from "./learningMetrics.ts";

export const canRecordMemorization = (isTesting?: boolean): boolean => isTesting !== true;

/** يبني سجل اليوم الجديد ويحمي حفظ طالب الاختبار في طبقة الحالة. */
export function buildWardUpdate(previous: DailyWard, incoming: DailyWard, isTesting?: boolean): DailyWard {
  const parsedReviewPages = safeNonNegativeDecimal(incoming.reviewPages);
  const reviewPages = parsedReviewPages !== undefined && parsedReviewPages > 0 ? parsedReviewPages : undefined;
  const next: DailyWard = {
    ...incoming,
    memorization: isTesting ? previous.memorization : String(incoming.memorization ?? ""),
    memorizationVerses: isTesting ? previous.memorizationVerses : Math.max(0, Number(incoming.memorizationVerses) || 0),
    memorizationLines: isTesting ? previous.memorizationLines : Math.max(0, Number(incoming.memorizationLines) || 0),
    review: String(incoming.review ?? ""),
    ...(reviewPages === undefined ? {} : { reviewPages }),
  };
  if (reviewPages === undefined) delete next.reviewPages;
  if (reviewPages !== undefined) {
    delete next.reviewVerses;
    delete next.reviewLines;
  } else {
    if (incoming.reviewVerses !== undefined) next.reviewVerses = Math.max(0, Number(incoming.reviewVerses) || 0);
    if (incoming.reviewLines !== undefined) next.reviewLines = Math.max(0, Number(incoming.reviewLines) || 0);
  }
  return next;
}
