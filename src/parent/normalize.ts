import { DAYS, emptyWeekDays, emptyWeeklyWard, emptyRecitationRatings, type Student, type WeekStudentRecord } from "../core.ts";
/** Read-only compatibility view; never writes or invents a failed evaluation. */
export function normalizeRecord<T extends Student|WeekStudentRecord>(record:T):T {
  const days=emptyWeekDays(),ward=emptyWeeklyWard(),ratings=emptyRecitationRatings();
  for(const {key} of DAYS){const entry=(record.days as any)?.[key];if(typeof entry==="boolean")days[key]={a:entry,h:entry,r:false};else if(entry&&typeof entry==="object")days[key]={...entry,a:entry.a===true,h:entry.h===true,r:entry.r===true,absent:entry.absent===true};const plan=record.ward?.[key];if(plan)ward[key]={...plan,memorization:String(plan.memorization??""),review:String(plan.review??"")};for(const part of ["h","r"] as const){const value=record.recitationRatings?.[key]?.[part];if(value==="excellent"||value==="very-good")ratings[key][part]=value;}}
  return {...record,days,ward,recitationRatings:ratings};
}
