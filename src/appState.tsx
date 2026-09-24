/* الحالة المركزية للمنصة مع الحفظ في localStorage */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  applyXp,
  ar,
  bagQty,
  BG_MIGRATION,
  championTop,
  DAYS,
  DAY_PARTS,
  DEFAULT_REWARD_SETTINGS,
  DEFAULT_SHOP_ITEMS,
  emptyWeekDays,
  emptyRecitationRatings,
  emptyWeeklyWard,
  equipOn,
  findItem,
  HEART_PRICE,
  levelInfo,
  LEVEL_COIN_REWARD,
  MAX_HEARTS,
  seedStudents,
  uid,
  weekCoinsOf,
  weekXpOf,
  type BgKind,
  type CeremonyPicks,
  type Halaqa,
  type CosmeticSlot,
  type CrownKind,
  type DayKey,
  type DayPart,
  type RecitationRating,
  type DailyWard,
  type Mode,
  type ShopItem,
  type Student,
  type RewardSettings,
  type RewardKey,
  type PerHalaqaRewardKey,
  type Tab,
  type TripDay,
  type WeekDays,
  type WeekLog,
} from "./core";
import { buildTrackSnapshot, measureStudentWork } from "./analytics";
import { sfx, setSoundEnabled } from "./sound";
import {
  cloudLoad,
  cloudSave,
  CLOUD_SKIP_PHOTOS,
  errMsg,
  isCloudEnabled,
  subscribeCloud,
} from "./cloudSync";

export type ToastKind = "xp" | "coin" | "level" | "award" | "error" | "success" | "heart";
export type Toast = { id: number; kind: ToastKind; msg: string };

/* حالة المزامنة السحابية كما تظهر في الشريط العلوي */
export type CloudInfo = {
  enabled: boolean;
  status: "off" | "idle" | "syncing" | "ok" | "error";
  lastSyncAt: number | null;
  lastError: string | null;
};

type State = {
  students: Student[];
  halaqas: Halaqa[];
  week: number;
  weekName: string;
  weeksLog: WeekLog[];
  sound: boolean;
  ceremonyPicks: CeremonyPicks;
  products: ShopItem[];
  showNewProducts: boolean; // إعلان منتجات المتجر الجديدة في الحفل
  /* الرحلة الأسبوعية (اختيارية) */
  tripOn: boolean;
  tripDay: TripDay | null;
  tripAttendees: string[];
  rewardSettings: RewardSettings;
};

type Ctx = State & {
  tab: Tab;
  setTab: (t: Tab) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  toasts: Toast[];
  toast: (kind: ToastKind, msg: string) => void;
  toggleSound: () => void;
  sorted: Student[];
  setWeekName: (name: string) => void;
  setShowNewProducts: (v: boolean) => void;

  addStudent: (name: string, photo: string | null, halaqaId?: string | null) => void;
  updateStudentProfile: (id: string, changes: { name?: string; photo?: string | null; coins?: number; xp?: number; hearts?: number; halaqaId?: string | null }) => void;
  toggleStudentTesting: (id: string) => void;
  removeStudent: (id: string) => void;
  addHalaqa: (name: string) => void;
  renameHalaqa: (id: string, name: string) => void;
  removeHalaqa: (id: string) => void;
  markDay: (id: string, day: DayKey, part: DayPart, rating?: RecitationRating) => void;
  markAbsent: (id: string, day: DayKey) => void;
  updateWard: (id: string, day: DayKey, ward: DailyWard) => void;

  addXp: (id: string, amount: number) => void;
  addCoins: (id: string, amount: number) => void;
  removeHeart: (id: string) => void;
  restoreHeart: (id: string) => void;

  buyHeart: (id: string) => void;
  buyItem: (id: string, itemId: string) => void;
  grantItem: (studentId: string, itemId: string) => void;
  equipCosmetic: (id: string, itemId: string) => void;
  unequipSlot: (id: string, slot: CosmeticSlot) => void;
  deliverItem: (id: string, itemId: string) => void;
  undeliverItem: (id: string, itemId: string) => void;
  saveProduct: (p: ShopItem) => void;
  removeProduct: (id: string) => void;
  restockProduct: (id: string, amount: number) => void;

  grantAward: (id: string, title: string, coins?: number, xp?: number, uniqueKey?: string) => void;
  setCeremonyPick: (key: keyof CeremonyPicks, id: string | null) => void;
  setCeremonyHalaqaPick: (reward: PerHalaqaRewardKey, halaqaId: string, id: string | null) => void;
  setRewardSetting: (key: keyof RewardSettings, value: Partial<RewardSettings[keyof RewardSettings]>) => void;
  removeWeekLog: (week: number) => void;
  updateWeekLog: (week: number, next: WeekLog) => void;
  /* الرحلة الأسبوعية */
  setTrip: (on: boolean, day?: TripDay | null) => void;
  toggleTripAttendee: (id: string) => void;
  startWeek: () => void;
  showCeremony: boolean;
  startCeremony: () => void;
  closeCeremony: () => void;

  /* المزامنة السحابية */
  cloud: CloudInfo;
  syncNow: () => void;
};

const KEY = "noor-huffaz-v3";

