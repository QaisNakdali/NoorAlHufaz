/* صور توضيحية تلقائية لخصائص البروفايل — لكل خاصية رسمها المميز بلونها،
   بدل أيقونة مكررة واحدة. تُستخدم في المتجر والحقيبة والحفل. */
import { useId } from "react";

/* صورة شخص رمزية موحّدة داخل الرسوم */
function Silhouette({
  cx = 60,
  cy = 52,
  scale = 1,
  fill = "#ffffff",
  opacity = 0.92,
}: {
  cx?: number;
  cy?: number;
  scale?: number;
  fill?: string;
  opacity?: number;
}) {
  const r = 16 * scale;
  return (
    <g fill={fill} opacity={opacity}>
      <circle cx={cx} cy={cy} r={r} />
      <path d={`M ${cx - r * 1.9} ${cy + r * 2.9} a ${r * 1.9} ${r * 1.7} 0 0 1 ${r * 3.8} 0 z`} />
    </g>
  );
}

/* نجمة رباعية لامعة */
function Star4({ x, y, r, fill, opacity = 1 }: { x: number; y: number; r: number; fill: string; opacity?: number }) {
  return (
    <path
      d={`M ${x} ${y - r} Q ${x} ${y} ${x + r} ${y} Q ${x} ${y} ${x} ${y + r} Q ${x} ${y} ${x - r} ${y} Q ${x} ${y} ${x} ${y - r} z`}
      fill={fill}
      opacity={opacity}
    />
  );
}

const FRAME_SOLID: Record<string, string> = {
  silver: "#c3cad6",
  gold: "#f7b733",
  emerald: "#10b981",
  coral: "#fb7185",
  sky: "#38bdf8",
};

const GLOW_COLORS: Record<string, string> = {
  gold: "#f7b733",
  purple: "#9a64f6",
  mint: "#3edc97",
  coral: "#fb7185",
};

/** [فاتح, غامق, لون النجوم] */
const BG_GRAD: Record<string, [string, string, string]> = {
  red: ["#fda4af", "#e11d48", "#fff1f2"],
  orange: ["#fed7aa", "#ea580c", "#fff7ed"],
  yellow: ["#fde68a", "#d97706", "#fffbeb"],
  green: ["#bbf7d0", "#16a34a", "#f0fdf4"],
  sky: ["#bae6fd", "#0284c7", "#f0f9ff"],
  blue: ["#bfdbfe", "#2563eb", "#eff6ff"],
  purple: ["#ddd6fe", "#7c3aed", "#f5f3ff"],
  pink: ["#fbcfe8", "#db2777", "#fdf2f8"],
  night: ["#4338ca", "#1e1b4b", "#fde68a"],
};

/* ===== إطار حول الصورة بلونه ===== */
function FrameThumb({ value }: { value: string }) {
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const isGradient = value === "sunset" || value === "rainbow";
  const solid = FRAME_SOLID[value] ?? "#c9afff";
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden>
      <defs>
        {value === "sunset" && (
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fb923c" />
            <stop offset="1" stopColor="#f472b6" />
          </linearGradient>
        )}
        {value === "rainbow" && (
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f87171" />
            <stop offset="0.25" stopColor="#facc15" />
            <stop offset="0.5" stopColor="#4ade80" />
            <stop offset="0.75" stopColor="#38bdf8" />
            <stop offset="1" stopColor="#a78bfa" />
          </linearGradient>
        )}
        <clipPath id={gid + "c"}>
          <rect x="24" y="24" width="72" height="72" rx="12" />
        </clipPath>
      </defs>
      <rect x="4" y="4" width="112" height="112" rx="20" fill="#f7f2ff" />
      <rect x="8" y="8" width="104" height="104" rx="17" fill={isGradient ? `url(#${gid})` : solid} />
      <rect x="24" y="24" width="72" height="72" rx="12" fill="#ffffff" />
      <g clipPath={`url(#${gid}c)`}>
        <Silhouette cx={60} cy={54} scale={0.9} fill="#e2d5f8" />
      </g>
      <path d="M 20 36 L 36 20" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" opacity="0.55" />
      <Star4 x={98} y={24} r={6} fill="#ffffff" opacity={0.8} />
    </svg>
  );
}

