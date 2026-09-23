/* وضع الطالب — يشاهد مستواه ونقاطه ونتيجة الأسبوع، ويدخل متجره وحقيبته */
import { useEffect, useState } from "react";
import { useApp } from "../appState";
import { ar, attendedDays, denseWeekRanking, denseXpRanking, DAYS, DAY_PARTS, levelInfo, MAX_LEVEL, rankOf, xpForLevel, type BgKind } from "../core";
import Avatar from "./Avatar";
import StudentBag from "./Bag";
import { StudentShop } from "./Store";
import { CoinChip, heartFade, HeartsRow, Icon, LevelBadge, Modal, XpBar } from "./ui";
import { sfx } from "../sound";

/* ===== خلفيات بطاقة البروفايل وألوان النص المناسبة ===== */
const BG_META: Record<string, { card: string; top: string; dark?: boolean }> = {
  red: { card: "border-red-400 bg-gradient-to-b from-red-300 via-red-200 to-rose-100", top: "bg-gradient-to-b from-white/50 to-transparent" },
  orange: { card: "border-orange-400 bg-gradient-to-b from-orange-300 via-orange-200 to-amber-100", top: "bg-gradient-to-b from-white/50 to-transparent" },
  yellow: { card: "border-yellow-400 bg-gradient-to-b from-yellow-300 via-amber-200 to-yellow-100", top: "bg-gradient-to-b from-white/50 to-transparent" },
  green: { card: "border-green-500 bg-gradient-to-b from-green-300 via-green-200 to-lime-100", top: "bg-gradient-to-b from-white/50 to-transparent" },
  sky: { card: "border-sky-400 bg-gradient-to-b from-sky-300 via-sky-200 to-cyan-100", top: "bg-gradient-to-b from-white/50 to-transparent" },
  blue: { card: "border-blue-500 bg-gradient-to-b from-blue-300 via-blue-200 to-sky-100", top: "bg-gradient-to-b from-white/50 to-transparent" },
  purple: { card: "border-purple-500 bg-gradient-to-b from-purple-300 via-purple-200 to-fuchsia-100", top: "bg-gradient-to-b from-white/50 to-transparent" },
  pink: { card: "border-pink-400 bg-gradient-to-b from-pink-300 via-pink-200 to-rose-100", top: "bg-gradient-to-b from-white/50 to-transparent" },
  night: { card: "border-indigo-500 bg-gradient-to-b from-indigo-950 via-purple-950 to-slate-900", top: "bg-gradient-to-b from-white/10 to-transparent", dark: true },
};
const cardBgCls = (bg?: BgKind | null): string => (bg && BG_META[bg] ? BG_META[bg].card : "border-grape-200 bg-white");
const cardTopCls = (bg?: BgKind | null): string => (bg && BG_META[bg] ? BG_META[bg].top : "bg-gradient-to-b from-grape-100 to-transparent");
const cardIsDark = (bg?: BgKind | null): boolean => !!(bg && BG_META[bg]?.dark);

