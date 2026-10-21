import type {WeekLog} from './core.ts';
/** Prefer the most recent snapshot for a duplicated week, without changing stored data. */
export function uniqueHistory(logs:WeekLog[]):WeekLog[]{
  const map=new Map<number,WeekLog>();
  for(const log of logs){const previous=map.get(log.week);if(!previous||(Date.parse(log.savedAtIso??'')||0)>(Date.parse(previous.savedAtIso??'')||0))map.set(log.week,log);}
  return [...map.values()].sort((a,b)=>b.week-a.week);
}
