export type CheckoutPerformanceMetrics = {
  totalMs: number;
  networkMs: number;
  localWorkMs: number;
  requestCount: number;
  casRetries: number;
  payloadBytes: number;
  success: boolean;
};

const now = (): number => typeof performance !== "undefined" ? performance.now() : Date.now();

export const checkoutClock = { now };

export function reportCheckoutPerformance(metrics: CheckoutPerformanceMetrics): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("noor:checkout-performance", { detail: metrics }));
  const debugEnabled = import.meta.env.DEV || window.localStorage.getItem("noor_checkout_perf") === "1";
  if (debugEnabled) console.info("[checkout-performance]", metrics);
}