/** تطبيع بيانات الطالب (يدعم الأشكال القديمة المحفوظة) */
function normStudent(s: Student): Student {
  const out = emptyWeekDays();
  const src = (s.days ?? {}) as Record<string, unknown>;
  for (const d of DAYS) {
    const v = src[d.key];
    if (typeof v === "boolean") out[d.key] = { a: v, h: v, r: false };
    else if (v && typeof v === "object") {
      const e = v as Record<string, unknown>;
      out[d.key] = { a: !!e.a, h: !!e.h, r: !!e.r, absent: e.absent === true };
    }
  }
  return {
    ...s,
    days: out,
    recitationRatings: (() => {
      const ratings = emptyRecitationRatings();
      const source = s.recitationRatings;
      if (!source) return ratings;
      for (const d of DAYS) {
        for (const part of ["h", "r"] as const) {
          const rating = source[d.key]?.[part];
          if (rating === "excellent" || rating === "very-good") ratings[d.key][part] = rating;
        }
      }
      return ratings;
    })(),
    ward: (() => {
      const normalized = emptyWeeklyWard();
      const source = s.ward;
      if (!source) return normalized;
      for (const d of DAYS) {
        const item = source[d.key];
        if (item) normalized[d.key] = {
          memorization: String(item.memorization ?? ""),
          review: String(item.review ?? ""),
          memorizationVerses: Math.max(0, Number(item.memorizationVerses ?? 0) || 0),
          reviewVerses: Math.max(0, Number(item.reviewVerses ?? 0) || 0),
          memorizationLines: Math.max(0, Number(item.memorizationLines ?? 0) || 0),
          reviewLines: Math.max(0, Number(item.reviewLines ?? 0) || 0),
        };
      }
      return normalized;
    })(),
    weekXp: weekXpOf(out),
    weekCoins: weekCoinsOf(out),
    hearts: typeof s.hearts === "number" ? Math.max(0, Math.min(MAX_HEARTS, s.hearts)) : MAX_HEARTS,
    heartsLostWeek: s.heartsLostWeek ?? 0,
    inventory: Array.isArray(s.inventory) ? s.inventory : [],
    bag: Array.isArray(s.bag)
      ? (s.bag as unknown as { itemId: string; qty?: number; receivedQty?: number; received?: boolean }[]).map((b) => ({
          itemId: b.itemId,
          qty: b.qty ?? 1,
          receivedQty:
            typeof b.receivedQty === "number" ? Math.min(b.receivedQty, b.qty ?? 1) : b.received ? (b.qty ?? 1) : 0,
        }))
      : [],
    frame: s.frame ?? null,
    crown: (s.crown === "silver" ? "silver" : s.crown ? "gold" : null) as CrownKind | null,
    glow: s.glow ?? null,
    cardBg: s.cardBg ? ((BG_MIGRATION[s.cardBg] ?? s.cardBg) as BgKind) : null,
    awards: Array.isArray(s.awards) ? s.awards : [],
    halaqaId: typeof s.halaqaId === "string" ? s.halaqaId : null,
    isTesting: s.isTesting === true,
    createdAt: typeof s.createdAt === "number" ? s.createdAt : undefined,
    memorizationRecords: Array.isArray(s.memorizationRecords) ? s.memorizationRecords : [],
  };
}

/** تطبيع حزمة البيانات المحفوظة — تُستخدم للحفظ المحلي وللقادم من السحابة معًا */
function stateFromPartial(p: Partial<State> | null | undefined): State {
  if (!p || typeof p !== "object") p = {};
  const students = Array.isArray(p.students) ? (p.students as Student[]).map(normStudent) : seedStudents();
  return {
    students,
    halaqas: Array.isArray(p.halaqas)
      ? (p.halaqas as Halaqa[]).filter((h) => h && typeof h.id === "string" && typeof h.name === "string")
      : [],
    week: typeof p.week === "number" ? p.week : 1,
    weekName: typeof p.weekName === "string" ? p.weekName : "",
    weeksLog: Array.isArray(p.weeksLog) ? (p.weeksLog as WeekLog[]) : [],
    sound: p.sound !== false,
    ceremonyPicks: p.ceremonyPicks ?? {},
    tripOn: !!p.tripOn,
    tripDay: (p.tripDay as TripDay | null) ?? null,
    tripAttendees: Array.isArray(p.tripAttendees) ? (p.tripAttendees as string[]) : [],
    rewardSettings: {
      champions: { ...DEFAULT_REWARD_SETTINGS.champions, ...(p.rewardSettings?.champions ?? {}) },
      improved: { ...DEFAULT_REWARD_SETTINGS.improved, ...(p.rewardSettings?.improved ?? {}) },
      behavior: { ...DEFAULT_REWARD_SETTINGS.behavior, ...(p.rewardSettings?.behavior ?? {}) },
      trip: { ...DEFAULT_REWARD_SETTINGS.trip, ...(p.rewardSettings?.trip ?? {}) },
    },
    showNewProducts: p.showNewProducts !== false,
    products:
      Array.isArray(p.products) && p.products.length
        ? (p.products as ShopItem[]).map((it) => {
            // ترحيل قيم خلفيات البطاقة القديمة إلى الألوان الجديدة
            const withBg =
              it.slot === "cardbg" && it.value && BG_MIGRATION[it.value]
                ? { ...it, value: BG_MIGRATION[it.value] }
                : it;
            if (withBg.kind) return withBg.kind === "external" ? { ...withBg, repeatable: true } : withBg;
            // نموذج قديم: حوّل حقل cosmetic إلى kind/slot/value
            const legacy = withBg as ShopItem & { cosmetic?: string | null };
            if (legacy.cosmetic === "crown") return { ...withBg, kind: "cosmetic", slot: "crown", value: "gold" };
            if (legacy.cosmetic) return { ...withBg, kind: "cosmetic", slot: "frame", value: legacy.cosmetic };
            return { ...withBg, kind: "external", repeatable: true };
          })
        : DEFAULT_SHOP_ITEMS,
  };
}

function loadPersist(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return stateFromPartial(JSON.parse(raw) as Partial<State>);
  } catch {
    /* تجاهل */
  }
  return stateFromPartial(null);
}

/** رقم النسخة المحفوظ محليًا (يُستخدم للمزامنة) */
function readStoredRev(): number {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as { __rev?: number };
      if (typeof p.__rev === "number") return p.__rev;
    }
  } catch {
    /* تجاهل */
  }
  return 0;
}

const AppCtx = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp خارج المزوّد");
  return c;
}

let toastSeq = 1;

