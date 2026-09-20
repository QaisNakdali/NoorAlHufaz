import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ar, levelInfo, rankOf } from "../core";

/* ===== أيقونات SVG مرسومة يدويًا ===== */
const PATHS: Record<string, string> = {
  star: "M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z",
  bolt: "M13 2L4 14h6l-1 8 9-12h-6l1-8z",
  heart: "M12 21s-7.6-4.7-10-9.3C.4 8 2.4 4.5 6 4.5c2.2 0 3.6 1.2 4.5 2.6.4.6 1.6.6 2 0 .9-1.4 2.3-2.6 4.5-2.6 3.6 0 5.6 3.5 4 7.2-2.4 4.6-10 9.3-10 9.3z",
  check: "M4.5 12.5l5 5L19.5 7",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v9H5z",
  trophy: "M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 5M17 6h3a3 3 0 0 1-3 5",
  calendar: "M3 7h18v13H3zM3 11h18M8 3v4M16 3v4",
  trend: "M3 17l6-6 4 4 7-8M14 7h6v6",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14A2.5 2.5 0 0 0 6.5 22H20v-4.5",
  pencil: "M17 3l4 4L8 20l-5 1 1-5zM14.5 5.5l4 4",
  frame: "M4 4h16v16H4zM9 9h6v6H9z",
  puzzle: "M10 3a2 2 0 0 1 4 0h4v5a2 2 0 1 1 0 4v5h-5a2 2 0 1 0-4 0H5v-5a2 2 0 1 1 0-4V3z",
  dice: "M4 4h16v16H4zM9 9h.01M15 15h.01M15 9h.01M9 15h.01M12 12h.01",
  gift: "M20 12v9H4v-9M2 7h20v5H2zM12 7v14M12 7s-2-5-5-5-2 5 0 5M12 7s2-5 5-5 2 5 0 5",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  x: "M6 6l12 12M18 6L6 18",
  chevron: "M9 6l6 6-6 6",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9zM5 16l.7 1.8 1.8.7-1.8.7L5 21l-.7-1.8-1.8-.7 1.8-.7z",
  refresh: "M21 12a9 9 0 1 1-3-6.7M21 3v6h-6",
  users: "M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M16 3.1a4 4 0 0 1 0 7.8M23 21v-2a4 4 0 0 0-3-3.9",
  user: "M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM4 21a8 8 0 0 1 16 0",
  store: "M4 10v10h16V10M2 7l2-4h16l2 4a3.2 3.2 0 0 1-6.6 0A3.2 3.2 0 0 1 12 7a3.2 3.2 0 0 1-3.4 0A3.2 3.2 0 0 1 2 7M9 20v-6h6v6",
  flag: "M5 21V4M5 4h13l-2.5 4L18 12H5",
  sound: "M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14",
  mute: "M11 5L6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6",
  wand: "M4 20L14.5 9.5M13 8l-1.5-1.5M18 3l.8 2.2L21 6l-2.2.8L18 9l-.8-2.2L15 6l2.2-.8zM20 12l.6 1.4L22 14l-1.4.6L20 16l-.6-1.4L18 14l1.4-.6z",
  medal: "M12 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM9 13.5L7 22l5-3 5 3-2-8.5",
  shield: "M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z",
  crown: "M3 18h18M4 18l-1.5-9L8 12.5 12 4l4 8.5L21.5 9 20 18z",
  play: "M7 4l13 8-13 8z",
  moon: "M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5z",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  cloud: "M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z",
  cloudOff: "M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9zM3 3l18 18",
  rainbow: "M4 18a8 8 0 0 1 16 0M7.5 18a4.5 4.5 0 0 1 9 0M11 18a1 1 0 0 1 2 0",
  badge: "M12 2l2.4 4.8L20 8l-4 4 1 5.6L12 15l-5 2.6L8 12 4 8l5.6-1.2z",
  alert: "M12 9v4M12 17h.01M10.3 3.8L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z",
  chart: "M3 3v18h18M18 17V9M13 17V5M8 17v-3",
  search: "M21 21l-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z",
  trendingUp: "M3 17l6-6 4 4 7-7M14 7h6v6",
  trendingDown: "M3 7l6 6 4-4 7 7M14 17h6v-6",
};