/* ===== شريط المستوى ===== */
function LevelTrack({ xp }: { xp: number }) {
  const { level, into, need, legend } = levelInfo(xp);
  const isLegend = legend > 0;
  const toNext = need - into;
  return (
    <div className={`rounded-[24px] border-2 p-5 ${isLegend ? "border-gold-500/60 bg-gradient-to-b from-gold-400/15 to-white" : "border-grape-200 bg-white"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-display text-lg font-extrabold text-ink">
          <Icon name={isLegend ? "sparkle" : "shield"} className={`h-5 w-5 ${isLegend ? "text-gold-600" : "text-grape-600"}`} strokeWidth={2.2} />
          {isLegend ? "المسار الأسطوري" : "شريط المستوى"}
        </p>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 font-display text-sm font-extrabold text-white shadow-[0_2px_0_#56289d] ${isLegend ? "anim-glow bg-gold-500" : "bg-grape-600"}`}>
            المستوى {ar(level)}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-gold-400/25 px-3 py-1 text-xs font-extrabold text-gold-600">
            {rankOf(level)}
            {isLegend && <span className="font-display">{"★".repeat(Math.min(legend, 5))}{legend > 5 ? "+" : ""}</span>}
          </span>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex items-end gap-0.5 sm:gap-1.5">
          {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((l) => {
            const done = l < level;
            const cur = l === level;
            return (
              <div key={l} className="min-w-0 flex-1">
                <div className={`w-full rounded-t-md transition-all sm:rounded-t-lg ${cur ? "anim-glow h-9 bg-gradient-to-t from-gold-600 to-gold-300" : done || isLegend ? "h-7 bg-gradient-to-t from-grape-600 to-grape-400" : "h-5 bg-grape-100"}`} />
                <p className={`mt-1 text-center text-xs font-extrabold sm:text-xs ${cur ? "text-gold-600" : done || isLegend ? "text-grape-600" : "text-grape-300"}`}>{ar(l)}</p>
              </div>
            );
          })}
        </div>
        <div className={`mt-2 flex flex-wrap items-center justify-between gap-1.5 rounded-xl px-3 py-2 ${isLegend ? "bg-gold-400/20" : "bg-grape-50"}`}>
          <span className={`text-xs font-extrabold ${isLegend ? "text-gold-600" : "text-grape-600"}`}>
            {isLegend
              ? `أسطورة الحفاظ — جمعت ${ar(legend)} ${legend === 1 ? "نجمة أسطورية" : "نجوم أسطورية"}، واصل فكل مستوى جديد يضيف نجمة!`
              : `بقي ${ar(toNext)} نقطة لتصل إلى المستوى ${ar(level + 1)}`}
          </span>
          <span className="text-xs font-bold text-grape-700/55">{ar(into)} / {ar(need)}</span>
        </div>
      </div>
    </div>
  );
}

function StatBox({ icon, color, label, value, sub }: { icon: string; color: string; label: string; value: string; sub?: string }) {
  return (
    <div className="anim-slide-up card-shine rounded-2xl border-2 border-grape-200 bg-white p-4">
      <span className={`mb-2 grid h-10 w-10 place-items-center rounded-xl ${color}`}>
        <Icon name={icon} className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <p className="font-display text-2xl font-extrabold leading-7 text-ink">{value}</p>
      <p className="text-xs font-bold text-grape-700/60">
        {label} {sub && <span className="text-grape-500">· {sub}</span>}
      </p>
    </div>
  );
}

