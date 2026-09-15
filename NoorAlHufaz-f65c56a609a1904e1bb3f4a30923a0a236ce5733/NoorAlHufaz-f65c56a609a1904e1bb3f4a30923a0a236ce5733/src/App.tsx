import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AppProvider, useApp, type Toast } from "./appState";
import type { Tab } from "./core";
import { sfx } from "./sound";
import Background from "./components/Background";
import CeremonyPanel, { CeremonyShow } from "./components/Ceremony";
import Deliveries from "./components/Deliveries";
import ExplainerModal from "./components/Explainer";
import Leaderboard from "./components/Leaderboard";
import Register from "./components/Register";
import StoreTab from "./components/Store";
import StudentView from "./components/StudentView";
import TermFinale from "./components/TermFinale";
import { Coin, HeartIcon, Icon } from "./components/ui";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "register", label: "الكشف", icon: "calendar" },
  { id: "store", label: "المتجر", icon: "store" },
  { id: "deliveries", label: "التسليمات", icon: "gift" },
  { id: "board", label: "المتصدرون", icon: "trophy" },
  { id: "ceremony", label: "الحفل", icon: "sparkle" },
  { id: "term", label: "ختام الترم", icon: "flag" },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="anim-wiggle inline-block">
        <svg viewBox="0 0 24 24" className="h-11 w-11 drop-shadow-[0_3px_0_rgba(86,40,157,0.35)]">
          <rect width="24" height="24" rx="7" fill="#8448e6" />
          <path d="M12 3.5l2.4 5.2 5.6.9-4 4.1.9 5.8-4.9-2.7-4.9 2.7.9-5.8-4-4.1 5.6-.9z" fill="#ffd75e" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block font-display text-xl font-extrabold text-ink sm:text-2xl">نور الحفّاظ</span>
        <span className="hidden text-[10px] font-bold tracking-wide text-grape-500 min-[420px]:block">نحفظ · نلعب · نرتقي</span>
      </span>
    </div>
  );
}

/* مؤشر المزامنة السحابية — يعرض حالة الاتصال ويُحدّث يدويًا عند الضغط */
function CloudChip() {
  const { cloud, syncNow } = useApp();
  if (!cloud.enabled) {
    return (
      <span
        title="الحفظ محلي على هذا الجهاز فقط. لتفعيل المزامنة بين الهواتف ضع رابط API في ملف src/cloudSync.ts"
        className="flex cursor-help items-center gap-1.5 rounded-full border-2 border-grape-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-grape-400"
      >
        <Icon name="cloudOff" className="h-4 w-4" strokeWidth={2.2} />
        <span className="hidden sm:inline">محلي</span>
      </span>
    );
  }
  const t = cloud.lastSyncAt
    ? new Date(cloud.lastSyncAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })
    : null;
  const busy = cloud.status === "syncing";
  return (
    <button
      type="button"
      onClick={syncNow}
      title={
        busy
          ? "جارٍ المزامنة..."
          : cloud.status === "error"
          ? `خطأ: ${cloud.lastError ?? ""} — اضغط لإعادة المحاولة`
          : t
          ? `آخر مزامنة ${t} — اضغط للتحديث الآن`
          : "اضغط للمزامنة الآن"
      }
      className={`flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1.5 text-[11px] font-extrabold transition-all active:scale-95 ${
        cloud.status === "error"
          ? "border-coral-400/60 bg-white text-coral-500 hover:bg-coral-50"
          : busy
          ? "border-grape-300 bg-white text-grape-500"
          : "border-mint-400/60 bg-white text-mint-600 hover:bg-mint-400/10"
      }`}
    >
      <Icon name="cloud" className={`h-4 w-4 ${busy ? "animate-pulse" : ""}`} strokeWidth={2.2} />
      <span className="hidden sm:inline">
        {busy ? "مزامنة..." : cloud.status === "error" ? "خطأ" : t ? `متزامن ${t}` : "سحابي"}
      </span>
    </button>
  );
}

