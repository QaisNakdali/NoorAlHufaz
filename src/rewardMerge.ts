import { mergeArchiveEdit, rebuildArchiveSummary } from "./archiveAdjustment.ts";
import { weekXpOf, weekCoinsOf, levelInfo, LEVEL_COIN_REWARD, type Student, type WeekLog } from "./core.ts";
import { mergeLocalChanges, sameValue, type MergeConflict } from "./syncMerge.ts";

function earned(state: any, id: string): {xp:number;coins:number} {
  const s=state.students.find((s:Student)=>s.id===id);
  let xp=weekXpOf(s?.days), coins=weekCoinsOf(s?.days);
  const weeks=new Map<number,WeekLog>((state.weeksLog??[]).filter((w:WeekLog)=>w.week!==state.week).map((w:WeekLog)=>[w.week,w]));
  for(const w of weeks.values()) {
    const r=w.records?.find(r=>r.id===id);
    if(r){xp+=weekXpOf(r.days);coins+=weekCoinsOf(r.days);}
  }
  const seenAwards = new Set<string>();
  for(const award of s?.awards ?? []) {
    if(!award.id || seenAwards.has(award.id)) continue;
    seenAwards.add(award.id);
    xp += Math.max(0, award.xp ?? 0);
    coins += Math.max(0, award.coins ?? 0);
  }
  return {xp,coins};
}

function hasWeekEdits(base:any,next:any):boolean {
  if(!sameValue(base?.ceremonyPicks,next?.ceremonyPicks))return true;
  return (base?.students??[]).some((before:Student)=>{
    const after=next?.students?.find((s:Student)=>s.id===before.id);
    return after && ['days','ward','recitationRatings'].some(key=>!sameValue((before as any)[key],after[key]));
  });
}

/** Move pending weekly edits to their original archive, never into the new week. */
function alignClosedWeek(base:any, local:any, remote:any): {base:any;local:any;log:WeekLog} {
  const closed=remote.weeksLog?.find((w:WeekLog)=>w.week===base.week);
  if(!closed?.records)throw Error('لا توجد تفاصيل أرشيف الأسبوع موثوقة لحفظ التعديل المعلق؛ احتُفظ بالمسودة');
  const weekly=['days','ward','recitationRatings','isTesting','heartsLostWeek','dailyRecitedDate','dailyAbsentDate'];
  const makeLog=(side:any)=>({...closed,records:closed.records.map((r:any)=>{
    const s=side.students.find((s:Student)=>s.id===r.id);
    if(!s)return r;
    const result={...r};for(const key of weekly)result[key]=s[key];return result;
  })});
  const before=makeLog(base),draft=makeLog(local);
  for(const s of local.students)if(!closed.records.some((r:any)=>r.id===s.id)&&!sameValue(base.students.find((r:Student)=>r.id===s.id),s))throw Error('طالب معدل غير موجود في الأرشيف؛ احتُفظ بالمسودة للمراجعة');
  const log=rebuildArchiveSummary(mergeArchiveEdit(before,draft,closed));
  const align=(side:any,archive:any)=>{
    const next={...side,week:remote.week,weekName:remote.weekName,weekStartDateIso:remote.weekStartDateIso,
      weeksLog:[...side.weeksLog.filter((w:WeekLog)=>w.week!==base.week),archive,...remote.weeksLog.filter((w:WeekLog)=>w.week!==base.week&&!side.weeksLog.some((v:WeekLog)=>v.week===w.week))],
      students:side.students.map((s:Student)=>{const current=remote.students.find((r:Student)=>r.id===s.id);if(!current)return s;const result={...s};for(const key of weekly)if(key!=='isTesting')(result as any)[key]=(current as any)[key];result.weekXp=current.weekXp;result.weekCoins=current.weekCoins;return result;})};
    for(const key of ['ceremonyPicks','ceremonyProductIds','tripOn','tripDay','tripAttendees']) {
      if(!sameValue(base[key],local[key]))throw Error('تغيّرت إعدادات الحفل قبل إنهاء الأسبوع؛ احتُفظ بالمسودة للمراجعة');
      next[key]=remote[key];
    }
    return next;
  };
  return {base:align(base,before),local:align(local,draft),log};
}

