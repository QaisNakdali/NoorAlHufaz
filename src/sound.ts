/* مؤثرات صوتية خفيفة مولّدة عبر WebAudio — لا تحتاج أي ملفات خارجية */

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(v: boolean) {
  enabled = v;
}

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  at: number,
  dur: number,
  type: OscillatorType = "sine",
  vol = 0.12,
  slideTo?: number
) {
  const c = ac();
  if (!c || !enabled) return;
  try {
    const t0 = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  } catch {
    /* تجاهل أي خطأ صوتي */
  }
}

export const sfx = {
  click() { tone(660, 0, 0.05, "triangle", 0.06); },
  pop() { tone(520, 0, 0.09, "triangle", 0.16); tone(780, 0.04, 0.09, "triangle", 0.12); },
  coin() { tone(988, 0, 0.07, "square", 0.06); tone(1319, 0.07, 0.14, "square", 0.06); },
  sparkle() { [1180, 1480, 1820, 2240].forEach((f, i) => tone(f, i * 0.055, 0.13, "sine", 0.06)); },
  levelUp() { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.085, 0.17, "square", 0.055)); },
  fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.2, "triangle", 0.14));
    tone(1319, 0.46, 0.5, "triangle", 0.12);
    tone(1568, 0.62, 0.55, "sine", 0.1);
  },
  drum() {
    for (let i = 0; i < 10; i++) tone(140 + Math.random() * 70, i * 0.07, 0.05, "triangle", 0.1);
    tone(210, 0.72, 0.3, "sine", 0.16, 90);
  },
  whoosh() { tone(280, 0, 0.32, "sine", 0.08, 900); },
  error() { tone(220, 0, 0.16, "sawtooth", 0.06, 150); tone(160, 0.13, 0.2, "sawtooth", 0.06, 110); },
};
