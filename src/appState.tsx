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
  DEFAULT_HEART_PRICE,
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
  type Lesson,
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
import { localDateKey } from "./halaqaRotation";
import { formatHijriDate } from "./hijriDate";
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
  lessons: Lesson[];
  nextLessonId: string | null;
  lastCompletedLessonId: string | null;
  week: number;
  weekName: string;
  weeksLog: WeekLog[];
  sound: boolean;
  ceremonyPicks: CeremonyPicks;
  products: ShopItem[];
  heartPrice: number;
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
  setHeartPrice: (price: number) => void;

  addStudent: (name: string, photo: string | null, halaqaId?: string | null) => void;
  updateStudentProfile: (id: string, changes: { name?: string; photo?: string | null; coins?: number; xp?: number; hearts?: number; halaqaId?: string | null }) => void;
  toggleStudentTesting: (id: string) => void;
  removeStudent: (id: string) => void;
  addHalaqa: (name: string, teacherNames?: string[]) => void;
  renameHalaqa: (id: string, name: string) => void;
  updateHalaqaTeachers: (id: string, teacherNames: string[]) => void;
  setHalaqaDistribution: (id: string, enabled: boolean) => void;
  removeHalaqa: (id: string) => void;
  addLesson: (title: string, teacher: string) => void;
  completeLesson: (id: string) => void;
  undoLastLessonCompletion: () => void;
  setNextLesson: (id: string) => void;
  updateLesson: (id: string, title: string, teacher: string) => void;
  removeLesson: (id: string) => void;
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
      ? (p.halaqas as Halaqa[])
          .filter((h) => h && typeof h.id === "string" && typeof h.name === "string")
          .map((h) => ({
            ...h,
            teachers: Array.isArray(h.teachers)
              ? h.teachers.filter((teacher) => teacher && typeof teacher.id === "string" && typeof teacher.name === "string")
              : [],
            randomDistribution: h.randomDistribution === true,
            rotationAnchorDate: typeof h.rotationAnchorDate === "string" ? h.rotationAnchorDate : localDateKey(),
            rotationSeed: typeof h.rotationSeed === "number" ? h.rotationSeed : 1,
          }))
      : [],
    lessons: Array.isArray(p.lessons)
      ? (p.lessons as Lesson[])
          .filter((lesson) => lesson && typeof lesson.id === "string" && typeof lesson.title === "string" && typeof lesson.teacher === "string")
          .map((lesson, index) => ({
            ...lesson,
            order: typeof lesson.order === "number" ? lesson.order : index + 1,
            createdAt: typeof lesson.createdAt === "number" ? lesson.createdAt : index,
            completedAt: typeof lesson.completedAt === "number" ? lesson.completedAt : null,
          }))
          .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
      : [],
    nextLessonId: typeof p.nextLessonId === "string" ? p.nextLessonId : null,
    lastCompletedLessonId: typeof p.lastCompletedLessonId === "string" ? p.lastCompletedLessonId : null,
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
    heartPrice: typeof p.heartPrice === "number" && Number.isFinite(p.heartPrice)
      ? Math.max(0, Math.round(p.heartPrice))
      : DEFAULT_HEART_PRICE,
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

function readStoredDirty(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return (JSON.parse(raw) as { __dirty?: boolean }).__dirty === true;
  } catch {
    /* تجاهل */
  }
  return false;
}

function readStoredBase(): State | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as { __base?: Partial<State> };
    return stored.__base ? stateFromPartial(stored.__base) : null;
  } catch {
    return null;
  }
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function arrayItemKey(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  for (const field of ["id", "week", "itemId", "key"] as const) {
    const key = item[field];
    if (typeof key === "string" || typeof key === "number") return `${field}:${String(key)}`;
  }
  return null;
}

/**
 * يطبق فقط الفروق التي صنعها هذا الجهاز فوق أحدث نسخة سحابية.
 * بهذه الطريقة لا يؤدي تعديل قلب أو سعر إلى إعادة قائمة طلاب قديمة كاملة.
 */
export type MergeConflict = {
  path: string;
  kind: "same-field" | "delete-vs-update";
};