/** Numeric balances are derived, unlike manual adjustments and recorded spending. */
export function mergeAccountingChanges(base:any,local:any,remote:any,path:string[]=[],conflicts:MergeConflict[]=[]):any {
  if(base?.week!==undefined && local?.week===base.week && remote?.week>base.week && hasWeekEdits(base,local)) {
    const aligned=alignClosedWeek(base,local,remote);
    const merged=mergeAccountingChanges(aligned.base,aligned.local,remote,path,conflicts);
    return {...merged,weeksLog:merged.weeksLog.map((w:WeekLog)=>w.week===base.week?aligned.log:w)};
  }
  if(base?.week!==undefined && remote?.week===base.week && local?.week===base.week+1 && local.weeksLog?.some((w:WeekLog)=>w.week===base.week && w.records)) {
    const aligned=alignClosedWeek(base,remote,local);
    const merged=mergeAccountingChanges(aligned.base,aligned.local,local,path,conflicts);
    return {...merged,weeksLog:merged.weeksLog.map((w:WeekLog)=>w.week===base.week?aligned.log:w)};
  }
  if(base?.week!==undefined && local?.week!==remote?.week &&
    ((local?.week!==base.week && hasWeekEdits(base,remote)) || (remote?.week!==base.week && hasWeekEdits(base,local)))) {
    throw Error('تغيّر الأسبوع أثناء تعديل الكشف؛ احتُفظ بالتعديل المحلي للمراجعة، ولا يمكن نقله تلقائيًا إلى الأسبوع الجديد');
  }
  const merged=mergeLocalChanges(base,local,remote,path,conflicts) as any;
  if(conflicts.some(c=>c.path.startsWith('ceremonyPicks.')))throw Error('تغيّر اختيار الجائزة لدى معلم آخر؛ حدّث الصفحة وراجع الاختيارات قبل الحفظ');
  for(const key of ['improvedByHalaqa','behaviorByHalaqa'])for(const ids of Object.values(merged?.ceremonyPicks?.[key]??{})){
    if(Array.isArray(ids)&&new Set(ids.filter(Boolean)).size>2)throw Error('تعارض اختيار الفائزين: الحد الأقصى طالبان لكل جائزة في الحلقة');
  }
  if(merged===remote||merged===local)return merged;
  if(![base,local,remote,merged].every(s=>Array.isArray(s?.students)))return merged;
  return {...merged,students:merged.students.map((s:Student)=>{
    const b=base.students.find((r:Student)=>r.id===s.id),l=local.students.find((r:Student)=>r.id===s.id),r=remote.students.find((r:Student)=>r.id===s.id);
    if(!b||!l||!r)return s;
    const eb=earned(base,s.id),el=earned(local,s.id),er=earned(remote,s.id),em=earned(merged,s.id);
    const overlapXp=el.xp+er.xp-eb.xp-em.xp;
    const overlapCoins=el.coins+er.coins-eb.coins-em.coins;
    const xp=l.xp+r.xp-b.xp-overlapXp;
    const hb=b.highestRewardedLevel??levelInfo(b.xp).level,hl=l.highestRewardedLevel??levelInfo(l.xp).level,hr=r.highestRewardedLevel??levelInfo(r.xp).level;
    const highest=Math.max(hb,hl,hr,levelInfo(xp).level);
    const duplicateLevelCoins=(hl+hr-hb-highest)*LEVEL_COIN_REWARD;
    const coins=l.coins+r.coins-b.coins-overlapCoins-duplicateLevelCoins;
    if(!Number.isFinite(xp)||!Number.isFinite(coins)||xp<0||coins<0)throw Error("التغييرات المتزامنة تتطلب مراجعة الرصيد؛ لم يُصفّر أي رصيد");
    return {...s,xp,coins,weekXp:weekXpOf(s.days),weekCoins:weekCoinsOf(s.days),highestRewardedLevel:highest};
  })};
}
