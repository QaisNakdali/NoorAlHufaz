import { DAYS, LEVEL_COIN_REWARD, MAX_HEARTS, emptyWeekDays, emptyWeeklyWard, levelInfo, weekCoinsOf, weekXpOf, isChampionEligible, type Student, type WeekLog, type WeekStudentRecord } from "./core.ts";
import { measureStudentWork } from "./analytics.ts";
import { sameValue } from "./syncMerge.ts";
import { buildCloudPatch } from "./cloudPatch.ts";

/** Preserve raw legacy fields that normalization does not understand. */
export function archiveCloudPayload(raw: unknown, normalizedBefore: unknown, edited: unknown): unknown {
  let data: any = structuredClone(raw);
  for (const op of buildCloudPatch(normalizedBefore, edited)) {
    if (!op.path.length) { data = structuredClone(op.value); continue; }
    if (op.path.some(k => ["__proto__", "prototype", "constructor"].includes(k))) throw Error("مسار بيانات غير صالح");
    let target = data;
    for (let i = 0; i < op.path.length - 1; i++) {
      const k = op.path[i];
      if (target[k] == null) target[k] = /^\d+$/.test(op.path[i + 1]) ? [] : {};
      target = target[k];
    }
    const key = op.path[op.path.length - 1];
    if (op.op === "set") target[key] = structuredClone(op.value);
    else if (op.op === "remove") { if (Array.isArray(target)) target.splice(Number(key), 1); else delete target[key]; }
    else target.splice(Number(key), 0, structuredClone(op.value));
  }
  return data;
}

/** Three-way edit merge: quantities are replacements, never additive counters. */
export function mergeArchiveEdit(base: any, draft: any, latest: any): any {
  if (sameValue(base, draft)) return latest;
  if (sameValue(latest, draft)) return latest;
  if (sameValue(base, latest)) return draft;
  if ([base,draft,latest].every(v => v && typeof v === "object" && !Array.isArray(v))) {
    const result={...latest};
    for(const key of new Set([...Object.keys(base),...Object.keys(draft)])) {
      if (sameValue(base[key],draft[key])) continue;
      const value=mergeArchiveEdit(base[key],draft[key],latest[key]);
      if(value===undefined)delete result[key];else result[key]=value;
    }
    return result;
  }
  if ([base,draft,latest].every(v => Array.isArray(v) && v.every((r:any)=>r && typeof r.id === "string"))) {
    const result=[...latest];
    for(const id of new Set([...base.map((r:any)=>r.id),...draft.map((r:any)=>r.id)])) {
      const a=base.find((r:any)=>r.id===id), b=draft.find((r:any)=>r.id===id), index=result.findIndex((r:any)=>r.id===id);
      if(sameValue(a,b))continue;
      const value=mergeArchiveEdit(a,b,index<0?undefined:result[index]);
      if(value===undefined){if(index>=0)result.splice(index,1);}else if(index<0)result.push(value);else result[index]=value;
    }
    return result;
  }
  throw Error("عدّل معلم آخر الحقل نفسه؛ أعد فتح الأسبوع وراجع التعديل قبل الحفظ");
}

function finalizeRecord(before: WeekStudentRecord | undefined, next: WeekStudentRecord): WeekStudentRecord {
  const days=structuredClone(next.days), ratings=structuredClone(next.recitationRatings);
  for(const {key} of DAYS) {
    const old=before?.days?.[key];
    for(const part of ["h","r"] as const) {
      const flagChanged=old?.[part]!==days[key]?.[part];
      const ratingChanged=before?.recitationRatings?.[key]?.[part]!==ratings?.[key]?.[part];
      if(!flagChanged && !ratingChanged)continue; // Never reinterpret unchanged legacy credits.
      ratings[key] ??= {};
      if(flagChanged && !days[key][part])ratings[key][part]=undefined;
      else if(flagChanged && days[key][part] && !ratingChanged && !ratings[key][part])ratings[key][part]="excellent";
      days[key][part]=!days[key].absent && (ratings[key][part]==="excellent" || ratings[key][part]==="very-good");
      if(!old?.h && !old?.r && days[key].testing===undefined)days[key].testing=next.isTesting===true;
    }
    if(days[key].absent)days[key]={...days[key],a:false,h:false,r:false};
  }
  return {...next,days,recitationRatings:ratings};
}