export function AppProvider({ children }: { children: ReactNode }) {
  const [init] = useState(loadPersist);
  const [students, setStudents] = useState<Student[]>(init.students);
  const [halaqas, setHalaqas] = useState<Halaqa[]>(init.halaqas);
  const [week, setWeek] = useState(init.week);
  const [weekName, setWeekNameState] = useState(init.weekName);
  const [weeksLog, setWeeksLog] = useState<WeekLog[]>(init.weeksLog);
  const [sound, setSound] = useState(init.sound);
  const [ceremonyPicks, setCeremonyPicks] = useState<CeremonyPicks>(init.ceremonyPicks);
  const [products, setProducts] = useState<ShopItem[]>(init.products);
  const [showNewProducts, setShowNewProducts] = useState(init.showNewProducts);
  const [tripOn, setTripOn] = useState(init.tripOn);
  const [tripDay, setTripDay] = useState<TripDay | null>(init.tripDay);
  const [tripAttendees, setTripAttendees] = useState<string[]>(init.tripAttendees);
  const [rewardSettings, setRewardSettings] = useState<RewardSettings>(init.rewardSettings);
  const [tab, setTab] = useState<Tab>("register");
  const [mode, setMode] = useState<Mode>("teacher");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showCeremony, setShowCeremony] = useState(false);
  const timers = useRef<number[]>([]);

  const toast = useCallback((kind: ToastKind, msg: string) => {
    const id = toastSeq++;
    setToasts((ts) => [...ts.slice(-3), { id, kind, msg }]);
    const t = window.setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 3200);
    timers.current.push(t);
  }, []);

  /* ===== المزامنة السحابية ===== */
  const cloudEnabled = isCloudEnabled();
  const [cloud, setCloud] = useState<CloudInfo>({
    enabled: cloudEnabled,
    status: cloudEnabled ? "idle" : "off",
    lastSyncAt: null,
    lastError: null,
  });
  const revRef = useRef(0); // رقم نسخة البيانات المحلية
  const lastPushedRev = useRef(0); // آخر نسخة رُفعت للسحابة
  const cloudDataRef = useRef<State | null>(null); // مرآة البيانات لأغراض الرفع
  const pushTimer = useRef<number | null>(null);
  const firstSave = useRef(true);
  // رقم النسخة البعيدة الجاري تطبيقها. يمنع مؤثر الحفظ من إعادة رفعها كسجل محلي جديد.
  const applyingRemoteRev = useRef<number | null>(null);

  /** رفع نسخة إلى السحابة */
  const pushCloud = useCallback(async (rev: number, force = false) => {
    if (!isCloudEnabled()) return;
    const data = cloudDataRef.current;
    if (!data) return;
    if (!force && rev <= lastPushedRev.current) return;
    setCloud((c) => ({ ...c, status: "syncing" }));
    try {
      const saved = await cloudSave({ rev, data });
      lastPushedRev.current = Math.max(lastPushedRev.current, saved.rev);
      // عند أول نقل للصور إلى Storage نستبدل dataURL بروابط خفيفة محليًا أيضًا.
      if (saved.data !== data || saved.rev !== rev) {
        const normalized = stateFromPartial(saved.data as Partial<State>);
        applyingRemoteRev.current = saved.rev;
        revRef.current = saved.rev;
        cloudDataRef.current = normalized;
        setStudents(normalized.students);
        if (saved.rev !== rev) {
          setHalaqas(normalized.halaqas);
          setWeek(normalized.week);
          setWeekNameState(normalized.weekName);
          setWeeksLog(normalized.weeksLog);
          setSound(normalized.sound);
          setCeremonyPicks(normalized.ceremonyPicks);
          setProducts(normalized.products);
          setShowNewProducts(normalized.showNewProducts);
          setTripOn(normalized.tripOn);
          setTripDay(normalized.tripDay);
          setTripAttendees(normalized.tripAttendees);
          setRewardSettings(normalized.rewardSettings);
        }
      }
      setCloud((c) => ({ ...c, status: "ok", lastSyncAt: Date.now(), lastError: null }));
    } catch (e) {
      setCloud((c) => ({ ...c, status: "error", lastError: errMsg(e) }));
    }
  }, []);

  /** تطبيق حزمة قادمة من السحابة على الحالة */
  const applyRemote = useCallback((remote: State, remoteRev: number) => {
    // ألغِ أي رفع مؤجل لنسخة محلية أقدم قبل تطبيق النسخة القادمة.
    if (pushTimer.current) {
      window.clearTimeout(pushTimer.current);
      pushTimer.current = null;
    }
    applyingRemoteRev.current = remoteRev;
    // عند تخطي الصور سحابيًا: نحتفظ بصور هذا الجهاز بدل استبدالها بفراغ
    if (CLOUD_SKIP_PHOTOS) {
      const localStudents = cloudDataRef.current?.students ?? [];
      remote = {
        ...remote,
        students: remote.students.map((rs) => {
          const local = localStudents.find((ls) => ls.id === rs.id);
          return local?.photo ? { ...rs, photo: local.photo } : rs;
        }),
      };
    }
    setStudents(remote.students);
    setHalaqas(remote.halaqas);
    setWeek(remote.week);
    setWeekNameState(remote.weekName);
    setWeeksLog(remote.weeksLog);
    setSound(remote.sound);
    setCeremonyPicks(remote.ceremonyPicks);
    setProducts(remote.products);
    setShowNewProducts(remote.showNewProducts);
    setTripOn(remote.tripOn);
    setTripDay(remote.tripDay);
    setTripAttendees(remote.tripAttendees);
    setRewardSettings(remote.rewardSettings);
  }, []);

  /** سحب أحدث نسخة من السحابة وتطبيقها إن كانت أحدث من المحلية */
  const pullCloud = useCallback(
    async (announce: boolean) => {
      if (!isCloudEnabled()) return;
      setCloud((c) => (c.status === "error" ? c : { ...c, status: "syncing" }));
      try {
        const remote = await cloudLoad();
        if (remote && remote.rev > revRef.current) {
          const norm = stateFromPartial(remote.data as Partial<State>);
          revRef.current = remote.rev;
          lastPushedRev.current = remote.rev;
          applyRemote(norm, remote.rev);
          if (announce) toast("success", "تم جلب تحديثات جديدة من السحابة");
        } else if (!remote && revRef.current > 0) {
          // السحابة فارغة ولدينا بيانات حقيقية — ننشر نسختنا
          await pushCloud(revRef.current, true);
          return; // pushCloud حدّث الحالة بالفعل
        }
        setCloud((c) => ({ ...c, status: "ok", lastSyncAt: Date.now(), lastError: null }));
      } catch (e) {
        setCloud((c) => ({ ...c, status: "error", lastError: errMsg(e) }));
      }
    },
    [applyRemote, pushCloud, toast]
  );

  // حفظ محلي + رفع سحابي عند كل تغيير
  useEffect(() => {
    const persistData: State = {
      students,
      halaqas,
      week,
      weekName,
      weeksLog,
      sound,
      ceremonyPicks,
      products,
      showNewProducts,
      tripOn,
      tripDay,
      tripAttendees,
      rewardSettings,
    };

    // النسخة السحابية: تُحذف الصور إن طُلب ذلك للتقليل من الحجم
    cloudDataRef.current = CLOUD_SKIP_PHOTOS
      ? { ...persistData, students: persistData.students.map((s) => ({ ...s, photo: null })) }
      : persistData;

    // تحديث قادم من Supabase: احفظه في localStorage فقط ولا تعِد رفعه.
    if (applyingRemoteRev.current !== null) {
      const remoteRev = applyingRemoteRev.current;
      applyingRemoteRev.current = null;
      revRef.current = remoteRev;
      lastPushedRev.current = Math.max(lastPushedRev.current, remoteRev);
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...persistData, __rev: remoteRev }));
      } catch {
        /* تجاهل */
      }
      return;
    }

    if (firstSave.current) {
      // أول تشغيل: نحفظ محليًا فقط ونقرأ رقم النسخة المخزون
      firstSave.current = false;
      revRef.current = readStoredRev();
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...persistData, __rev: revRef.current }));
      } catch {
        /* تجاهل */
      }
      return;
    }

    // تعديل حقيقي: نرفع رقم النسخة ونحفظ ونجدول رفعًا سحابيًا
    const newRev = Math.max(Date.now(), revRef.current + 1);
    revRef.current = newRev;
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...persistData, __rev: newRev }));
    } catch {
      /* تجاهل */
    }
    if (isCloudEnabled()) {
      if (pushTimer.current) window.clearTimeout(pushTimer.current);
      pushTimer.current = window.setTimeout(() => void pushCloud(newRev), 1500);
    }
  }, [students, halaqas, week, weekName, weeksLog, sound, ceremonyPicks, products, showNewProducts, tripOn, tripDay, tripAttendees, rewardSettings, pushCloud]);

  // سحب أولي مرة واحدة، ثم استقبال التحديثات لحظيًا عبر Supabase Realtime.
  useEffect(() => {
    if (!cloudEnabled) return;
    void pullCloud(false);
    return subscribeCloud((remote) => {
      if (remote.rev <= revRef.current) return;
      const normalized = stateFromPartial(remote.data as Partial<State>);
      revRef.current = remote.rev;
      lastPushedRev.current = remote.rev;
      cloudDataRef.current = normalized;
      applyRemote(normalized, remote.rev);
      setCloud((c) => ({ ...c, status: "ok", lastSyncAt: Date.now(), lastError: null }));
    });
  }, [applyRemote, cloudEnabled, pullCloud]);

  /** مزامنة فورية يدوية (سحب ثم رفع) */
  const syncNow = useCallback(() => {
    if (!cloudEnabled) return;
    void pullCloud(true).then(() => void pushCloud(revRef.current, revRef.current > lastPushedRev.current));
  }, [cloudEnabled, pullCloud, pushCloud]);

  useEffect(() => {
    setSoundEnabled(sound);
  }, [sound]);

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  const update = useCallback((id: string, fn: (s: Student) => Student) => {
    setStudents((ss) => ss.map((s) => (s.id === id ? fn(s) : s)));
  }, []);

  const sorted = useMemo(
    () =>
      [...students].sort(
        (a, b) =>
          levelInfo(b.xp).level - levelInfo(a.xp).level ||
          b.xp - a.xp ||
          a.name.localeCompare(b.name, "ar")
      ),
    [students]
  );

  /* ===== الطلاب ===== */
  const addStudent = useCallback(
    (name: string, photo: string | null, halaqaId: string | null = null) => {
      setStudents((ss) => [
        ...ss,
        {
          id: uid(),
          name,
          photo,
          halaqaId,
          hearts: MAX_HEARTS,
          heartsLostWeek: 0,
          xp: 0,
          weekXp: 0,
          weekCoins: 0,
          coins: 10, // هدية ترحيب
          isTesting: false,
          createdAt: Date.now(),
          days: emptyWeekDays(),
          ward: emptyWeeklyWard(),
          inventory: [],
          bag: [],
          frame: null,
          crown: null,
          glow: null,
          cardBg: null,
          awards: [],
          memorizationRecords: [],
        },
      ]);
      sfx.sparkle();
      toast("success", `انضم ${name} إلى كشف الحلقة`);
    },
    [toast]
  );

  const updateStudentProfile = useCallback((id: string, changes: { name?: string; photo?: string | null; coins?: number; xp?: number; hearts?: number; halaqaId?: string | null }) => {
    setStudents((ss) => ss.map((s) => s.id === id ? {
      ...s,
      ...(changes.name !== undefined ? { name: changes.name.trim() || s.name } : {}),
      ...(changes.photo !== undefined ? { photo: changes.photo } : {}),
      ...(changes.coins !== undefined ? { coins: Math.max(0, Math.floor(changes.coins)) } : {}),
      ...(changes.xp !== undefined ? { xp: Math.max(0, Math.floor(changes.xp)) } : {}),
      ...(changes.hearts !== undefined ? { hearts: Math.max(0, Math.min(MAX_HEARTS, Math.floor(changes.hearts))) } : {}),
      ...(changes.halaqaId !== undefined ? { halaqaId: changes.halaqaId } : {}),
    } : s));
    toast("success", "تم حفظ بيانات الطالب دون تغيير سجلاته");
  }, [toast]);

  const toggleStudentTesting = useCallback((id: string) => {
    const current = students.find((student) => student.id === id);
    setStudents((items) => items.map((student) => student.id === id ? { ...student, isTesting: !student.isTesting } : student));
    if (current) toast("success", `${current.name}: ${current.isTesting ? "انتهت فترة الاختبار" : "بدأت فترة الاختبار"}`);
  }, [students, toast]);

  const addHalaqa = useCallback((name: string) => {
    const clean = name.trim();
    if (!clean) return;
    setHalaqas((hs) => hs.some((h) => h.name === clean) ? hs : [...hs, { id: uid(), name: clean, createdAt: Date.now() }]);
    toast("success", `تمت إضافة ${clean}`);
  }, [toast]);

  const renameHalaqa = useCallback((id: string, name: string) => {
    const clean = name.trim();
    if (!clean) return;
    setHalaqas((hs) => hs.map((h) => h.id === id ? { ...h, name: clean } : h));
  }, []);

  const removeHalaqa = useCallback((id: string) => {
    setHalaqas((hs) => hs.filter((h) => h.id !== id));
    setStudents((ss) => ss.map((s) => s.halaqaId === id ? { ...s, halaqaId: null } : s));
    toast("success", "حُذفت الحلقة وأصبح طلابها بلا حلقة، دون حذف أي طالب أو سجل");
  }, [toast]);

  const removeStudent = useCallback(
    (id: string) => {
      const st = students.find((s) => s.id === id);
      setStudents((ss) => ss.filter((s) => s.id !== id));
      setTripAttendees((a) => a.filter((x) => x !== id));
      toast("error", `تم حذف ${st?.name ?? "الطالب"} من الكشف`);
    },
    [students, toast]
  );

  /* ===== الكشف: حضور / حفظ / مراجعة ===== */
  const markDay = useCallback(
    (id: string, day: DayKey, part: DayPart, rating?: RecitationRating) => {
      const st = students.find((s) => s.id === id);
      if (!st) return;
      if (st.days[day].absent) {
        toast("error", `${st.name}: ألغِ حالة الغياب أولًا قبل تسجيل الحضور أو التسميع`);
        return;
      }
      if ((part === "h" || part === "r") && st.days[day][part] && rating) {
        setStudents((ss) => ss.map((s) => s.id === id ? {
          ...s,
          recitationRatings: {
            ...(s.recitationRatings ?? emptyRecitationRatings()),
            [day]: { ...(s.recitationRatings?.[day] ?? {}), [part]: rating },
          },
        } : s));
        return;
      }
      const def = DAY_PARTS.find((p) => p.key === part)!;
      const turningOn = !st.days[day][part];
      // العملات تُجمع دائمًا — أما نقاط المستوى فتتوقف عند نفاد القلوب
      const noHearts = st.hearts <= 0;
      const xpDelta = turningOn && !noHearts ? def.xp : turningOn ? 0 : -Math.min(def.xp, st.xp);
      const coinDelta = turningOn ? def.coins : -def.coins;

      let leveledName = "";
      let leveledTo = 0;
      setStudents((ss) =>
        ss.map((s) => {
          if (s.id !== id) return s;
          const days: WeekDays = { ...s.days, [day]: { ...s.days[day], [part]: turningOn } };
          const recitationRatings = part === "h" || part === "r" ? {
            ...(s.recitationRatings ?? emptyRecitationRatings()),
            [day]: {
              ...(s.recitationRatings?.[day] ?? {}),
              [part]: turningOn ? (rating ?? s.recitationRatings?.[day]?.[part] ?? "excellent") : undefined,
            },
          } : s.recitationRatings;
          const { student, leveled } = applyXp(s, xpDelta);
          if (leveled) {
            leveledName = student.name;
            leveledTo = leveled;
          }
          const dayLabel = DAYS.find((d) => d.key === day)?.label ?? "";
          const ward = s.ward[day];
          const lastHeard = turningOn && (part === "h" || part === "r")
            ? {
                ...(s.lastHeard ?? {}),
                ...(part === "h" && ward.memorization ? { memorization: { text: ward.memorization, verses: ward.memorizationVerses, lines: ward.memorizationLines, day: dayLabel, at: Date.now() } } : {}),
                ...(part === "r" && ward.review ? { review: { text: ward.review, verses: ward.reviewVerses, lines: ward.reviewLines, day: dayLabel, at: Date.now() } } : {}),
              }
            : s.lastHeard;
          return { ...student, days, recitationRatings, lastHeard, weekXp: weekXpOf(days), weekCoins: weekCoinsOf(days), coins: Math.max(0, student.coins + coinDelta + (leveled ? LEVEL_COIN_REWARD : 0)) };
        })
      );

      if (turningOn) {
        sfx.pop();
        if (noHearts) toast("coin", `${st.name}: +${def.coins} عملات (مستواه متوقف حتى يشتري قلبًا)`);
        else toast("xp", `${st.name}: +${def.xp} نقاط ${def.label === "حضور" ? "حضور" : "تسميع " + def.label}`);
        if (turningOn && leveledName) {
          const t = window.setTimeout(() => {
            sfx.levelUp();
            toast("level", `ارتقى ${leveledName} إلى المستوى ${leveledTo} — مكافأة ${ar(LEVEL_COIN_REWARD)} عملة`);
          }, 350);
          timers.current.push(t);
        }
      } else {
        sfx.click();
      }
    },
    [students, toast]
  );

  /** الغياب حالة وصفية مستقلة ولا يضيف أو يخصم نقاطًا أو عملات. */
  const markAbsent = useCallback((id: string, day: DayKey) => {
    const st = students.find((s) => s.id === id);
    if (!st) return;
    const entry = st.days[day];
    const turningOn = !entry.absent;
    if (turningOn && (entry.a || entry.h || entry.r)) {
      toast("error", `${st.name}: توجد بيانات مسجلة لهذا اليوم؛ ألغِها يدويًا قبل تحديده كغائب حتى لا نفقد أي سجل`);
      return;
    }
    setStudents((ss) => ss.map((s) => s.id === id
      ? { ...s, days: { ...s.days, [day]: { ...s.days[day], absent: turningOn } } }
      : s));
    toast(turningOn ? "success" : "xp", turningOn ? `سُجّل ${st.name} غائبًا دون تقييم الحفظ والمراجعة` : `أُلغيت حالة الغياب عن ${st.name}`);
  }, [students, toast]);

  const updateWard = useCallback((id: string, day: DayKey, ward: DailyWard) => {
    setStudents((ss) => ss.map((s) => s.id === id
      ? { ...s, ward: { ...s.ward, [day]: {
          ...ward,
          memorizationVerses: Math.max(0, Number(ward.memorizationVerses) || 0),
          reviewVerses: Math.max(0, Number(ward.reviewVerses) || 0),
          memorizationLines: Math.max(0, Number(ward.memorizationLines) || 0),
          reviewLines: Math.max(0, Number(ward.reviewLines) || 0),
        } } }
      : s));
  }, []);

  /* ===== الخبرة والعملات اليدوية ===== */
  const addXp = useCallback(
    (id: string, amount: number) => {
      let leveledName = "";
      let leveledTo = 0;
      setStudents((ss) =>
        ss.map((s) => {
          if (s.id !== id) return s;
          const { student, leveled } = applyXp(s, amount);
          if (leveled) {
            leveledName = student.name;
            leveledTo = leveled;
            return { ...student, coins: student.coins + LEVEL_COIN_REWARD };
          }
          return student;
        })
      );
      if (amount > 0) {
        sfx.pop();
        toast("xp", `+${ar(amount)} نقطة خبرة`);
      }
      if (leveledName) {
        const t = window.setTimeout(() => {
          sfx.levelUp();
          toast("level", `ارتقى ${leveledName} إلى المستوى ${leveledTo} — مكافأة ${ar(LEVEL_COIN_REWARD)} عملة`);
        }, 350);
        timers.current.push(t);
      }
    },
    [toast]
  );

  const addCoins = useCallback(
    (id: string, amount: number) => {
      update(id, (s) => ({ ...s, coins: Math.max(0, s.coins + amount) }));
      if (amount > 0) {
        sfx.coin();
        toast("coin", `+${ar(amount)} عملة ذهبية`);
      }
    },
    [toast, update]
  );

  /* ===== القلوب ===== */
  const removeHeart = useCallback(
    (id: string) => {
      const st = students.find((s) => s.id === id);
      if (!st || st.hearts <= 0) return;
      const left = st.hearts - 1;
      update(id, (s) => ({ ...s, hearts: left, heartsLostWeek: s.heartsLostWeek + 1 }));
      sfx.error();
      if (left === 0)
        toast("heart", `فقد ${st.name} كل قلوبه — يستمر بجمع العملات فقط حتى يشتري قلبًا من متجره`);
      else toast("heart", `خسر ${st.name} قلبًا (${left} متبقية) — انتبه لآداب الحلقة`);
    },
    [students, toast, update]
  );

  /** زيادة قلوب يدويًا من المعلم (صلاحية المعلم فقط) */
  const restoreHeart = useCallback(
    (id: string) => {
      const st = students.find((s) => s.id === id);
      if (!st || st.hearts >= MAX_HEARTS) return;
      update(id, (s) => ({ ...s, hearts: Math.min(MAX_HEARTS, s.hearts + 1) }));
      sfx.sparkle();
      toast("heart", `منح المعلم ${st.name} قلبًا جديدًا`);
    },
    [students, toast, update]
  );

  /* ===== الشراء ===== */
  const buyHeart = useCallback(
    (id: string) => {
      const st = students.find((s) => s.id === id);
      if (!st) return;
      if (st.hearts >= MAX_HEARTS) {
        toast("error", "قلوبك مكتملة بالفعل");
        sfx.error();
        return;
      }
      if (st.coins < HEART_PRICE) {
        toast("error", `عملاتك لا تكفي — تحتاج ${ar(HEART_PRICE)}`);
        sfx.error();
        return;
      }
      setStudents((ss) =>
        ss.map((s) => (s.id === id ? { ...s, coins: s.coins - HEART_PRICE, hearts: Math.min(MAX_HEARTS, s.hearts + 1) } : s))
      );
      sfx.coin();
      const t = window.setTimeout(() => sfx.sparkle(), 180);
      timers.current.push(t);
      toast("heart", `اشترى ${st.name} قلبًا جديدًا وعاد لنقاط المستوى`);
    },
    [students, toast]
  );

  const buyItem = useCallback(
    (id: string, itemId: string) => {
      const item = findItem(products, itemId);
      const st = students.find((s) => s.id === id);
      if (!item || !st) return;
      // من فقد كل قلوبه لا يشتري أي منتج — عليه شراء قلب أولًا
      if (st.hearts <= 0) {
        toast("heart", `قلوب ${st.name} نفدت — عليه شراء قلب جديد أولًا ليعود للشراء`);
        sfx.error();
        return;
      }
      const lvl = levelInfo(st.xp).level;
      const isCosmetic = item.kind === "cosmetic";
      const ownedQty = isCosmetic ? (st.inventory.includes(itemId) ? 1 : 0) : bagQty(st, itemId);
      if (isCosmetic && ownedQty > 0) {
        toast("error", "تملك هذه الخاصية بالفعل");
        sfx.error();
        return;
      }
      if (!isCosmetic && !item.repeatable && ownedQty > 0) {
        toast("error", "اشتريت هذه الجائزة بالفعل");
        sfx.error();
        return;
      }
      // نفاد الكمية لدى المعلم يمنع الشراء (للنوعين)
      if (typeof item.stock === "number" && item.stock <= 0) {
        toast("error", `نفدت كمية «${item.name}» — بانتظار أن يزيدها المعلم`);
        sfx.error();
        return;
      }
      if (lvl < item.minLevel) {
        toast("error", `يُفتح في المستوى ${ar(item.minLevel)}`);
        sfx.error();
        return;
      }
      if (st.coins < item.price) {
        toast("error", `عملاتك لا تكفي — تحتاج ${ar(item.price)}`);
        sfx.error();
        return;
      }
      // خصم وحدة من الكمية المتوفرة عند الشراء (للنوعين)
      if (typeof item.stock === "number") {
        setProducts((ps) =>
          ps.map((x) => (x.id === itemId && typeof x.stock === "number" ? { ...x, stock: Math.max(0, x.stock - 1) } : x))
        );
      }
      setStudents((ss) =>
        ss.map((s) => {
          if (s.id !== id) return s;
          const next: Student = { ...s, coins: s.coins - item.price };
          if (isCosmetic) {
            next.inventory = [...s.inventory, itemId];
            return equipOn(next, item); // تُلبس الخاصية فور شرائها
          }
          // خارجية: تُضاف إلى الحقيبة (تُنتظر التسليم من المعلم)
          const bag = [...(s.bag ?? [])];
          const idx = bag.findIndex((b) => b.itemId === itemId);
          if (idx >= 0) bag[idx] = { ...bag[idx], qty: bag[idx].qty + 1 };
          else bag.push({ itemId, qty: 1, receivedQty: 0 });
          next.bag = bag;
          return next;
        })
      );
      sfx.coin();
      const t = window.setTimeout(() => sfx.sparkle(), 200);
      timers.current.push(t);
      toast(
        "success",
        isCosmetic ? `لبس ${st.name} «${item.name}» — عدّله من الحقيبة` : `أضاف ${st.name} «${item.name}» إلى حقيبته`
      );
    },
    [products, students, toast]
  );

  /* ===== خصائص البروفايل والحقيبة ===== */
  /** لبس خاصية بروفايل مملوكة */
  const equipCosmetic = useCallback(
    (id: string, itemId: string) => {
      const item = findItem(products, itemId);
      const st = students.find((s) => s.id === id);
      if (!item || !st || item.kind !== "cosmetic" || !st.inventory.includes(itemId)) return;
      update(id, (s) => equipOn(s, item));
      sfx.pop();
      toast("success", `لبس ${st.name} «${item.name}»`);
    },
    [products, students, toast, update]
  );

  /** خلع خاصية من خانة معيّنة (إرجاعها للشكل الأساسي) */
  const unequipSlot = useCallback(
    (id: string, slot: CosmeticSlot) => {
      const st = students.find((s) => s.id === id);
      if (!st) return;
      update(id, (s) => {
        if (slot === "frame") return { ...s, frame: null };
        if (slot === "crown") return { ...s, crown: null };
        if (slot === "glow") return { ...s, glow: null };
        return { ...s, cardBg: null };
      });
      sfx.click();
      toast("success", `أعاد ${st.name} البروفايل للشكل الأساسي في هذه الخانة`);
    },
    [students, toast, update]
  );

  /** تسليم وحدة واحدة من جائزة خارجية (المعلم) */
  const deliverItem = useCallback(
    (id: string, itemId: string) => {
      const st = students.find((s) => s.id === id);
      if (!st) return;
      const entry = (st.bag ?? []).find((b) => b.itemId === itemId);
      if (!entry || entry.receivedQty >= entry.qty) return;
      const nowReceived = entry.receivedQty + 1;
      update(id, (s) => ({
        ...s,
        bag: (s.bag ?? []).map((b) => (b.itemId === itemId ? { ...b, receivedQty: nowReceived } : b)),
      }));
      if (nowReceived >= entry.qty) {
        sfx.sparkle();
        toast("success", `استلم ${st.name} «${findItem(products, itemId)?.name ?? "الجائزة"}» بالكامل`);
      } else {
        sfx.pop();
      }
    },
    [products, students, toast, update]
  );

  /** التراجع عن تسليم وحدة واحدة (في حال الخطأ) */
  const undeliverItem = useCallback(
    (id: string, itemId: string) => {
      const st = students.find((s) => s.id === id);
      if (!st) return;
      update(id, (s) => ({
        ...s,
        bag: (s.bag ?? []).map((b) =>
          b.itemId === itemId && b.receivedQty > 0 ? { ...b, receivedQty: b.receivedQty - 1 } : b
        ),
      }));
      sfx.click();
    },
    [students, update]
  );

  /** منح منتج من المتجر لطالب مجانًا (صلاحية المعلم) — يخصم من الكمية أيضًا */
  const grantItem = useCallback(
    (studentId: string, itemId: string) => {
      const item = findItem(products, itemId);
      const st = students.find((s) => s.id === studentId);
      if (!item || !st) return;
      if (typeof item.stock === "number" && item.stock <= 0) {
        toast("error", `نفدت كمية «${item.name}» — زد الكمية أولًا`);
        sfx.error();
        return;
      }
      if (typeof item.stock === "number") {
        setProducts((ps) =>
          ps.map((x) => (x.id === itemId && typeof x.stock === "number" ? { ...x, stock: Math.max(0, x.stock - 1) } : x))
        );
      }
      setStudents((ss) =>
        ss.map((s) => {
          if (s.id !== studentId) return s;
          if (item.kind === "cosmetic") {
            if (s.inventory.includes(itemId)) return s;
            return equipOn({ ...s, inventory: [...s.inventory, itemId] }, item);
          }
          const bag = [...(s.bag ?? [])];
          const idx = bag.findIndex((b) => b.itemId === itemId);
          if (idx >= 0) bag[idx] = { ...bag[idx], qty: bag[idx].qty + 1 };
          else bag.push({ itemId, qty: 1, receivedQty: 0 });
          return { ...s, bag };
        })
      );
      sfx.sparkle();
      toast(
        "success",
        item.kind === "cosmetic"
          ? `منح المعلم ${st.name} «${item.name}» ولبسها فورًا`
          : `منح المعلم ${st.name} «${item.name}» — أُضيفت إلى حقيبته`
      );
    },
    [products, students, toast]
  );

  /* ===== منتجات المتجر ===== */
  const saveProduct = useCallback(
    (p: ShopItem) => {
      setProducts((ps) => {
        const exists = ps.some((x) => x.id === p.id);
        if (exists) return ps.map((x) => (x.id === p.id ? p : x));
        // منتج جديد: سجّل الأسبوع الذي أُضيف فيه (ليظهر في حفل هذا الأسبوع)
        return [...ps, { ...p, addedWeek: p.addedWeek ?? week }];
      });
      sfx.pop();
    },
    [week]
  );

  const removeProduct = useCallback(
    (id: string) => {
      setProducts((ps) => ps.filter((p) => p.id !== id));
      toast("error", "تم حذف المنتج من المتجر");
    },
    [toast]
  );

  /** زيادة كمية منتج (المعلم) — amount>0 زيادة، amount<0 إنقاص */
  const restockProduct = useCallback((id: string, amount: number) => {
    setProducts((ps) =>
      ps.map((p) =>
        p.id === id ? { ...p, stock: Math.max(0, (typeof p.stock === "number" ? p.stock : 0) + amount) } : p
      )
    );
    sfx.click();
  }, []);

  /* ===== الجوائز والأسبوع ===== */
  /** منح جائزة أسبوعية بعملات فقط وبشكل آمن ضد التكرار. */
  const grantAward = useCallback(
    (id: string, title: string, coins = 0, _xp = 0, uniqueKey?: string) => {
      const st = students.find((s) => s.id === id);
      if (!st) return;
      const awardId = `week-${week}-${id}-${uniqueKey ?? title}`;
      const legacyTitle = title.split(" — ")[0];
      if (st.awards.some((a) => a.id === awardId || (a.week === week && (a.title === title || (uniqueKey && a.title === legacyTitle))))) return;
      const next: Student = {
        ...st,
        coins: st.coins + Math.max(0, coins),
        awards: [...st.awards, { id: awardId, title, week, coins: Math.max(0, coins) }],
      };
      setStudents((ss) => ss.map((s) => (s.id === id ? next : s)));
      sfx.fanfare();
      toast("award", `حصل ${st.name} على «${title}» (+${ar(coins)} عملة)`);
    },
    [students, toast, week]
  );

  const setCeremonyPick = useCallback((key: keyof CeremonyPicks, id: string | null) => {
    setCeremonyPicks((p) => ({ ...p, [key]: id ?? undefined }));
  }, []);

  const setCeremonyHalaqaPick = useCallback((reward: PerHalaqaRewardKey, halaqaId: string, id: string | null) => {
    const mapKey = reward === "improved" ? "improvedByHalaqa" : "behaviorByHalaqa";
    setCeremonyPicks((current) => {
      const previous = current[mapKey] ?? {};
      const next = { ...previous };
      if (id) next[halaqaId] = id;
      else delete next[halaqaId];
      return { ...current, [mapKey]: next };
    });
  }, []);

  const setRewardSetting = useCallback((key: keyof RewardSettings, value: Partial<RewardSettings[keyof RewardSettings]>) => {
    setRewardSettings((current) => ({
      ...current,
      [key]: { ...current[key], ...value, coins: Math.max(0, Number(value.coins ?? current[key].coins) || 0) },
    }));
  }, []);

  const removeWeekLog = useCallback(
    (w: number) => {
      setWeeksLog((logs) => logs.filter((l) => l.week !== w));
      toast("error", "تم حذف هذا الأسبوع من الأرشيف");
    },
    [toast]
  );

  const updateWeekLog = useCallback((targetWeek: number, next: WeekLog) => {
    setWeeksLog((logs) => logs.map((log) => log.week === targetWeek ? { ...next, week: targetWeek } : log));
    toast("success", "تم حفظ تعديلات الأسبوع السابق دون تغيير بيانات الطلاب الحالية");
  }, [toast]);

  /* ===== الرحلة الأسبوعية ===== */
  const setTrip = useCallback((on: boolean, day?: TripDay | null) => {
    setTripOn(on);
    if (day !== undefined) setTripDay(day);
    if (!on) setTripAttendees([]);
  }, []);

  /** تسجيل حضور الرحلة فقط؛ الجائزة تُصرف من الحفل حسب الإعداد المختار. */
  const toggleTripAttendee = useCallback(
    (id: string) => {
      const st = students.find((s) => s.id === id);
      if (!st) return;
      const was = tripAttendees.includes(id);
      setTripAttendees((a) => (was ? a.filter((x) => x !== id) : [...a, id]));
      if (!was) {
        sfx.pop();
        toast("success", `تم تسجيل حضور ${st.name} للرحلة`);
      } else {
        sfx.click();
      }
    },
    [students, toast, tripAttendees]
  );

  /* ===== الحفل ===== */
  const startCeremony = useCallback(() => {
    setShowCeremony(true);
    sfx.drum();
  }, []);
  const closeCeremony = useCallback(() => setShowCeremony(false), []);

  /** بدء أسبوع جديد: يؤرشف نتائج الأسبوع الحالي — القلوب تستمر كما هي */
  const startWeek = useCallback(() => {
    // أرشفة الأسبوع المنتهي
    const champs = championTop(students, tripOn, tripAttendees);
    const awards: { title: string; studentName: string; coins?: number; reward?: RewardKey }[] = [];
    if (rewardSettings.champions.enabled) {
      champs.forEach((st) => awards.push({ title: "بطل الأسبوع", studentName: st.name, coins: rewardSettings.champions.coins, reward: "champions" }));
    }
    for (const reward of ["improved", "behavior"] as const) {
      if (!rewardSettings[reward].enabled) continue;
      const picks = reward === "improved" ? ceremonyPicks.improvedByHalaqa : ceremonyPicks.behaviorByHalaqa;
      for (const studentId of Object.values(picks ?? {})) {
        const student = students.find((item) => item.id === studentId);
        if (student) awards.push({ title: reward === "improved" ? "الأكثر تطورًا" : "أفضل سلوك", studentName: student.name, coins: rewardSettings[reward].coins, reward });
      }
    }
    if (tripOn && rewardSettings.trip.enabled) students.filter((student) => tripAttendees.includes(student.id)).forEach((student) => awards.push({ title: "جائزة الرحلة", studentName: student.name, coins: rewardSettings.trip.coins, reward: "trip" }));
    const allEntries = students.map((s) => {
      const memorization = measureStudentWork(s, "memorization");
      const review = measureStudentWork(s, "review");
      const memorizationSnapshot = buildTrackSnapshot(s, "memorization");
      const reviewSnapshot = buildTrackSnapshot(s, "review");
      return {
        id: s.id, name: s.name, photo: s.photo, xp: s.xp, weekXp: s.weekXp,
        level: levelInfo(s.xp).level, coins: s.coins, hearts: s.hearts,
        frame: s.frame ?? null, crown: s.crown ?? null,
        attendanceDays: DAYS.filter((d) => s.days[d.key].a).length,
        absenceDays: DAYS.filter((d) => s.days[d.key].absent === true).length,
        evaluatedDays: DAYS.filter((d) => s.days[d.key].a || s.days[d.key].absent === true).length,
        memorizationLines: memorization.lines, reviewLines: review.lines,
        memorizationVerses: memorization.verses, reviewVerses: review.verses,
        memorizationPages: memorization.pages, reviewPages: review.pages,
        memorizationDays: memorizationSnapshot.completedDays,
        reviewDays: reviewSnapshot.completedDays,
        memorizationExpectedDays: memorizationSnapshot.expectedDays ?? undefined,
        reviewExpectedDays: reviewSnapshot.expectedDays ?? undefined,
        memorizationExpectedPages: memorizationSnapshot.expectedPages ?? undefined,
        reviewExpectedPages: reviewSnapshot.expectedPages ?? undefined,
        memorizationExcellent: memorizationSnapshot.excellent,
        memorizationVeryGood: memorizationSnapshot.veryGood,
        reviewExcellent: reviewSnapshot.excellent,
        reviewVeryGood: reviewSnapshot.veryGood,
        isTesting: s.isTesting === true,
        halaqaId: s.halaqaId ?? null,
      };
    });
    const log: WeekLog = {
      week,
      name: weekName,
      savedAt: new Date().toLocaleDateString("ar", { day: "numeric", month: "long" }),
      students: allEntries,
      top: [...allEntries]
        .sort((a, b) => b.weekXp - a.weekXp || b.xp - a.xp)
        .slice(0, 10)
        ,
      awards,
      records: students.map((s) => ({ id: s.id, name: s.name, photo: s.photo, halaqaId: s.halaqaId ?? null, isTesting: s.isTesting === true, days: structuredClone(s.days), recitationRatings: structuredClone(s.recitationRatings ?? emptyRecitationRatings()), ward: structuredClone(s.ward), hearts: s.hearts, heartsLostWeek: s.heartsLostWeek, xp: s.xp, coins: s.coins })),
      ceremonyPicks: structuredClone(ceremonyPicks),
      rewardSettings: structuredClone(rewardSettings),
      tripAttendeeIds: [...tripAttendees],
      trip:
        tripOn && tripDay
          ? {
              day: tripDay,
              attendeeNames: students.filter((s) => tripAttendees.includes(s.id)).map((s) => s.name),
            }
          : null,
    };
    setWeeksLog((logs) => [log, ...logs.filter((l) => l.week !== week)]);
    // أسبوع جديد: كشف نظيف — والقلوب تبقى كما هي (تُستعاد بالشراء أو بمنحة المعلم فقط)
    setWeek((w) => w + 1);
    setWeekNameState("");
    setStudents((ss) => ss.map((s) => ({ ...s, days: emptyWeekDays(), recitationRatings: emptyRecitationRatings(), weekXp: 0, weekCoins: 0, heartsLostWeek: 0 })));
    setCeremonyPicks({});
    setTripOn(false);
    setTripDay(null);
    setTripAttendees([]);
    sfx.sparkle();
    toast("success", "بدأ أسبوع جديد — كشف نظيف للجميع، والقلوب كما هي");
  }, [ceremonyPicks, rewardSettings, students, toast, tripAttendees, tripDay, tripOn, week, weekName]);

  const setWeekName = useCallback((name: string) => setWeekNameState(name), []);

  const value: Ctx = {
    students,
    halaqas,
    week,
    weekName,
    weeksLog,
    sound,
    ceremonyPicks,
    products,
    showNewProducts,
    setShowNewProducts,
    tripOn,
    tripDay,
    tripAttendees,
    rewardSettings,
    setTrip,
    toggleTripAttendee,
    tab,
    setTab,
    mode,
    setMode,
    toasts,
    toast,
    toggleSound: () => setSound((v) => !v),
    sorted,
    setWeekName,
    addStudent,
    updateStudentProfile,
    toggleStudentTesting,
    removeStudent,
    addHalaqa,
    renameHalaqa,
    removeHalaqa,
    markDay,
    markAbsent,
    updateWard,
    addXp,
    addCoins,
    removeHeart,
    restoreHeart,
    buyHeart,
    buyItem,
    grantItem,
    equipCosmetic,
    unequipSlot,
    deliverItem,
    undeliverItem,
    saveProduct,
    removeProduct,
    restockProduct,
    grantAward,
    setCeremonyPick,
    setCeremonyHalaqaPick,
    setRewardSetting,
    removeWeekLog,
    updateWeekLog,
    startWeek,
    showCeremony,
    startCeremony,
    closeCeremony,
    cloud,
    syncNow,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
