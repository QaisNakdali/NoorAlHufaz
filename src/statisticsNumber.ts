/** التقريب في عرض الإحصائيات فقط إلى أقرب ربع للأعلى. */
export function roundUpToQuarter(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.ceil((value - Number.EPSILON) * 4) / 4;
}
