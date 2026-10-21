import { DAYS, type Student, type WeekLog, type WeekStudentRecord } from './core.ts';
import { isLearningCompleted } from './learningCompletion.ts';
import { uniqueHistory } from './periodStatistics.ts';
export function excellenceSnapshot(record:Student|WeekStudentRecord){
  let h=0,r=0,opportunities=0,evaluatedDays=0;
  for(const {key}of DAYS){
    const state=record.days?.[key];
    if(state?.a||state?.absent)evaluatedDays++;
    if(state?.a!==true||state.absent===true)continue;
    opportunities+=state.testing===true&&!state.h?1:2;
    if(isLearningCompleted(record,key,'h')&&record.recitationRatings?.[key]?.h==='excellent')h++;
    if(isLearningCompleted(record,key,'r')&&record.recitationRatings?.[key]?.r==='excellent')r++;
  }
  return {h,r,total:h+r,opportunities,evaluatedDays,rate:opportunities?(h+r)/opportunities:null};
}
export function improvementCandidates(students:Student[],logs:WeekLog[],currentWeek:number){
  // Missing immediately previous week is not replaced with an older, unrelated week.
  const previous=uniqueHistory(logs).find(l=>l.week===currentWeek-1);
  return students.map(student=>{
    const before=previous?.records?.find(r=>r.id===student.id);
    const current=excellenceSnapshot(student),past=before?excellenceSnapshot(before):null;
    const delta=past?current.total-past.total:null;
    const rateDelta=past?.rate!==null&&past?.rate!==undefined&&current.rate!==null?current.rate-past.rate:null;
    const eligible=delta!==null&&delta>0&&rateDelta!==null&&rateDelta>0;
    const reason=!past?'لا يوجد سجل تفصيلي للأسبوع السابق؛ لا يُفترض أن مستواه السابق صفر':!past.opportunities||!current.opportunities?'فرص التسميع غير كافية للمقارنة':eligible?'زاد عدد ممتاز وتحسنت نسبته إلى فرص التسميع':'لم يثبت تحسن في العدد والنسبة معًا';
    return {student,current,past,delta,rateDelta,eligible,preliminary:current.evaluatedDays<DAYS.length,reason};
  }).sort((a,b)=>Number(b.eligible)-Number(a.eligible)||(b.rateDelta??-Infinity)-(a.rateDelta??-Infinity)||(b.delta??-Infinity)-(a.delta??-Infinity)||a.student.name.localeCompare(b.student.name,'ar'));
}