function Nav() {
  const { tab, setTab, mode, setMode, sound, toggleSound } = useApp();
  const [explainOpen, setExplainOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b-2 border-grape-200/70 bg-grape-50/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <Logo />
        {mode === "teacher" && (
          <nav className="order-3 flex w-full items-center gap-1.5 overflow-x-auto pb-1 sm:order-none sm:ms-2 sm:w-auto sm:flex-1 sm:pb-0">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { sfx.click(); setTab(t.id); }}
                className={`flex shrink-0 items-center gap-1.5 rounded-2xl px-3.5 py-2 font-display text-sm font-extrabold transition-all active:scale-95 ${
                  tab === t.id ? "bg-grape-600 text-white shadow-[0_4px_0_#56289d]" : "text-grape-600 hover:bg-white hover:shadow-sm"
                }`}
              >
                <Icon name={t.icon} className="h-4 w-4" strokeWidth={2.4} />
                {t.label}
              </button>
            ))}
          </nav>
        )}
        <div className="ms-auto flex items-center gap-2">
          <CloudChip />
          {mode === "student" && (
            <span className="hidden items-center gap-1.5 rounded-full bg-grape-100 px-3 py-1.5 text-xs font-bold text-grape-600 sm:flex">
              <Icon name="eye" className="h-4 w-4" strokeWidth={2.2} />
              وضع العرض
            </span>
          )}
          <button
            type="button"
            onClick={() => { setExplainOpen(true); sfx.pop(); }}
            className="anim-bounce-soft grid h-10 w-10 place-items-center rounded-full border-2 border-gold-500 bg-gold-400 font-display text-xl font-extrabold text-ink shadow-[0_3px_0_#b57a0a] transition-all hover:brightness-110 active:scale-90"
            aria-label="كيف تعمل المنصة؟"
            title="كيف تعمل المنصة؟ — دليلك السريع"
          >
            !
          </button>
          <button
            type="button"
            onClick={toggleSound}
            className={`grid h-10 w-10 place-items-center rounded-full border-2 transition-all active:scale-90 ${
              sound ? "border-grape-200 bg-white text-grape-600" : "border-coral-400/50 bg-white text-coral-400"
            }`}
            aria-label="الصوت"
            title={sound ? "كتم الصوت" : "تشغيل الصوت"}
          >
            <Icon name={sound ? "sound" : "mute"} className="h-5 w-5" strokeWidth={2.2} />
          </button>
          <div className="flex rounded-full border-2 border-grape-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setMode("teacher")}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 font-display text-sm font-extrabold transition-all sm:px-3 ${
                mode === "teacher" ? "bg-grape-600 text-white shadow" : "text-grape-500 hover:text-grape-700"
              }`}
            >
              <Icon name="wand" className="h-4 w-4" strokeWidth={2.2} />
              <span className="hidden min-[420px]:inline">معلم</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("student")}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 font-display text-sm font-extrabold transition-all sm:px-3 ${
                mode === "student" ? "bg-grape-600 text-white shadow" : "text-grape-500 hover:text-grape-700"
              }`}
            >
              <Icon name="user" className="h-4 w-4" strokeWidth={2.2} />
              <span className="hidden min-[420px]:inline">طالب</span>
            </button>
          </div>
        </div>
      </div>
      {explainOpen && <ExplainerModal onClose={() => setExplainOpen(false)} />}
    </header>
  );
}

const TOAST_STYLE: Record<Toast["kind"], { cls: string; icon: ReactNode }> = {
  xp: { cls: "border-grape-500 bg-grape-700 text-white", icon: <Icon name="bolt" fill className="h-5 w-5 text-grape-300" /> },
  coin: { cls: "border-gold-500 bg-gold-400 text-ink", icon: <Coin className="h-5 w-5" /> },
  level: { cls: "border-gold-400 bg-grape-800 text-gold-300", icon: <Icon name="crown" className="h-5 w-5" strokeWidth={2.4} /> },
  award: { cls: "border-gold-500 bg-gold-500 text-white", icon: <Icon name="trophy" className="h-5 w-5" strokeWidth={2.4} /> },
  error: { cls: "border-coral-400 bg-coral-500 text-white", icon: <Icon name="x" className="h-5 w-5" strokeWidth={3} /> },
  success: { cls: "border-mint-400 bg-mint-600 text-white", icon: <Icon name="check" className="h-5 w-5" strokeWidth={3} /> },
  heart: { cls: "border-coral-400 bg-white text-coral-500", icon: <HeartIcon filled className="h-5 w-5" /> },
};

function Toasts() {
  const { toasts } = useApp();
  return createPortal(
    <div className="pointer-events-none fixed bottom-5 start-5 z-[95] flex w-[min(92vw,340px)] flex-col gap-2">
      {toasts.map((t) => {
        const s = TOAST_STYLE[t.kind];
        return (
          <div key={t.id} className={`anim-slide-up flex items-center gap-2.5 rounded-2xl border-2 px-4 py-3 text-sm font-bold shadow-xl ${s.cls}`}>
            {s.icon}
            <span className="flex-1 leading-5">{t.msg}</span>
          </div>
        );
      })}
    </div>,
    document.body
  );
}

function Shell() {
  const { mode, tab, showCeremony } = useApp();
  return (
    <div className="relative min-h-screen">
      <Background />
      <Nav />
      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-24 pt-7 sm:px-6">
        {mode === "student" ? (
          <StudentView />
        ) : tab === "register" ? (
          <Register />
        ) : tab === "store" ? (
          <StoreTab />
        ) : tab === "deliveries" ? (
          <Deliveries />
        ) : tab === "board" ? (
          <Leaderboard />
        ) : tab === "term" ? (
          <TermFinale />
        ) : (
          <CeremonyPanel />
        )}
      </main>
      <footer className="relative z-10 border-t-2 border-grape-200/60 py-5 text-center">
        <p className="flex items-center justify-center gap-2 px-4 text-xs font-bold text-grape-400">
          <Icon name="sparkle" fill className="h-3.5 w-3.5 shrink-0" />
          نور الحفّاظ — رحلة حفظٍ تشبه اللعب، وقلوبٌ صغيرة تصعد نجمًا كل أسبوع
          <Icon name="sparkle" fill className="h-3.5 w-3.5 shrink-0" />
        </p>
      </footer>
      {showCeremony && <CeremonyShow />}
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