function noteConflict(conflicts: MergeConflict[] | undefined, path: string[], kind: MergeConflict["kind"]): void {
  if (!conflicts) return;
  const value = { path: path.join("."), kind };
  if (!conflicts.some((item) => item.path === value.path && item.kind === value.kind)) conflicts.push(value);
}

export function mergeLocalChanges(
  base: unknown,
  local: unknown,
  remote: unknown,
  path: string[] = [],
  conflicts?: MergeConflict[]
): unknown {
  if (sameValue(local, base)) return remote;
  if (sameValue(remote, base) || sameValue(local, remote)) return local;

  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) {
    const keyed = [...base, ...local, ...remote].every((item) => arrayItemKey(item) !== null);
    if (keyed) {
      const baseMap = new Map(base.map((item) => [arrayItemKey(item) as string, item]));
      const localMap = new Map(local.map((item) => [arrayItemKey(item) as string, item]));
      const remoteMap = new Map(remote.map((item) => [arrayItemKey(item) as string, item]));
      const order = [...remoteMap.keys(), ...[...localMap.keys()].filter((key) => !remoteMap.has(key))];
      const merged: unknown[] = [];
      for (const key of order) {
        const hadBase = baseMap.has(key);
        const hasLocal = localMap.has(key);
        const hasRemote = remoteMap.has(key);
        if (hadBase && !hasLocal) {
          if (hasRemote && !sameValue(remoteMap.get(key), baseMap.get(key))) noteConflict(conflicts, [...path, key], "delete-vs-update");
          continue; // الحذف المقصود يفوز ولا تعيد نسخة قديمة العنصر لاحقًا
        }
        if (!hasLocal && hasRemote) {
          merged.push(remoteMap.get(key));
          continue;
        }
        if (hasLocal && !hasRemote) {
          if (!hadBase) merged.push(localMap.get(key)); // إضافة محلية
          else if (!sameValue(localMap.get(key), baseMap.get(key))) noteConflict(conflicts, [...path, key], "delete-vs-update");
          continue; // حذف بعيد مع عدم تعديل محلي
        }
        merged.push(mergeLocalChanges(baseMap.get(key), localMap.get(key), remoteMap.get(key), [...path, key], conflicts));
      }
      return merged;
    }

    // قوائم القيم البسيطة: نطبق إضافات وحذوفات هذا الجهاز فوق القائمة البعيدة.
    const result = [...remote];
    for (const oldItem of base) {
      if (!local.some((item) => sameValue(item, oldItem))) {
        const index = result.findIndex((item) => sameValue(item, oldItem));
        if (index >= 0) result.splice(index, 1);
      }
    }
    for (const item of local) {
      if (!base.some((oldItem) => sameValue(oldItem, item)) && !result.some((current) => sameValue(current, item))) result.push(item);
    }
    return result;
  }

  if (base && local && remote && typeof base === "object" && typeof local === "object" && typeof remote === "object") {
    const b = base as Record<string, unknown>;
    const l = local as Record<string, unknown>;
    const r = remote as Record<string, unknown>;
    const result: Record<string, unknown> = { ...r };
    for (const key of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)])) {
      if (key in b && !(key in l)) {
        if (key in r && !sameValue(r[key], b[key])) noteConflict(conflicts, [...path, key], "delete-vs-update");
        delete result[key];
      } else if (key in l) result[key] = mergeLocalChanges(b[key], l[key], r[key], [...path, key], conflicts);
    }
    return result;
  }

  // الأرصدة والقيم التراكمية تُدمج كفرق، فلا تضيع زيادة جهاز آخر بسبب لقطة قديمة.
  const field = path[path.length - 1];
  if (["coins", "xp", "hearts", "heartsLostWeek", "qty", "receivedQty"].includes(field)
    && typeof base === "number" && typeof local === "number" && typeof remote === "number") {
    return Math.max(0, remote + (local - base));
  }
  // تعارض على نفس الحقل غير التراكمي لا يمكن دمجه بأمان: نحافظ على النسخة السحابية
  // ونبلغ المستخدم بدل أن تكتب النسخة القديمة فوق تعديل معلم آخر بصمت.
  noteConflict(conflicts, path, "same-field");
  return remote;
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
  const [lessons, setLessons] = useState<Lesson[]>(init.lessons);
  const [nextLessonId, setNextLessonId] = useState<string | null>(init.nextLessonId);
  const [lastCompletedLessonId, setLastCompletedLessonId] = useState<string | null>(init.lastCompletedLessonId);
  const [week, setWeek] = useState(init.week);
  const [weekName, setWeekNameState] = useState(init.weekName);
  const [weeksLog, setWeeksLog] = useState<WeekLog[]>(init.weeksLog);
  const [sound, setSound] = useState(init.sound);
  const [ceremonyPicks, setCeremonyPicks] = useState<CeremonyPicks>(init.ceremonyPicks);
  const [products, setProducts] = useState<ShopItem[]>(init.products);
  const [heartPrice, setHeartPriceState] = useState(init.heartPrice);
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
  const revRef = useRef(0); // آخر رقم نسخة سحابية بُنيت عليه الحالة المحلية
  const syncedBaseRef = useRef<State | null>(null); // آخر حالة مؤكدة من السحابة للمقارنة والدمج
  const dirtyRef = useRef(false); // توجد فروق محلية لم تُحفظ بعد
  const cloudDataRef = useRef<State | null>(null); // مرآة البيانات لأغراض الرفع
  const pushTimer = useRef<number | null>(null);
  const firstSave = useRef(true);
  const pushInFlight = useRef(false);
  const pushAgain = useRef(false);
  const reportedConflictRef = useRef<string>("");
  // يحدد إن كانت اللقطة الجاري تطبيقها نظيفة أم تحتوي دمجًا محليًا يحتاج رفعًا جديدًا.
  const applyingSnapshot = useRef<{ rev: number; dirty: boolean } | null>(null);

  /** تطبيق لقطة كاملة مع إبقاء جميع المعرفات والسجلات كما وردت. */
  const applySnapshot = useCallback((next: State, rev: number, dirty: boolean) => {
    if (pushTimer.current) {
      window.clearTimeout(pushTimer.current);
      pushTimer.current = null;
    }
    applyingSnapshot.current = { rev, dirty };
    setStudents(next.students);
    setHalaqas(next.halaqas);
    setLessons(next.lessons);
    setNextLessonId(next.nextLessonId);
    setLastCompletedLessonId(next.lastCompletedLessonId);
    setWeek(next.week);
    setWeekNameState(next.weekName);
    setWeeksLog(next.weeksLog);
    setSound(next.sound);
    setCeremonyPicks(next.ceremonyPicks);
    setProducts(next.products);
    setHeartPriceState(next.heartPrice);
    setShowNewProducts(next.showNewProducts);
    setTripOn(next.tripOn);
    setTripDay(next.tripDay);
    setTripAttendees(next.tripAttendees);
    setRewardSettings(next.rewardSettings);
  }, []);

  /** رفع نسخة إلى السحابة */
  const pushCloud = useCallback(async (force = false) => {
    if (!isCloudEnabled()) return;
    if (pushInFlight.current) {
      pushAgain.current = true;
      return;
    }
    if (!force && !dirtyRef.current) return;
    const initialLocal = cloudDataRef.current;
    if (!initialLocal) return;
    pushInFlight.current = true;
    setCloud((c) => ({ ...c, status: "syncing" }));
    try {
      let base = syncedBaseRef.current ?? initialLocal;
      let candidate = initialLocal;
      let expectedRev = revRef.current;
      let savedState: State | null = null;
      let savedRev = expectedRev;
      const conflicts: MergeConflict[] = [];

      // عند التعارض ندمج فروق هذا الجهاز فوق النسخة الفائزة ثم نعيد المحاولة ذريًا.
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const result = await cloudSave({ rev: expectedRev + 1, data: candidate }, expectedRev);
        const normalized = stateFromPartial(result.data as Partial<State>);
        if (result.applied) {
          savedState = normalized;
          savedRev = result.rev;
          break;
        }
        candidate = stateFromPartial(mergeLocalChanges(base, candidate, normalized, [], conflicts) as Partial<State>);
        base = normalized;
        expectedRev = result.rev;
      }

      if (!savedState) throw new Error("تعذر تثبيت التغييرات بعد عدة محاولات متزامنة");

      // إن حدث تعديل جديد أثناء الرفع، نحتفظ به كفرق فوق النسخة التي تم تثبيتها.
      const currentLocal = cloudDataRef.current ?? initialLocal;
      const finalLocal = stateFromPartial(mergeLocalChanges(initialLocal, currentLocal, savedState, [], conflicts) as Partial<State>);
      const stillDirty = !sameValue(finalLocal, savedState);
      revRef.current = savedRev;
      syncedBaseRef.current = savedState;
      dirtyRef.current = stillDirty;
      cloudDataRef.current = finalLocal;
      applySnapshot(finalLocal, savedRev, stillDirty);
      if (conflicts.length > 0) {
        const signature = conflicts.map((item) => `${item.kind}:${item.path}`).sort().join("|");
        if (reportedConflictRef.current !== signature) {
          reportedConflictRef.current = signature;
          toast("error", "وُجد تعديل متزامن على نفس البيانات؛ تم الاحتفاظ بالنسخة السحابية الأحدث دون حذف سجلات أي معلم.");
        }
      }
      if (stillDirty) pushAgain.current = true;
      setCloud((c) => ({ ...c, status: "ok", lastSyncAt: Date.now(), lastError: null }));
    } catch (e) {
      setCloud((c) => ({ ...c, status: "error", lastError: errMsg(e) }));
    } finally {
      pushInFlight.current = false;
      if (pushAgain.current || dirtyRef.current) {
        pushAgain.current = false;
        if (pushTimer.current) window.clearTimeout(pushTimer.current);
        pushTimer.current = window.setTimeout(() => void pushCloud(), 250);
      }
    }
  }, [applySnapshot, toast]);

  /** تطبيق حزمة قادمة من السحابة على الحالة */
  const prepareRemote = useCallback((remote: State): State => {
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
    return remote;
  }, []);

  /** استقبال نسخة أحدث مع حماية أي تعديل محلي لم يصل للسحابة بعد. */
  const receiveRemote = useCallback((incoming: State, remoteRev: number) => {
    const remote = prepareRemote(incoming);
    const local = cloudDataRef.current ?? remote;
    const base = syncedBaseRef.current ?? local;
    const conflicts: MergeConflict[] = [];
    const merged = dirtyRef.current
      ? stateFromPartial(mergeLocalChanges(base, local, remote, [], conflicts) as Partial<State>)
      : remote;
    const dirty = !sameValue(merged, remote);
    revRef.current = remoteRev;
    syncedBaseRef.current = remote;
    dirtyRef.current = dirty;
    cloudDataRef.current = merged;
    applySnapshot(merged, remoteRev, dirty);
    if (conflicts.length > 0) {
      const signature = conflicts.map((item) => `${item.kind}:${item.path}`).sort().join("|");
      if (reportedConflictRef.current !== signature) {
        reportedConflictRef.current = signature;
        toast("error", "وصل تعديل أحدث على نفس البيانات؛ تم منع الكتابة القديمة والاحتفاظ بالنسخة السحابية.");
      }
    }
  }, [applySnapshot, prepareRemote, toast]);

  /** سحب أحدث نسخة من السحابة وتطبيقها إن كانت أحدث من المحلية */
  const pullCloud = useCallback(
    async (announce: boolean) => {
      if (!isCloudEnabled()) return;
      setCloud((c) => (c.status === "error" ? c : { ...c, status: "syncing" }));
      try {
        const remote = await cloudLoad();
        if (remote && remote.rev > revRef.current) {
          const norm = stateFromPartial(remote.data as Partial<State>);
          receiveRemote(norm, remote.rev);
          if (announce) toast("success", "تم جلب تحديثات جديدة من السحابة");
        } else if (!remote) {
          // السحابة فارغة ولدينا بيانات حقيقية — ننشر نسختنا
          dirtyRef.current = true;
          await pushCloud(true);
          return; // pushCloud حدّث الحالة بالفعل
        } else if (dirtyRef.current) {
          await pushCloud(true);
          return;
        }
        setCloud((c) => ({ ...c, status: "ok", lastSyncAt: Date.now(), lastError: null }));
      } catch (e) {
        setCloud((c) => ({ ...c, status: "error", lastError: errMsg(e) }));
      }
    },
    [pushCloud, receiveRemote, toast]
  );

  // حفظ محلي + رفع سحابي عند كل تغيير
  useEffect(() => {
    const persistData: State = {
      students,
      halaqas,
      lessons,
      nextLessonId,
      lastCompletedLessonId,
      week,
      weekName,
      weeksLog,
      sound,
      ceremonyPicks,
      products,
      heartPrice,
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

    // لقطة مطبقة من المزامنة: احفظها، وارفعها فقط إن كانت تحتوي دمجًا محليًا.
    if (applyingSnapshot.current !== null) {
      const snapshot = applyingSnapshot.current;
      applyingSnapshot.current = null;
      revRef.current = snapshot.rev;
      dirtyRef.current = snapshot.dirty;
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...persistData, __rev: snapshot.rev, __dirty: snapshot.dirty, __base: syncedBaseRef.current }));
      } catch {
        /* تجاهل */
      }
      if (snapshot.dirty && isCloudEnabled()) {
        if (pushTimer.current) window.clearTimeout(pushTimer.current);
        pushTimer.current = window.setTimeout(() => void pushCloud(), 250);
      }
      return;
    }

    if (firstSave.current) {
      // أول تشغيل: نحفظ محليًا فقط ونقرأ رقم النسخة المخزون
      firstSave.current = false;
      revRef.current = readStoredRev();
      dirtyRef.current = readStoredDirty();
      syncedBaseRef.current = readStoredBase() ?? persistData;
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...persistData, __rev: revRef.current, __dirty: dirtyRef.current, __base: syncedBaseRef.current }));
      } catch {
        /* تجاهل */
      }
      return;
    }

    // تعديل حقيقي: نضع علامة dirty؛ رقم السحابة لا يتغير إلا بعد نجاح الحفظ المشروط.
    dirtyRef.current = true;
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...persistData, __rev: revRef.current, __dirty: true, __base: syncedBaseRef.current }));
    } catch {
      /* تجاهل */
    }
    if (isCloudEnabled()) {
      if (pushTimer.current) window.clearTimeout(pushTimer.current);
      pushTimer.current = window.setTimeout(() => void pushCloud(), 700);
    }
  }, [students, halaqas, lessons, nextLessonId, lastCompletedLessonId, week, weekName, weeksLog, sound, ceremonyPicks, products, heartPrice, showNewProducts, tripOn, tripDay, tripAttendees, rewardSettings, pushCloud]);

  // سحب أولي مرة واحدة، ثم استقبال التحديثات لحظيًا عبر Supabase Realtime.
  useEffect(() => {
    if (!cloudEnabled) return;
    void pullCloud(false);
    return subscribeCloud((remote) => {
      if (remote.rev <= revRef.current) return;
      const normalized = stateFromPartial(remote.data as Partial<State>);
      receiveRemote(normalized, remote.rev);
      setCloud((c) => ({ ...c, status: "ok", lastSyncAt: Date.now(), lastError: null }));
    });
  }, [cloudEnabled, pullCloud, receiveRemote]);

  /** مزامنة فورية يدوية (سحب ثم رفع) */
  const syncNow = useCallback(() => {
    if (!cloudEnabled) return;
    void pullCloud(true).then(() => void pushCloud(dirtyRef.current));
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

  const addHalaqa = useCallback((name: string, teacherNames: string[] = []) => {
    const clean = name.trim();
    if (!clean) return;
    const names = [...new Set(teacherNames.map((teacher) => teacher.trim()).filter(Boolean))];
    if (names.length === 0) {
      toast("error", "أضف اسم المعلم الأول للحلقة");
      return;
    }
    setHalaqas((hs) => {
      if (hs.some((h) => h.name === clean)) {
        toast("error", "يوجد حلقة بهذا الاسم بالفعل");
        return hs;
      }
      const used = new Set(hs.flatMap((h) => (h.teachers ?? []).map((teacher) => teacher.name.trim().toLocaleLowerCase("ar"))));
      const duplicate = names.find((teacher) => used.has(teacher.toLocaleLowerCase("ar")));
      if (duplicate) {
        toast("error", `المعلم ${duplicate} مرتبط بحلقة أخرى`);
        return hs;
      }
      const now = Date.now();
      const next = [...hs, {
        id: uid(), name: clean, createdAt: now,
        teachers: names.map((teacher, index) => ({ id: uid(), name: teacher, createdAt: now + index })),
        randomDistribution: false,
        rotationAnchorDate: localDateKey(),
        rotationSeed: now,
      }];
      toast("success", `تمت إضافة ${clean}`);
      return next;
    });
  }, [toast]);

  const renameHalaqa = useCallback((id: string, name: string) => {
    const clean = name.trim();
    if (!clean) return;
    setHalaqas((hs) => hs.map((h) => h.id === id ? { ...h, name: clean } : h));
  }, []);

  const updateHalaqaTeachers = useCallback((id: string, teacherNames: string[]) => {
    const names = [...new Set(teacherNames.map((teacher) => teacher.trim()).filter(Boolean))];
    setHalaqas((hs) => {
      const usedElsewhere = new Set(hs.filter((h) => h.id !== id).flatMap((h) => (h.teachers ?? []).map((teacher) => teacher.name.trim().toLocaleLowerCase("ar"))));
      const duplicate = names.find((teacher) => usedElsewhere.has(teacher.toLocaleLowerCase("ar")));
      if (duplicate) {
        toast("error", `المعلم ${duplicate} مرتبط بحلقة أخرى`);
        return hs;
      }
      const next = hs.map((halaqa) => {
        if (halaqa.id !== id) return halaqa;
        const old = halaqa.teachers ?? [];
        const now = Date.now();
        const teachers = names.map((teacher, index) => old.find((item) => item.name.trim().toLocaleLowerCase("ar") === teacher.toLocaleLowerCase("ar")) ?? { id: uid(), name: teacher, createdAt: now + index });
        return { ...halaqa, teachers, rotationAnchorDate: localDateKey(), rotationSeed: now };
      });
      toast("success", "تم حفظ معلمي الحلقة وإعادة بدء دورة التوزيع بأمان");
      return next;
    });
  }, [toast]);

  const setHalaqaDistribution = useCallback((id: string, enabled: boolean) => {
    const now = Date.now();
    setHalaqas((hs) => hs.map((halaqa) => halaqa.id === id ? {
      ...halaqa,
      randomDistribution: enabled && (halaqa.teachers?.length ?? 0) > 1,
      rotationAnchorDate: localDateKey(),
      rotationSeed: now,
    } : halaqa));
    toast("success", enabled ? "تم تشغيل التوزيع اليومي المتوازن" : "تم إيقاف التوزيع اليومي");
  }, [toast]);

  const removeHalaqa = useCallback((id: string) => {
    setHalaqas((hs) => hs.filter((h) => h.id !== id));
    setStudents((ss) => ss.map((s) => s.halaqaId === id ? { ...s, halaqaId: null } : s));
    toast("success", "حُذفت الحلقة وأصبح طلابها بلا حلقة، دون حذف أي طالب أو سجل");
  }, [toast]);

  /* ===== الدروس: سجل مستقل متزامن ولا يغيّر أي بيانات للطلاب ===== */
  const addLesson = useCallback((title: string, teacher: string) => {
    const cleanTitle = title.trim();
    const cleanTeacher = teacher.trim();
    if (!cleanTitle || !cleanTeacher) {
      toast("error", "اكتب عنوان الدرس واسم المعلم");
      return;
    }
    setLessons((items) => {
      const nextOrder = items.reduce((max, lesson) => Math.max(max, lesson.order), 0) + 1;
      return [...items, {
        id: uid(),
        title: cleanTitle,
        teacher: cleanTeacher,
        order: nextOrder,
        createdAt: Date.now(),
        completedAt: null,
      }];
    });
    toast("success", `تمت إضافة درس: ${cleanTitle}`);
  }, [toast]);

  const completeLesson = useCallback((id: string) => {
    let completedTitle = "";
    setLessons((items) => items.map((lesson) => {
      if (lesson.id !== id || lesson.completedAt !== null) return lesson;
      completedTitle = lesson.title;
      return { ...lesson, completedAt: Date.now() };
    }));
    if (completedTitle) {
      setLastCompletedLessonId(id);
      setNextLessonId((current) => current === id ? null : current);
      toast("success", `تم تسجيل إعطاء درس: ${completedTitle}`);
    }
  }, [toast]);

  const undoLastLessonCompletion = useCallback(() => {
    if (!lastCompletedLessonId) {
      toast("error", "لا توجد عملية إعطاء حديثة للتراجع عنها");
      return;
    }
    let restored = "";
    setLessons((items) => items.map((lesson) => {
      if (lesson.id !== lastCompletedLessonId || lesson.completedAt === null) return lesson;
      restored = lesson.title;
      return { ...lesson, completedAt: null };
    }));
    if (restored) {
      setNextLessonId(lastCompletedLessonId);
      setLastCompletedLessonId(null);
      toast("success", `تم التراجع، وعاد «${restored}» درسًا قادمًا`);
    }
  }, [lastCompletedLessonId, toast]);

  const setNextLesson = useCallback((id: string) => {
    const lesson = lessons.find((item) => item.id === id && item.completedAt === null);
    if (!lesson) return;
    setNextLessonId(id);
    toast("success", `أصبح «${lesson.title}» الدرس القادم`);
  }, [lessons, toast]);

  const updateLesson = useCallback((id: string, title: string, teacher: string) => {
    const cleanTitle = title.trim();
    const cleanTeacher = teacher.trim();
    if (!cleanTitle || !cleanTeacher) {
      toast("error", "اكتب عنوان الدرس واسم المعلم");
      return;
    }
    setLessons((items) => items.map((lesson) => lesson.id === id ? { ...lesson, title: cleanTitle, teacher: cleanTeacher } : lesson));
    toast("success", "تم تعديل الدرس دون تغيير ترتيبه أو حالته");
  }, [toast]);

  const removeLesson = useCallback((id: string) => {
    setLessons((items) => items.filter((lesson) => lesson.id !== id));
    setNextLessonId((current) => current === id ? null : current);
    setLastCompletedLessonId((current) => current === id ? null : current);
    toast("success", "تم حذف الدرس فقط");
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
      if (st.coins < heartPrice) {
        toast("error", `عملاتك لا تكفي — تحتاج ${ar(heartPrice)}`);
        sfx.error();
        return;
      }
      setStudents((ss) =>
        ss.map((s) => (s.id === id ? { ...s, coins: s.coins - heartPrice, hearts: Math.min(MAX_HEARTS, s.hearts + 1) } : s))
      );
      sfx.coin();
      const t = window.setTimeout(() => sfx.sparkle(), 180);
      timers.current.push(t);
      toast("heart", `اشترى ${st.name} قلبًا جديدًا وعاد لنقاط المستوى`);
    },
    [heartPrice, students, toast]
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
      savedAt: formatHijriDate(new Date()),
      savedAtIso: new Date().toISOString(),
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
  const setHeartPrice = useCallback((price: number) => {
    const normalized = Math.max(0, Math.round(Number.isFinite(price) ? price : DEFAULT_HEART_PRICE));
    setHeartPriceState(normalized);
    toast("success", `تم حفظ سعر القلب: ${ar(normalized)} عملة`);
  }, [toast]);

  const value: Ctx = {
    students,
    halaqas,
    lessons,
    nextLessonId,
    lastCompletedLessonId,
    week,
    weekName,
    weeksLog,
    sound,
    ceremonyPicks,
    products,
    heartPrice,
    setHeartPrice,
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
    updateHalaqaTeachers,
    setHalaqaDistribution,
    removeHalaqa,
    addLesson,
    completeLesson,
    undoLastLessonCompletion,
    setNextLesson,
    updateLesson,
    removeLesson,
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
