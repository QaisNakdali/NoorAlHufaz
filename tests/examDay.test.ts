import test from "node:test";
import assert from "node:assert/strict";
import { captureExamDay, toggleExamMode } from "../src/examDay.ts";
import { DAYS, seedStudents, emptyWeekDays, emptyRecitationRatings, weekXpOf, weekCoinsOf, isChampionEligible, calculateStudentTotals, ATTEND_XP, ATTEND_COINS, RECITE_XP, RECITE_COINS } from "../src/core.ts";
const student = () => ({ ...seedStudents()[0], days: emptyWeekDays(), recitationRatings: Object.fromEntries(DAYS.map(d => [d.key, { h: "excellent", r: "excellent" }])), awards:[],coinsSpent:0,manualCoinsAdjust:0,manualXpAdjust:0,isTesting:false });

test("normal and exam review receive the same two learning rewards; attendance is unchanged", () => {
  const normal=student();normal.days.sun={a:true,h:true,r:true};
  const exam=student();exam.days.sun={a:true,h:false,r:true,testing:true};
  assert.equal(weekXpOf(normal.days),ATTEND_XP+2*RECITE_XP);
  assert.equal(weekXpOf(exam.days),weekXpOf(normal.days));
  assert.equal(weekCoinsOf(exam.days),ATTEND_COINS+2*RECITE_COINS);
  assert.equal(weekCoinsOf(exam.days),weekCoinsOf(normal.days));
});
test("exam without completed review receives only attendance", () => {
  const s=student();s.days.sun={a:true,h:false,r:false,testing:true};
  assert.equal(weekXpOf(s.days),ATTEND_XP);assert.equal(weekCoinsOf(s.days),ATTEND_COINS);
  assert.equal(isChampionEligible(s,false,[]),false);
});
test("two exam days exempt only those days; normal days still require memorization", () => {
  const s=student();for(const {key} of DAYS) s.days[key]={a:true,h:true,r:true};
  for(const key of ['sun','mon'] as const) s.days[key]={a:true,h:false,r:true,testing:true};
  assert.equal(isChampionEligible(s,false,[]),true);
  s.days.tue.h=false;assert.equal(isChampionEligible(s,false,[]),false);
});
test("mode changes preserve previous completed day policies and never infer old exemptions", () => {
  const s=student();s.days.sun={a:true,h:true,r:true};
  const on=toggleExamMode(s,'mon');assert.equal(on.days.mon.testing,true);
  on.days.mon={...on.days.mon,a:true,r:true};
  const off=toggleExamMode(on,'tue');assert.equal(off.days.tue.testing,false);
  assert.equal(off.days.mon.testing,true);assert.deepEqual(off.days.sun,s.days.sun);
  const old={...s,isTesting:true};assert.equal(old.days.sun.testing,undefined);
  assert.deepEqual(toggleExamMode(old).days,old.days);
});
test("champion honors both rating settings, hearts, attendance and trip for exam days", () => {
  const s=student();for(const {key} of DAYS) s.days[key]={a:true,h:false,r:true,testing:true};
  s.recitationRatings.mon.r='very-good';
  assert.equal(isChampionEligible(s,false,[],'mixed'),true);
  assert.equal(isChampionEligible(s,false,[],'excellent'),false);
  s.recitationRatings.mon.r='excellent';assert.equal(isChampionEligible(s,false,[],'excellent'),true);
  assert.equal(isChampionEligible(s,true,[]),false);
  assert.equal(isChampionEligible(s,true,[s.id]),true);
  s.heartsLostWeek=1;assert.equal(isChampionEligible(s,false,[]),false);
  s.heartsLostWeek=0;s.days.wed.absent=true;assert.equal(isChampionEligible(s,false,[]),false);
});
test("100 serialization/recalculation replays never duplicate exam rewards", () => {
  let s=student();s.days.sun={a:true,h:false,r:true,testing:true};
  const expected=calculateStudentTotals(s);
  for(let i=0;i<100;i++) {s=JSON.parse(JSON.stringify(s));assert.deepEqual(calculateStudentTotals(s),expected);}
});
test("rating edits preserve rewards; undo/re-record yields one reward", () => {
  const s=student();s.days.sun={a:true,h:false,r:true,testing:true};
  const expected=calculateStudentTotals(s);s.recitationRatings.sun.r='very-good';
  assert.deepEqual(calculateStudentTotals(s),expected);
  s.days.sun.r=false;assert.equal(weekCoinsOf(s.days),ATTEND_COINS);
  s.days.sun.r=true;assert.deepEqual(calculateStudentTotals(s),expected);
});
test("ending exam does not retroactively change a completed day; later memorization cannot create a third reward", () => {
  const s=student();s.isTesting=true;s.days.sun={a:true,h:false,r:true,testing:true};
  const next=toggleExamMode(s,'sun');assert.equal(next.isTesting,false);
  assert.deepEqual(calculateStudentTotals(next),calculateStudentTotals(s));
  next.days.sun={...next.days.sun,h:true};assert.equal(weekXpOf(next.days),ATTEND_XP+2*RECITE_XP);
});
test("capture does not alter existing completed recitations or award balances", () => {
  const e={a:true,h:false,r:true};assert.equal(captureExamDay(e,true),e);
  const s=student();const prior=JSON.stringify(s);toggleExamMode(s,'sun');assert.equal(JSON.stringify(s),prior);
});

