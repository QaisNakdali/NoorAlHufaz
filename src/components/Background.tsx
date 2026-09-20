/* خلفية مرحة وهادئة: مناسبة للأطفال بلا ازدحام بصري. */
const DOTS = [
  ["8%", "7%", "#a78bfa"], ["15%", "88%", "#f9c74f"], ["31%", "4%", "#67e8c0"],
  ["48%", "94%", "#c4b5fd"], ["67%", "8%", "#fda4af"], ["82%", "87%", "#a78bfa"],
];

export default function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#faf8ff_0%,#f7f4ff_46%,#fbfaff_100%)]" />
      <div className="absolute -top-56 -end-40 h-[520px] w-[520px] rounded-full bg-grape-300/25 blur-3xl" />
      <div className="absolute top-[38%] -start-52 h-[480px] w-[480px] rounded-full bg-mint-200/25 blur-3xl" />
      <div className="absolute -bottom-60 end-[8%] h-[520px] w-[520px] rounded-full bg-gold-300/20 blur-3xl" />
      <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: "radial-gradient(#6d50df 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
      {DOTS.map(([top, left, color], i) => (
        <span key={i} className="anim-float absolute h-2.5 w-2.5 rotate-45 rounded-[3px]" style={{ top, left, backgroundColor: color, animationDelay: `${i * .45}s` }} />
      ))}
    </div>
  );
}
