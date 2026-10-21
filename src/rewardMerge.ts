import { weekXpOf, weekCoinsOf, levelInfo, LEVEL_COIN_REWARD, type Student, type WeekLog } from "./core.ts";
import { mergeLocalChanges, type MergeConflict } from "./syncMerge.ts";

function earned(state: any, id: string): {xp:number;coins:number} {
  const s=state.students.find((s:Student)=>s.id===id);
  let xp=weekXpOf(s?.days), coins=weekCoinsOf(s?.days);
  const weeks=new Map<number,WeekLog>((state.weeksLog??[]).filter((w:WeekLog)=>w.week!==state.week).map((w:WeekLog)=>[w.week,w]));
  for(const w of weeks.values()) {
    const r=w.records?.find(r=>r.id===id);
    if(r){xp+=weekXpOf(r.days);coins+=weekCoinsOf(r.days);}
  }
  return {xp,coins};
}

/** Numeric balances are derived, unlike manual adjustments and recorded spending. */
export function mergeAccountingChanges(base:any,local:any,remote:any,path:string[]=[],conflicts:MergeConflict[]=[]):any {
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
