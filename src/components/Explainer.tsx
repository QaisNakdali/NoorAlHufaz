/* الشرح التفاعلي — كيف تعمل المنصة كاملة (يُعرض للطلاب أول يوم) */
import { useState } from "react";
import { ar, ATTEND_COINS, ATTEND_XP, HEART_PRICE, MAX_HEARTS, MAX_LEVEL, RECITE_COINS, RECITE_XP, TITLES, TRIP_COIN_REWARD } from "../core";
import { Coin, Icon, Modal } from "./ui";

type HelpTab = "levels" | "coins" | "hearts" | "awards";

const TABS: { key: HelpTab; label: string; icon: string }[] = [
  { key: "levels", label: "المستويات", icon: "shield" },
  { key: "coins", label: "العملات", icon: "star" },
  { key: "hearts", label: "القلوب", icon: "heart" },
  { key: "awards", label: "الجوائز", icon: "trophy" },
];

function Stat({ icon, title, value, color }: { icon: string; title: string; value: string; color: string }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2 ${color}`}>
      <Icon name={icon} className="h-4.5 w-4.5 shrink-0" strokeWidth={2.2} />
      <div className="min-w-0">
        <p className="text-[10px] font-bold opacity-75">{title}</p>
        <p className="font-display text-sm font-extrabold leading-4">{value}</p>
      </div>
    </div>
  );
}

export default function ExplainerModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<HelpTab>("levels");

  return (
    <Modal open onClose={onClose} wide>
      <div className="p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gold-400 text-ink shadow-[0_3px_0_#b57a0a]">
            <Icon name="sparkle" fill className="h-6 w-6" />
          </span>
          <div className="flex-1">
            <h3 className="font-display text-2xl font-extrabold text-ink">كيف تعمل المنصة؟</h3>
            <p className="text-sm text-grape-700/70">دليلك السريع — اقرأه مرة واحدة وستعرف كل شيء</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-grape-100 text-grape-600 transition hover:bg-grape-200">
            <Icon name="x" className="h-5 w-5" strokeWidth={3} />
          </button>
        </div>

        {/* التبويبات */}
        <div className="mt-4 grid grid-cols-4 gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 px-1 py-2.5 text-xs font-extrabold transition active:scale-95 ${
                tab === t.key ? "border-grape-600 bg-grape-600 text-white shadow-[0_3px_0_#56289d]" : "border-grape-200 bg-white text-grape-500 hover:border-grape-400"
              }`}
            >
              <Icon name={t.icon} className="h-5 w-5" strokeWidth={2.2} fill={t.key === "hearts" || t.key === "coins"} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4 max-h-[52vh] overflow-y-auto rounded-2xl border-2 border-grape-100 bg-grape-50/60 p-4">
          {/* ===== المستويات ===== */}
          {tab === "levels" && (
            <div className="space-y-3">
              <p className="text-sm font-bold leading-6 text-grape-700/85">
                مستواك يرتفع بـ<b className="text-grape-600">نقاط الخبرة</b> التي تجمعها من الكشف كل يوم. كل مستوى جديد يعطيك{" "}
                <b className="text-gold-600">٢٥ عملة</b> هدية، ويقرّبك من لقب أجمل!
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat icon="user" title="مجرد الحضور" value={`+${ar(ATTEND_XP)} نقاط`} color="border-mint-400/50 bg-mint-400/15 text-mint-600" />
                <Stat icon="book" title="تسميع الحفظ" value={`+${ar(RECITE_XP)} نقاط`} color="border-grape-400/50 bg-grape-600/10 text-grape-600" />
                <Stat icon="refresh" title="تسميع المراجعة" value={`+${ar(RECITE_XP)} نقاط`} color="border-gold-500/50 bg-gold-400/20 text-gold-600" />
              </div>
              <div className="rounded-xl border-2 border-grape-200 bg-white p-3">
                <p className="mb-2 font-display text-sm font-extrabold text-ink">الألقاب — كل مستويين لهما لقب ({ar(MAX_LEVEL)} مستويات):</p>
                <div className="flex flex-wrap gap-1.5">
                  {TITLES.map((t, i) => (
                    <span key={t} className={`rounded-full px-3 py-1 text-xs font-extrabold ${i === TITLES.length - 1 ? "bg-gold-500 text-white" : "bg-grape-600/12 text-grape-600"}`}>
                      {t} <span className="opacity-70">({ar(i * 2 + 1)}–{ar(i * 2 + 2)})</span>
                    </span>
                  ))}
                  <span className="rounded-full bg-gradient-to-l from-gold-500 to-grape-600 px-3 py-1 text-xs font-extrabold text-white">أسطورة الحفاظ (بلا نهاية)</span>
                </div>
                <p className="mt-2 text-[11px] font-bold text-grape-700/60">
                  بعد المستوى {ar(MAX_LEVEL)} تبدأ رحلة «أسطورة الحفاظ» — كل مستوى جديد يضيف نجمة ★ ولا تتوقف أبدًا!
                </p>
              </div>
              <p className="rounded-xl border-2 border-gold-500/40 bg-gold-400/15 px-3 py-2 text-xs font-extrabold text-gold-600">
                في الأسبوع الكامل (٤ أيام × حضور+حفظ+مراجعة) تجمع ١٠٠ نقطة — أي مستوى جديد تقريبًا كل أسبوع ونصف.
              </p>
            </div>
          )}

          {/* ===== العملات ===== */}
          {tab === "coins" && (
            <div className="space-y-3">
              <p className="text-sm font-bold leading-6 text-grape-700/85">
                <b className="text-gold-600">العملات الذهبية</b> هي فلوسك داخل المتجر. تجمعها من التسميع، ومن هدية كل مستوى جديد، ومن الرحلات والجوائز — وتنفقها على الهدايا وخصائص البروفايل.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat icon="user" title="مجرد الحضور" value={`+${ar(ATTEND_COINS)} عملات`} color="border-mint-400/50 bg-mint-400/15 text-mint-600" />
                <Stat icon="book" title="تسميع الحفظ" value={`+${ar(RECITE_COINS)} عملات`} color="border-grape-400/50 bg-grape-600/10 text-grape-600" />
                <Stat icon="refresh" title="تسميع المراجعة" value={`+${ar(RECITE_COINS)} عملات`} color="border-gold-500/50 bg-gold-400/20 text-gold-600" />
                <Stat icon="shield" title="كل مستوى جديد" value="+٢٥ عملة" color="border-grape-400/50 bg-grape-600/10 text-grape-600" />
                <Stat icon="flag" title="حضور الرحلة" value={`+${ar(TRIP_COIN_REWARD)} عملة`} color="border-mint-400/50 bg-mint-400/15 text-mint-600" />
                <Stat icon="heart" title="شراء قلب جديد" value={`-${ar(HEART_PRICE)} عملة`} color="border-coral-400/50 bg-coral-500/10 text-coral-500" />
              </div>
              <p className="rounded-xl border-2 border-grape-200 bg-white px-3 py-2 text-xs font-bold leading-5 text-grape-700/70">
                العملات <b>لا تتوقف أبدًا</b>: حتى لو نفدت قلوبك تستمر بجمعها من التسميع، لكن <b>نقاط المستوى</b> تتوقف حتى تشتري قلبًا جديدًا.
              </p>
              <p className="rounded-xl border-2 border-gold-500/40 bg-gold-400/15 px-3 py-2 text-xs font-extrabold text-gold-600">
                في الأسبوع الكامل تجمع ~٤٨ عملة. ادّخرها للهدايا الكبيرة أو اجعلها أمانًا لقلبك!
              </p>
            </div>
          )}

          {/* ===== القلوب ===== */}
          {tab === "hearts" && (
            <div className="space-y-3">
              <p className="text-sm font-bold leading-6 text-grape-700/85">
                تبدأ بـ<b className="text-coral-500">{ar(MAX_HEARTS)} قلوب</b> ❤ — هي عنوان التزامك بآداب الحلقة. من يخالف الأدب يخصم المعلم منه قلبًا.
              </p>
              <div className="rounded-xl border-2 border-coral-400/50 bg-coral-500/10 p-3">
                <p className="font-display text-sm font-extrabold text-coral-500">ماذا يحدث عندما تخسر قلبًا؟</p>
                <ul className="mt-1.5 space-y-1 text-xs font-bold text-coral-500/90">
                  <li>• قلبان: صورتك تصير أقل إشراقًا قليلًا</li>
                  <li>• قلب واحد: تصير باهتة أكثر — تنبيه واضح!</li>
                  <li>• صفر قلوب: تصير <b>رمادية تمامًا</b>، وتتوقف نقاط مستواك (لكن العملات تستمر)</li>
                </ul>
              </div>
              <div className="rounded-xl border-2 border-mint-400/50 bg-mint-400/15 p-3">
                <p className="font-display text-sm font-extrabold text-mint-600">كيف ترجع قلوبك؟</p>
                <ul className="mt-1.5 space-y-1 text-xs font-bold text-mint-600/90">
                  <li>• تشتري قلبًا جديدًا من المتجر بـ{ar(HEART_PRICE)} عملة</li>
                  <li>• أو يمنحك المعلم قلبًا إذا رأى تحسّن أدبك</li>
                </ul>
              </div>
              <p className="rounded-xl border-2 border-grape-200 bg-white px-3 py-2 text-xs font-bold leading-5 text-grape-700/70">
                القلوب <b>لا تُصفّر</b> مع الأسبوع الجديد — تستمر كما هي، فاحرص عليها طوال الترم!
              </p>
            </div>
          )}

          {/* ===== الجوائز ===== */}
          {tab === "awards" && (
            <div className="space-y-3">
              <p className="text-sm font-bold leading-6 text-grape-700/85">
                كل أسبوع يقيم المعلم <b className="text-gold-600">حفلًا</b> يسلّم فيه الجوائز. حدّد هدفك من الآن!
              </p>
              <div className="rounded-xl border-2 border-gold-500/50 bg-gradient-to-b from-gold-400/20 to-white p-3">
                <p className="flex items-center gap-1.5 font-display text-sm font-extrabold text-gold-600">
                  <Icon name="trophy" className="h-4.5 w-4.5" strokeWidth={2.2} />
                  أبطال الأسبوع — المراكز الثلاثة (الأول +٣٠ · الثاني +٢٠ · الثالث +١٠)
                </p>
                <p className="mt-1 text-xs font-bold text-grape-700/70">البطولة <b>استحقاق</b> — لا يفوز بها إلا من جمع الصفات الثلاث في أسبوع واحد:</p>
                <div className="mt-2 space-y-1">
                  <p className="flex items-center gap-1.5 text-xs font-extrabold text-mint-600"><Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} /> حضر كل الأيام بلا غياب</p>
                  <p className="flex items-center gap-1.5 text-xs font-extrabold text-grape-600"><Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} /> سمّع الحفظ والمراجعة كل الأيام</p>
                  <p className="flex items-center gap-1.5 text-xs font-extrabold text-gold-600"><Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} /> حضر الرحلة (إذا كانت هناك رحلة)</p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border-2 border-grape-200 bg-white p-3">
                  <p className="flex items-center gap-1.5 font-display text-sm font-extrabold text-grape-600"><Icon name="trend" className="h-4 w-4" strokeWidth={2.2} /> الأكثر تطوّرًا</p>
                  <p className="mt-1 text-[11px] font-bold text-grape-700/70">+٢٠ عملة <b>وترفع مستواه</b> — لمن اجتهد أكثر من ورده</p>
                </div>
                <div className="rounded-xl border-2 border-grape-200 bg-white p-3">
                  <p className="flex items-center gap-1.5 font-display text-sm font-extrabold text-coral-500"><Icon name="heart" className="h-4 w-4" strokeWidth={2.2} /> أفضل سلوك</p>
                  <p className="mt-1 text-[11px] font-bold text-grape-700/70">+٢٠ عملة — قدوة في الأدب بلا قلوب مفقودة</p>
                </div>
              </div>
              <p className="rounded-xl border-2 border-grape-200 bg-white px-3 py-2 text-xs font-bold leading-5 text-grape-700/70">
                وفي <b className="text-coral-500">ختام الترم</b> يُعرض ترتيبكم الكامل من الأكثر للأقل — واصلوا الاجتهاد!
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-grape-700/60">
            <Coin className="h-4 w-4" />
            اجمع · تعلّم · ارتقِ
          </p>
          <button type="button" onClick={onClose} className="rounded-2xl bg-grape-600 px-6 py-2.5 font-display text-sm font-extrabold text-white shadow-[0_4px_0_#56289d] transition hover:bg-grape-700 active:translate-y-0.5 active:shadow-none">
            فهمت، يلا نبدأ!
          </button>
        </div>
      </div>
    </Modal>
  );
}