export default function StudentView() {
  const { sorted, products } = useApp();
  const [activeId, setActiveId] = useState<string | null>(sorted[0]?.id ?? null);
  const [shopOpen, setShopOpen] = useState(false);
  const [bagOpen, setBagOpen] = useState(false);

  useEffect(() => {
    if (!sorted.some((s) => s.id === activeId)) setActiveId(sorted[0]?.id ?? null);
  }, [sorted, activeId]);

  const s = sorted.find((x) => x.id === activeId) ?? null;
  const { level, legend } = s ? levelInfo(s.xp) : { level: 1, legend: 0 };
  const totalRank = denseXpRanking(sorted).find((entry) => entry.student.id === activeId)?.rank ?? 0;
  const weekRank = denseWeekRanking(sorted).find((entry) => entry.student.id === activeId)?.rank ?? 0;
  const checkedDays = s ? attendedDays(s) : 0;
  const checkedSlots = s ? DAYS.reduce((n, d) => n + DAY_PARTS.filter((p) => s.days[d.key][p.key]).length, 0) : 0;
  const dark = s ? cardIsDark(s.cardBg) : false;

  return (
    <div className="anim-fade">
      {/* اختيار الطالب */}
      <div className="mb-6 rounded-[24px] border-2 border-grape-200 bg-white p-4">
        <p className="mb-3 flex items-center gap-2 font-display text-base font-extrabold text-ink">
          <Icon name="eye" className="h-5 w-5 text-grape-500" strokeWidth={2.2} />
          وضع العرض — من أنت؟ اضغط على صورتك
        </p>
        <div className="flex flex-wrap gap-2.5">
          {sorted.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => { setActiveId(st.id); sfx.click(); }}
              className={`flex items-center gap-2 rounded-2xl border-2 py-1.5 pe-4 ps-1.5 transition-all active:scale-95 ${
                st.id === activeId ? "border-grape-600 bg-grape-600 text-white shadow-[0_4px_0_#56289d]" : "border-grape-200 bg-white text-ink hover:border-grape-400"
              }`}
            >
              <div className={heartFade(st.hearts)}>
                <Avatar photo={st.photo} name={st.name} size={38} />
              </div>
              <span className="font-display text-sm font-extrabold">{st.name}</span>
            </button>
          ))}
        </div>
      </div>

      {!s ? (
        <p className="rounded-3xl border-2 border-dashed border-grape-200 bg-white p-14 text-center font-bold text-grape-400">لا يوجد طلاب بعد</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* البطاقة الشخصية */}
          <div className={`card-shine relative overflow-hidden rounded-[28px] border-2 p-6 text-center lg:col-span-1 ${s.hearts === 0 ? "grayscale" : ""} ${cardBgCls(s.cardBg)}`}>
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 ${cardTopCls(s.cardBg)}`} />
            <div className="relative flex flex-col items-center">
              <Avatar photo={s.photo} name={s.name} size={128} frame={s.frame} crown={s.crown} glow={s.glow} />
              <h2 className={`mt-3 font-display text-3xl font-extrabold ${dark ? "text-white" : "text-ink"}`}>{s.name}</h2>
              <p className={`mt-0.5 text-sm font-bold ${dark ? "text-gold-300" : "text-grape-500"}`}>{rankOf(level)}{legend > 0 ? ` ★${ar(legend)}` : ""}</p>
              <div className="mt-2"><LevelBadge level={level} /></div>
              <div className="mt-4 flex items-center justify-center gap-2">
                <HeartsRow hearts={s.hearts} max={3} size="w-7 h-7" />
              </div>
              {s.hearts === 0 && (
                <p className="mt-2 rounded-xl bg-slate-200 px-3 py-1.5 text-xs font-extrabold text-slate-500">
                  نفدت قلوبك — تستمر بجمع العملات، واشترِ قلبًا من متجرك لتعود لنقاط المستوى
                </p>
              )}
              <div className="mt-4 w-full"><XpBar xp={s.xp} /></div>
              <div className="mt-4 flex w-full flex-wrap items-center justify-center gap-2">
                <CoinChip value={s.coins} className="px-3.5! py-1! text-base!" />
                <button type="button" onClick={() => { setShopOpen(true); sfx.coin(); }} className="flex items-center gap-1.5 rounded-full bg-gold-500 px-4 py-1.5 font-display text-sm font-extrabold text-white shadow-[0_3px_0_#b57a0a] transition-all hover:brightness-110 active:translate-y-0.5 active:shadow-none">
                  <Icon name="store" className="h-4 w-4" strokeWidth={2.4} />
                  متجري
                </button>
                <button type="button" onClick={() => { setBagOpen(true); sfx.pop(); }} className="flex items-center gap-1.5 rounded-full bg-grape-600 px-4 py-1.5 font-display text-sm font-extrabold text-white shadow-[0_3px_0_#56289d] transition-all hover:bg-grape-700 active:translate-y-0.5 active:shadow-none">
                  <Icon name="gift" className="h-4 w-4" strokeWidth={2.4} />
                  حقيبتي
                </button>
              </div>
            </div>
          </div>

          {/* الأرقام والنتائج */}
          <div className="space-y-5 lg:col-span-2">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatBox icon="bolt" color="bg-grape-600/12 text-grape-600" label="إجمالي النقاط" value={ar(s.xp)} />
              <StatBox icon="star" color="bg-gold-400/25 text-gold-600" label="نقاط هذا الأسبوع" value={`+${ar(s.weekXp)}`} sub={`المركز ${s.weekXp > 0 ? ar(weekRank) : "—"}`} />
              <StatBox icon="trophy" color="bg-mint-400/20 text-mint-600" label="ترتيبك العام" value={ar(totalRank)} sub={`من ${ar(sorted.length)}`} />
            </div>

            <LevelTrack xp={s.xp} />

            {/* كشف الأسبوع كما يراه الطالب */}
            <div className="rounded-[24px] border-2 border-grape-200 bg-white p-5">
              <p className="mb-3 flex flex-wrap items-center gap-2 font-display text-lg font-extrabold text-ink">
                <Icon name="calendar" className="h-5 w-5 text-grape-500" strokeWidth={2.2} />
                كشفي هذا الأسبوع
                <span className="text-xs font-bold text-grape-700/50">{ar(checkedDays)}/٤ أيام حضور · {ar(checkedSlots)}/١٢ خانة</span>
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {DAYS.map((d) => {
                  const attended = s.days[d.key].a;
                  return (
                    <div key={d.key} className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-2.5 ${attended ? "border-mint-600 bg-mint-400/15" : "border-dashed border-grape-200 bg-grape-50"}`}>
                      <span className={`text-xs font-extrabold ${attended ? "text-mint-600" : "text-grape-300"}`}>{d.label}</span>
                      <div className="flex items-center gap-1">
                        {DAY_PARTS.map((p) => {
                          const on = s.days[d.key][p.key];
                          return (
                            <span
                              key={p.key}
                              title={p.label}
                              className={`grid h-6 w-6 place-items-center rounded-md border ${
                                on
                                  ? p.key === "a" ? "border-mint-600/60 bg-mint-400/30 text-mint-600"
                                    : p.key === "h" ? "border-grape-500/60 bg-grape-600/15 text-grape-600"
                                    : "border-gold-500/70 bg-gold-400/30 text-gold-600"
                                  : "border-grape-200 bg-white text-grape-200"
                              }`}
                            >
                              {on ? <Icon name="check" className="h-3 w-3" strokeWidth={3.4} /> : <Icon name={p.icon} className="h-3 w-3" strokeWidth={2.4} />}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-grape-700/55">
                <span className="flex items-center gap-1"><Icon name="user" className="h-3 w-3" strokeWidth={2.6} /> حضور</span>
                <span className="flex items-center gap-1"><Icon name="book" className="h-3 w-3" strokeWidth={2.4} /> تسميع حفظ</span>
                <span className="flex items-center gap-1"><Icon name="refresh" className="h-3 w-3" strokeWidth={2.4} /> تسميع مراجعة</span>
              </p>
            </div>

            {/* الجوائز والممتلكات */}
            <div className="rounded-[24px] border-2 border-grape-200 bg-white p-5">
              <p className="mb-3 flex items-center gap-2 font-display text-lg font-extrabold text-ink">
                <Icon name="medal" className="h-5 w-5 text-gold-600" strokeWidth={2.2} />
                جوائزي وممتلكاتي
              </p>
              {s.awards.length === 0 && s.inventory.length === 0 && s.bag.length === 0 ? (
                <p className="text-sm font-bold text-grape-400">لا شيء بعد — واصل السماع والتسميع وستمتلئ هذه الخزانة</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {s.awards.map((a) => (
                    <span key={a.id} className="flex items-center gap-1.5 rounded-full border-2 border-gold-500/50 bg-gold-400/15 px-3 py-1.5 text-xs font-extrabold text-gold-600">
                      <Icon name="trophy" className="h-3.5 w-3.5" strokeWidth={2.4} />
                      {a.title}
                    </span>
                  ))}
                  {s.inventory.map((pid) => {
                    const p = products.find((x) => x.id === pid);
                    if (!p) return null;
                    return (
                      <span key={pid} className="flex items-center gap-1.5 rounded-full border-2 border-grape-200 bg-grape-50 px-3 py-1.5 text-xs font-extrabold text-grape-600">
                        <Icon name={p.icon} className="h-3.5 w-3.5" strokeWidth={2.4} />
                        {p.name}
                      </span>
                    );
                  })}
                  {s.bag.map((b) => {
                    const p = products.find((x) => x.id === b.itemId);
                    if (!p) return null;
                    return (
                      <span key={b.itemId} className="flex items-center gap-1.5 rounded-full border-2 border-mint-400/50 bg-mint-400/15 px-3 py-1.5 text-xs font-extrabold text-mint-600">
                        <Icon name="gift" className="h-3.5 w-3.5" strokeWidth={2.4} />
                        {p.name} ×{ar(b.qty)}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* متجر الطالب */}
      {s && shopOpen && (
        <Modal open onClose={() => setShopOpen(false)} wide>
          <div className="p-5">
            <StudentShop s={s} />
            <div className="mt-4 text-center">
              <button type="button" onClick={() => setShopOpen(false)} className="rounded-2xl border-2 border-grape-200 bg-white px-8 py-2.5 font-display font-bold text-grape-500 transition hover:bg-grape-50">
                إغلاق المتجر
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* حقيبة الطالب */}
      {s && bagOpen && (
        <Modal open onClose={() => setBagOpen(false)} wide>
          <div className="p-5">
            <StudentBag s={s} />
            <div className="mt-4 text-center">
              <button type="button" onClick={() => setBagOpen(false)} className="rounded-2xl border-2 border-grape-200 bg-white px-8 py-2.5 font-display font-bold text-grape-500 transition hover:bg-grape-50">
                إغلاق الحقيبة
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