/* ===== توهّج حول الشخص بلونه ===== */
function GlowThumb({ value }: { value: string }) {
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const c = GLOW_COLORS[value] ?? "#9a64f6";
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden>
      <defs>
        <radialGradient id={gid}>
          <stop offset="0.25" stopColor={c} stopOpacity="0.9" />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="120" height="120" rx="18" fill="#2a124f" />
      <circle cx="18" cy="22" r="2" fill="#fff" opacity="0.5" />
      <circle cx="100" cy="30" r="1.6" fill="#fff" opacity="0.4" />
      <circle cx="94" cy="96" r="2" fill="#fff" opacity="0.45" />
      <circle cx="24" cy="98" r="1.5" fill="#fff" opacity="0.35" />
      <circle cx="60" cy="60" r="48" fill={`url(#${gid})`} />
      <Silhouette cx={60} cy={58} scale={0.95} fill="#ffffff" opacity={0.95} />
      <Star4 x={92} y={42} r={6} fill={c} opacity={0.9} />
      <Star4 x={28} y={78} r={5} fill={c} opacity={0.7} />
    </svg>
  );
}

/* ===== خلفية البطاقة بلونها ===== */
function BgThumb({ value }: { value: string }) {
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const g = BG_GRAD[value] ?? BG_GRAD.purple;
  const night = value === "night";
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={g[0]} />
          <stop offset="1" stopColor={g[1]} />
        </linearGradient>
        <clipPath id={gid + "c"}>
          <rect width="120" height="120" rx="18" />
        </clipPath>
      </defs>
      <rect width="120" height="120" rx="18" fill={`url(#${gid})`} />
      <rect x="1.5" y="1.5" width="117" height="117" rx="17" fill="none" stroke={g[1]} strokeWidth="3" opacity="0.7" />
      <Star4 x={22} y={26} r={7} fill={g[2]} />
      <Star4 x={98} y={34} r={5} fill={g[2]} opacity={0.85} />
      <Star4 x={90} y={94} r={6} fill={g[2]} opacity={0.8} />
      <Star4 x={26} y={92} r={4.5} fill={g[2]} opacity={0.7} />
      {night && <circle cx="96" cy="22" r="9" fill="#fde68a" opacity="0.9" />}
      <g clipPath={`url(#${gid}c)`}>
        <Silhouette cx={60} cy={56} scale={1} fill="#ffffff" opacity={night ? 0.95 : 0.88} />
      </g>
    </svg>
  );
}

/* ===== تاج ذهبي أو فضي ===== */
function CrownThumb({ value }: { value: string }) {
  const gold = value !== "silver";
  const main = gold ? "#ffd75e" : "#e3e9f2";
  const dark = gold ? "#f7a41d" : "#aab4c4";
  const bg = gold ? "#fdf3d8" : "#eef1f6";
  const star = gold ? "#f7b733" : "#c3cad6";
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden>
      <rect width="120" height="120" rx="18" fill={bg} />
      <g stroke={dark} strokeWidth="3" strokeLinejoin="round">
        <path
          d="M30 46 L38 30 L46 46 L54 26 L60 42 L66 26 L74 46 L82 30 L90 46 L86 78 L34 78 z"
          fill={main}
        />
        <rect x="34" y="78" width="52" height="11" rx="3.5" fill={dark} stroke="none" />
      </g>
      <circle cx="48" cy="62" r="4" fill="#f75f80" stroke="#b23a55" strokeWidth="1.5" />
      <circle cx="60" cy="62" r="4" fill="#38bdf8" stroke="#0369a1" strokeWidth="1.5" />
      <circle cx="72" cy="62" r="4" fill="#4ade80" stroke="#15803d" strokeWidth="1.5" />
      <Star4 x={94} y={32} r={7} fill={star} />
      <Star4 x={26} y={92} r={5} fill={star} opacity={0.75} />
    </svg>
  );
}

/** يختار الرسم المناسب حسب خانة الخاصية ولونها */
export default function CosmeticThumb({
  slot,
  value,
  className = "h-full w-full",
}: {
  slot?: string;
  value?: string;
  className?: string;
}) {
  const v = value ?? "";
  let inner: React.ReactNode;
  if (slot === "crown") inner = <CrownThumb value={v || "gold"} />;
  else if (slot === "glow") inner = <GlowThumb value={v || "purple"} />;
  else if (slot === "cardbg") inner = <BgThumb value={v || "purple"} />;
  else inner = <FrameThumb value={v || "silver"} />;
  return <div className={className}>{inner}</div>;
}