export function applyArchiveAdjustment<T extends {students:Student[];weeksLog:WeekLog[];week:number}>(state:T, targetWeek:number, draft:WeekLog, base:WeekLog):T {
  if(targetWeek===state.week)throw Error("لا يمكن تعديل الأسبوع الحالي من الأرشيف");
  if(state.weeksLog.filter(w=>w.week===targetWeek).length!==1)throw Error("رقم الأسبوع مكرر أو غير موجود؛ يلزم مراجعة السجل قبل تعديل المكافآت");
  const old=state.weeksLog.find(w=>w.week===targetWeek);
  if(!old || !old.records)throw Error("هذا السجل القديم لا يحتوي تفاصيل أيام موثوقة؛ يحتاج مراجعة قبل تعديل المكافآت");
  if(draft.week!==targetWeek || base.week!==targetWeek)throw Error("رقم الأسبوع لا يطابق المسودة");
  const merged=mergeArchiveEdit(base,draft,old) as WeekLog;
  if(sameValue(merged,old))return state;
  if(!merged.records || new Set(merged.records.map(r=>r.id)).size!==merged.records.length || merged.records.some(r=>!r.id))throw Error("معرّفات سجلات الطلاب غير صالحة أو مكررة");
  const records=merged.records.map(r=>finalizeRecord(old.records!.find(o=>o.id===r.id),r));
  let students=[...state.students];
  for(const id of new Set([...old.records.map(r=>r.id),...records.map(r=>r.id)])) {
    const previous=old.records.find(r=>r.id===id), updated=records.find(r=>r.id===id);
    const dx=weekXpOf(updated?.days)-weekXpOf(previous?.days), dc=weekCoinsOf(updated?.days)-weekCoinsOf(previous?.days);
    let index=students.findIndex(s=>s.id===id);
    if(index<0 && !previous && updated && id.startsWith("archive-") && updated.name && updated.name!=="طالب أضيف إلى السجل") {
      const fresh:Student={id,name:updated.name,photo:updated.photo,halaqaId:updated.halaqaId,hearts:MAX_HEARTS,heartsLostWeek:0,xp:0,coins:0,weekXp:0,weekCoins:0,highestRewardedLevel:1,days:emptyWeekDays(),ward:emptyWeeklyWard(),inventory:[],bag:[],awards:[],frame:null,crown:null,glow:null,cardBg:null,createdAt:Date.now()};
      students.push(fresh);index=students.length-1;
    }
    if(index<0) {
      if(dx || dc)throw Error("لا يمكن ربط المكافأة بطالب نشط باستخدام المعرّف؛ لم يتم تغيير أي رصيد");
      continue;
    }
    if(!dx && !dc)continue;
    const s=students[index], xp=s.xp+dx;
    const highest=Math.max(s.highestRewardedLevel??levelInfo(s.xp).level,levelInfo(xp).level);
    const bonus=(highest-(s.highestRewardedLevel??levelInfo(s.xp).level))*LEVEL_COIN_REWARD;
    const coins=s.coins+dc+bonus;
    if(!Number.isFinite(xp) || !Number.isFinite(coins) || xp<0 || coins<0)throw Error(`لا يكفي رصيد ${s.name} لعكس المكافأة القديمة؛ المشتريات محفوظة والتعديل لم يُطبّق`);
    students[index]={...s,xp,coins,highestRewardedLevel:highest};
  }
  const next = rebuildArchiveSummary({...merged, records}, old);
  return {...state,students,weeksLog:state.weeksLog.map(w=>w.week===targetWeek?next:w)};
}

/** Rebuild cached archive statistics without changing any wallet or historical award. */
export function rebuildArchiveSummary(merged: WeekLog, old: WeekLog = merged): WeekLog {
  const records = merged.records ?? [];
  const entries=records.map(r=>{
    const previous=old.students?.find(e=>e.id===r.id)??old.top.find(e=>e.id===r.id);
    const mem=measureStudentWork(r as Student,"memorization"),rev=measureStudentWork(r as Student,"review");
    const tripIds=merged.tripAttendeeIds??[];
    return {...previous,frame:previous?.frame??null,crown:previous?.crown??null,id:r.id,name:r.name,photo:r.photo,xp:r.xp,coins:r.coins,level:levelInfo(r.xp).level,weekXp:weekXpOf(r.days),weekCoins:weekCoinsOf(r.days),hearts:r.hearts,
      attendanceDays:DAYS.filter(d=>r.days[d.key]?.a&&!r.days[d.key]?.absent).length,absenceDays:DAYS.filter(d=>r.days[d.key]?.absent).length,
      memorizationLines:mem.lines,memorizationPages:mem.pages,memorizationVerses:mem.verses,memorizationDays:mem.sessions,memorizationSessions:mem.sessions,
      reviewLines:rev.lines,reviewPages:rev.pages,reviewVerses:rev.verses,reviewDays:rev.sessions,reviewSessions:rev.sessions,
      memorizationExemptDays:DAYS.filter(d=>r.days[d.key]?.testing===true&&!r.days[d.key]?.h).length,
      championEligible:isChampionEligible(r as Student,!!merged.trip,tripIds,merged.rewardSettings?.champions.ratingMode??"mixed"),isTesting:r.isTesting,halaqaId:r.halaqaId};
  });
  const next={...merged,records,students:entries,top:[...entries].sort((a,b)=>b.weekXp-a.weekXp||b.xp-a.xp).slice(0,10)};
  return next;
}
