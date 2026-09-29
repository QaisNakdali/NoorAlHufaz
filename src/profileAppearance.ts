import type { BgKind } from "./core";

const PROFILE_BG_META: Record<string, { card: string; top: string; dark?: boolean }> = {
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

export const profileCardClass = (bg?: BgKind | null): string => bg && PROFILE_BG_META[bg] ? PROFILE_BG_META[bg].card : "border-grape-200 bg-white";
export const profileCardTopClass = (bg?: BgKind | null): string => bg && PROFILE_BG_META[bg] ? PROFILE_BG_META[bg].top : "bg-gradient-to-b from-grape-100 to-transparent";
export const profileCardIsDark = (bg?: BgKind | null): boolean => !!(bg && PROFILE_BG_META[bg]?.dark);
