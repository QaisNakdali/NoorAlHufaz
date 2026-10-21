import type { CeremonyPicks, PerHalaqaRewardKey, Student } from './core.ts';
export function pickIds(value:string|string[]|undefined):string[]{
  return [...new Set((Array.isArray(value)?value:[value]).filter((v):v is string=>!!v&&v!=='none'))].slice(0,2);
}
export function ceremonyWinners(picks:CeremonyPicks,reward:PerHalaqaRewardKey,halaqaId:string,students:Student[]):string[]{
  const map=picks[reward==='improved'?'improvedByHalaqa':'behaviorByHalaqa'];
  const value=map&&Object.prototype.hasOwnProperty.call(map,halaqaId)?map[halaqaId]:picks[reward];
  return pickIds(value).filter(id=>students.some(s=>s.id===id&&s.halaqaId===halaqaId));
}
export function updateCeremonyWinner(picks:CeremonyPicks,reward:PerHalaqaRewardKey,halaqaId:string,id:string|null,slot:number,students:Student[]):CeremonyPicks{
  if(slot!==0&&slot!==1)throw Error('خانة جائزة غير صالحة');
  if(id&&!students.some(s=>s.id===id&&s.halaqaId===halaqaId))throw Error('الطالب ليس في هذه الحلقة');
  const ids=ceremonyWinners(picks,reward,halaqaId,students);
  if(id&&ids.some((v,i)=>v===id&&i!==slot))return picks;
  ids[slot]=id??'';
  const mapKey=reward==='improved'?'improvedByHalaqa':'behaviorByHalaqa';
  return {...picks,[mapKey]:{...picks[mapKey],[halaqaId]:pickIds(ids)}};
}
