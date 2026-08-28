/* خلفية حيّة: توهّجات بنفسجية، نجوم بكسلية تومض، وغيوم مكعّبة تنجرف */

const STARS = [
  { t: "8%", l: "6%", s: 14, d: "0s" },
  { t: "16%", l: "88%", s: 18, d: "0.4s" },
  { t: "30%", l: "14%", s: 10, d: "1.1s" },
  { t: "24%", l: "72%", s: 12, d: "0.8s" },
  { t: "46%", l: "4%", s: 16, d: "1.6s" },
  { t: "58%", l: "93%", s: 12, d: "0.2s" },
  { t: "70%", l: "10%", s: 11, d: "2s" },
  { t: "78%", l: "84%", s: 16, d: "1.3s" },
  { t: "88%", l: "24%", s: 13, d: "0.6s" },
  { t: "84%", l: "64%", s: 10, d: "1.8s" },
  { t: "12%", l: "44%", s: 9, d: "2.3s" },
  { t: "38%", l: "92%", s: 9, d: "1s" },
  { t: "64%", l: "30%", s: 8, d: "0.3s" },
  { t: "52%", l: "58%", s: 9, d: "2.6s" },
];

function PixelStar({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 7 7" width={size} height={size} shapeRendering="crispEdges" aria-hidden>
      <g fill="#b28aff">
        <rect x="3" y="0" width="1" height="7" />
        <rect x="0" y="3" width="7" height="1" />
        <rect x="1" y="1" width="1" height="1" fill="#d9c2ff" />
        <rect x="5" y="1" width="1" height="1" fill="#d9c2ff" />
      </g>
    </svg>
  );
}

function PixelCloud({ width = 170, className = "" }: { width?: number; className?: string }) {
  return (
    <svg viewBox="0 0 14 6" width={width} shapeRendering="crispEdges" className={className} aria-hidden>
      <g fill="#ffffff">
        <rect x="3" y="1" width="6" height="1" />
        <rect x="2" y="2" width="10" height="1" />
        <rect x="1" y="3" width="12" height="2" />
        <rect x="2" y="5" width="10" height="1" />
      </g>
    </svg>
  );
}

export default function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div
        className="absolute -top-40 -start-40 h-[520px] w-[520px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(178,138,255,0.32), transparent 68%)" }}
      />
      <div
        className="absolute -bottom-48 -end-32 h-[560px] w-[560px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,215,94,0.26), transparent 68%)" }}
      />
      <div
        className="absolute top-1/3 start-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(62,220,151,0.13), transparent 70%)" }}
      />
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, #56289d 0 1.5px, transparent 1.5px 26px), repeating-linear-gradient(90deg, #56289d 0 1.5px, transparent 1.5px 26px)",
        }}
      />
      {STARS.map((s, i) => (
        <div key={i} className="anim-twinkle absolute" style={{ top: s.t, left: s.l, animationDelay: s.d }}>
          <PixelStar size={s.s} />
        </div>
      ))}
      <div className="absolute top-[9%] start-0 opacity-70" style={{ animation: "drift-x 75s linear infinite", animationDelay: "-20s" }}>
        <PixelCloud width={180} />
      </div>
      <div className="absolute top-[34%] start-0 opacity-50" style={{ animation: "drift-x 105s linear infinite", animationDelay: "-60s" }}>
        <PixelCloud width={130} />
      </div>
      <div className="absolute top-[68%] start-0 opacity-60" style={{ animation: "drift-x 90s linear infinite", animationDelay: "-8s" }}>
        <PixelCloud width={210} />
      </div>
    </div>
  );
}