export function Icon({
  name,
  className = "w-5 h-5",
  fill = false,
  strokeWidth = 2,
}: {
  name: string;
  className?: string;
  fill?: boolean;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={fill ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={fill ? 0.6 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={PATHS[name] ?? PATHS.star} />
    </svg>
  );
}

/* ===== عملة ذهبية ===== */
export function Coin({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <circle cx="10" cy="10" r="9" fill="#f7b733" stroke="#dd9511" strokeWidth="1.4" />
      <circle cx="10" cy="10" r="5.6" fill="#ffd75e" />
      <path d="M10 6.4l1 2.2 2.4.3-1.8 1.6.5 2.3-2.1-1.2-2.1 1.2.5-2.3L6.6 8.9l2.4-.3z" fill="#dd9511" />
    </svg>
  );
}

export function CoinChip({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-gold-400/25 border border-gold-500/40 px-2.5 py-0.5 text-sm font-bold text-gold-600 ${className}`}>
      <Coin className="w-4 h-4" />
      {ar(value)}
    </span>
  );
}

export function XpChip({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-grape-600/12 border border-grape-400/40 px-2.5 py-0.5 text-sm font-bold text-grape-700 ${className}`}>
      <Icon name="bolt" fill className="w-3.5 h-3.5" />
      {ar(value)} نقطة
    </span>
  );
}

export function LevelBadge({ level, className = "" }: { level: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-grape-600 text-white px-3 py-0.5 text-sm font-display font-bold shadow-[0_3px_0_#56289d] ${className}`}>
      <Icon name="shield" className="w-3.5 h-3.5" strokeWidth={2.4} />
      مستوى {ar(level)}
    </span>
  );
}

/* ===== قلب ===== */
export function HeartIcon({ className = "w-5 h-5", filled = true }: { className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 2} aria-hidden>
      <path d={PATHS.heart} />
    </svg>
  );
}

export function HeartsRow({
  hearts,
  max,
  size = "w-5 h-5",
  onRemove,
}: {
  hearts: number;
  max: number;
  size?: string;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          type="button"
          disabled={!onRemove}
          onClick={onRemove}
          title={onRemove ? "خصم قلب" : undefined}
          className={`transition-transform ${onRemove ? "cursor-pointer hover:scale-110 active:scale-90" : "cursor-default"} ${
            i < hearts ? "text-coral-500 drop-shadow-[0_1px_2px_rgba(247,95,128,0.45)]" : "text-grape-200"
          }`}
        >
          <HeartIcon filled={i < hearts} className={size} />
        </button>
      ))}
    </div>
  );
}

/** درجة البهتان حسب القلوب — من تنفد قلوبه يصير رماديًا تمامًا */
export const heartFade = (hearts: number): string =>
  hearts <= 0
    ? "opacity-40 grayscale"
    : hearts === 1
    ? "opacity-80 saturate-[0.75]"
    : hearts === 2
    ? "saturate-[0.9]"
    : "";

/* ===== شريط الخبرة ===== */
export function XpBar({ xp, compact = false }: { xp: number; compact?: boolean }) {
  const { level, into, need } = levelInfo(xp);
  const pct = Math.max(3, Math.round((into / need) * 100));
  return (
    <div>
      {!compact && (
        <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-grape-700/80">
          <span className="font-display">{rankOf(level)}</span>
          <span dir="ltr">{ar(into)} / {ar(need)}</span>
        </div>
      )}
      <div className="relative h-3.5 overflow-hidden rounded-full border border-grape-200 bg-grape-100">
        <div className="xp-fill h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: pct + "%" }} />
      </div>
    </div>
  );
}

/* ===== نافذة منبثقة (Portal — فوق كل شيء) ===== */
export function Modal({
  open,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <div className="anim-fade fixed inset-0 bg-grape-950/60 backdrop-blur-[3px]" onClick={onClose} />
      <div className="pointer-events-none relative flex min-h-full items-center justify-center p-4">
        <div
          className={`anim-pop pointer-events-auto my-6 w-full rounded-[28px] border border-grape-200 bg-white shadow-[0_28px_80px_-28px_rgba(33,22,75,.5)] ${
            wide ? "max-w-2xl" : "max-w-md"
          }`}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ===== ترويسة قسم ===== */
export function SectionHead({
  icon,
  title,
  desc,
  color = "bg-grape-100 text-grape-600",
  extra,
}: {
  icon: string;
  title: string;
  desc?: string;
  color?: string;
  extra?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 rounded-[24px] border border-white/80 bg-white/70 p-4 shadow-[0_18px_50px_-40px_rgba(76,29,149,.6)] backdrop-blur-sm">
      <span className={`grid h-12 w-12 place-items-center rounded-2xl ${color}`}>
        <Icon name={icon} className="h-6 w-6" strokeWidth={2.2} />
      </span>
      <div className="flex-1 min-w-40">
        <h2 className="font-display text-2xl font-extrabold leading-7 text-ink">{title}</h2>
        {desc && <p className="text-sm text-grape-700/70">{desc}</p>}
      </div>
      {extra}
    </div>
  );
}

/* ===== زر أساسي ===== */
export function BigBtn({
  children,
  onClick,
  disabled = false,
  color = "bg-gradient-to-l from-grape-600 to-grape-500 hover:brightness-105 shadow-[0_12px_28px_-14px_rgba(88,59,195,.9)]",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  color?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 font-display text-lg font-bold text-white transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:translate-y-0 ${color} ${className}`}
    >
      {children}
    </button>
  );
}
