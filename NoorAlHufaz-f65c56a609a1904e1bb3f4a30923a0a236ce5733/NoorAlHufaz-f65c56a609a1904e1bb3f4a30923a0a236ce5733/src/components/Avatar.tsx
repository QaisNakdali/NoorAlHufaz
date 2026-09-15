/* صورة الطالب كما هي — مربعة بأسلوب ماين كرافت، مع إطار وتاج وتوهّج إن اشتراها */
import { nameColor } from "../photos";
import type { CrownKind, FrameKind, GlowKind } from "../core";

function Crown({ width, kind }: { width: number; kind: CrownKind }) {
  const main = kind === "gold" ? "#ffd75e" : "#e3e9f2";
  const dark = kind === "gold" ? "#dd9511" : "#aab4c4";
  return (
    <svg viewBox="0 0 12 7" width={width} height={width * 0.6} className="drop-shadow-[0_2px_3px_rgba(181,122,10,0.5)]" aria-hidden>
      <g fill={main} stroke={dark} strokeWidth="0.4">
        <rect x="1" y="0" width="1.4" height="3.4" />
        <rect x="5.3" y="0" width="1.4" height="3.4" />
        <rect x="9.6" y="0" width="1.4" height="3.4" />
        <rect x="1" y="3.2" width="10" height="2.2" rx="0.4" />
      </g>
    </svg>
  );
}

/* نصف قطر الزوايا يتناسب مع الحجم — مربع بحواف ناعمة */
const rad = (size: number) => Math.max(6, Math.round(size * 0.16));

const FRAME_COLORS: Record<string, { border: string; shadow: string }> = {
  gold: { border: "#f7b733", shadow: "0 0 18px rgba(247,183,51,0.55), inset 0 0 6px rgba(247,183,51,0.5)" },
  silver: { border: "#b9c2cf", shadow: "0 0 14px rgba(148,163,184,0.5)" },
  emerald: { border: "#10b981", shadow: "0 0 16px rgba(16,185,129,0.5)" },
  coral: { border: "#fb7185", shadow: "0 0 16px rgba(251,113,133,0.5)" },
  sky: { border: "#38bdf8", shadow: "0 0 16px rgba(56,189,248,0.5)" },
};

const GLOW_SHADOW: Record<string, string> = {
  gold: "0 0 26px 6px rgba(247,183,51,0.6)",
  purple: "0 0 26px 6px rgba(154,100,246,0.6)",
  mint: "0 0 26px 6px rgba(62,220,151,0.55)",
  coral: "0 0 26px 6px rgba(251,113,133,0.55)",
};

export default function Avatar({
  photo,
  name,
  size = 64,
  frame = null,
  crown = null,
  glow = null,
  className = "",
}: {
  photo: string | null;
  name: string;
  size?: number;
  frame?: FrameKind | null;
  crown?: CrownKind | null;
  glow?: GlowKind | null;
  className?: string;
}) {
  const ring = size * 0.055;
  const crownW = size * 0.52;
  const r = rad(size);
  const rInner = Math.max(3, r - Math.max(3, ring));
  const glowShadow = glow ? GLOW_SHADOW[glow] ?? "" : "";

  let frameStyle: React.CSSProperties = {};
  let frameCls = "border-[3px] border-grape-200";

  if (frame === "rainbow") {
    frameCls = "";
  } else if (frame === "sunset") {
    frameCls = "";
    frameStyle = {
      border: `${Math.max(3, ring)}px solid transparent`,
      background: "linear-gradient(#fff,#fff) padding-box, linear-gradient(135deg,#fb923c,#f472b6) border-box",
      boxShadow: glowShadow || "0 0 16px rgba(244,114,182,0.45)",
    };
  } else if (frame && FRAME_COLORS[frame]) {
    frameCls = "";
    frameStyle = {
      border: `${Math.max(3, ring)}px solid ${FRAME_COLORS[frame].border}`,
      boxShadow: [FRAME_COLORS[frame].shadow, glowShadow].filter(Boolean).join(", "),
    };
  } else if (glowShadow) {
    frameStyle = { boxShadow: glowShadow };
  }

  const inner = photo ? (
    <img
      src={photo}
      alt={name}
      width={size}
      height={size}
      className="h-full w-full object-cover"
      style={{ borderRadius: rInner }}
      draggable={false}
    />
  ) : (
    <div
      className="font-display grid h-full w-full place-items-center font-extrabold"
      style={{ ...nameColor(name), fontSize: size * 0.42, borderRadius: rInner }}
    >
      {name.trim().charAt(0) || "؟"}
    </div>
  );

  return (
    <div className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      {crown && (
        <div className="absolute left-1/2 z-10 -translate-x-1/2" style={{ top: -crownW * 0.52 }}>
          <Crown width={crownW} kind={crown} />
        </div>
      )}
      {frame === "rainbow" ? (
        <div
          className="anim-ring h-full w-full"
          style={{
            background: "conic-gradient(#f75f80,#f7b733,#3edc97,#21a6d6,#9a64f6,#f75f80)",
            padding: Math.max(3, ring),
            boxShadow: glowShadow || "0 0 18px rgba(154,100,246,0.45)",
            borderRadius: r,
          }}
        >
          <div className="h-full w-full overflow-hidden" style={{ borderRadius: rInner }}>
            {inner}
          </div>
        </div>
      ) : (
        <div className={`h-full w-full overflow-hidden bg-white ${frameCls}`} style={{ ...frameStyle, borderRadius: r }}>
          {inner}
        </div>
      )}
    </div>
  );
}
