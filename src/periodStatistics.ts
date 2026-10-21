import { uniqueHistory } from "./weekHistory.ts";
export { uniqueHistory } from "./weekHistory.ts";
import { DAYS, ATTEND_XP, ATTEND_COINS, RECITE_XP, RECITE_COINS, type Student, type WeekLog, type WeekStudentRecord, type DayKey } from './core.ts';
import { measureStudentWork } from './analytics.ts';
import { isLearningCompleted } from './learningCompletion.ts';
import { addCalendarDays, dateFromLocalKey, hijriMonthKey, localDateKey } from './hijriDate.ts';

type RecordLike = Student | WeekStudentRecord;
export type PeriodMetrics = ReturnType<typeof emptyPeriodMetrics>;
export const emptyPeriodMetrics = (s: Pick<Student, 'id'|'name'|'photo'|'halaqaId'>) => ({
  id:s.id, name:s.name, photo:s.photo, halaqaId:s.halaqaId,
  present:0, absent:0, memorizationSessions:0, reviewSessions:0,
  memorizationVerses:0, reviewVerses:0, memorizationLines:0, reviewLines:0,
  memorizationPages:0, reviewPages:0, notHeardMem:0, notHeardRev:0, notHeardBoth:0,
  memorizationExcellent:0, memorizationVeryGood:0, reviewExcellent:0, reviewVeryGood:0,
  earnedLearningXp:0, earnedLearningCoins:0, incompleteHistory:0,
});
export function recordMetrics(record: RecordLike, day?: DayKey): PeriodMetrics {
  const out=emptyPeriodMetrics(record);
  for (const {key} of DAYS.filter(d=>!day||d.key===day)) {
    const state=record.days?.[key];
    const present=state?.a===true && state.absent!==true;
    const h=isLearningCompleted(record,key,'h'), r=isLearningCompleted(record,key,'r');
    const exempt=state?.testing===true && !h;
    if(present)out.present++;
    if(state?.absent===true)out.absent++;
    if(present&&!h&&!exempt)out.notHeardMem++;
    if(present&&!r)out.notHeardRev++;
    if(present&&!h&&!exempt&&!r)out.notHeardBoth++;
    for(const part of ['h','r'] as const) {
      if(!isLearningCompleted(record,key,part))continue;
      const kind=part==='h'?'memorization':'review';
      const rating=record.recitationRatings?.[key]?.[part];
      if(rating==='excellent')out[`${kind}Excellent`]++;
      if(rating==='very-good')out[`${kind}VeryGood`]++;
    }
    const units=(h?1:0)+(r?(exempt?2:1):0);
    out.earnedLearningXp+=(present?ATTEND_XP:0)+units*RECITE_XP;
    out.earnedLearningCoins+=(present?ATTEND_COINS:0)+units*RECITE_COINS;
  }
  const mem=measureStudentWork(record as Student,'memorization',day?[day]:undefined);
  const rev=measureStudentWork(record as Student,'review',day?[day]:undefined);
  return {...out,memorizationSessions:mem.sessions,reviewSessions:rev.sessions,
    memorizationVerses:mem.verses,reviewVerses:rev.verses,memorizationLines:mem.lines,reviewLines:rev.lines,
    memorizationPages:mem.pages,reviewPages:rev.pages};
}
export function addPeriodMetrics(a:PeriodMetrics,b:PeriodMetrics):PeriodMetrics {
  const out={...a};
  for(const key of Object.keys(a) as (keyof PeriodMetrics)[]) {
    if(typeof a[key]==='number'&&typeof b[key]==='number') (out as any)[key]=(a[key] as number)+(b[key] as number);
  }
  return out;
}
export type StatisticsPeriod = {kind:'day';date:string}|{kind:'week';week:number}|{kind:'month';month:string}|{kind:'all'};
/** One daily ledger for teacher, parent, group and overall totals. IDs never inferred from names. */
export function studentPeriodMetrics(student:Student,logs:WeekLog[],currentWeek:number,start:string,period:StatisticsPeriod):PeriodMetrics {
  let total=emptyPeriodMetrics(student);
  const seenDates=new Set<string>();
  const sources:[number,string|undefined,RecordLike|undefined][]=[
    [currentWeek,start,student],
    ...uniqueHistory(logs).filter(l=>l.week!==currentWeek).map(l=>[l.week,l.weekStartDateIso,l.records?.find(r=>r.id===student.id)] as [number,string|undefined,RecordLike|undefined])
  ];
  for(const [week,startKey,record]of sources){
    if(period.kind==='week'&&period.week!==week)continue;
    if(!record){
      const log=logs.find(l=>l.week===week);
      if(log&&[...(log.students??[]),...(log.top??[])].some(r=>r.id===student.id))total.incompleteHistory++;
      continue;
    }
    const startDate=startKey?dateFromLocalKey(startKey):null;
    if(!startDate&&(period.kind==='month'||period.kind==='day')){total.incompleteHistory++;continue;}
    for(let i=0;i<DAYS.length;i++){
      const date=startDate?addCalendarDays(startDate,i):null;
      const key=date?localDateKey(date):`week:${week}:${i}`;
      if(seenDates.has(key))continue;
      // Consume overlapping dates before filtering; current week is authoritative.
      seenDates.add(key);
      if(period.kind==='month'&&(!date||hijriMonthKey(date)!==period.month))continue;
      if(period.kind==='day'&&key!==period.date)continue;
      total=addPeriodMetrics(total,recordMetrics(record,DAYS[i].key));
    }
  }
  return total;
}
export function statisticsMonths(start:string,logs:WeekLog[]):[string,Date][] {
  const months=new Map<string,Date>();
  for(const key of [start,...uniqueHistory(logs).map(l=>l.weekStartDateIso)]){
    const date=key?dateFromLocalKey(key):null;if(!date)continue;
    for(let i=0;i<DAYS.length;i++){const d=addCalendarDays(date,i);months.set(hijriMonthKey(d),d);}
  }
  return [...months.entries()].sort((a,b)=>b[1].getTime()-a[1].getTime());
}
