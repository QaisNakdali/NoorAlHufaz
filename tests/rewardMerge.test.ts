import test from 'node:test';import assert from 'node:assert/strict';
import {mergeAccountingChanges} from '../src/rewardMerge.ts';
import {seedStudents,emptyWeekDays,emptyRecitationRatings,levelInfo,LEVEL_COIN_REWARD} from '../src/core.ts';
function state(){return {week:1,weeksLog:[],students:[{...seedStudents()[0],id:'s',xp:200,coins:50,highestRewardedLevel:10,manualCoinsAdjust:0,coinsSpent:25,days:emptyWeekDays(),recitationRatings:emptyRecitationRatings()}]};}
function done(base,day='sun'){const next=structuredClone(base);next.students[0].days[day].h=true;next.students[0].recitationRatings[day].h='excellent';next.students[0].xp+=10;next.students[0].coins+=5;return next;}
test('two teachers completing the same current-day field grant one reward',()=>{
 const base=state(),local=done(base),remote=done(base);const merged=mergeAccountingChanges(base,local,remote);
 assert.equal(merged.students[0].coins,55);assert.equal(merged.students[0].xp,210);assert.equal(merged.students[0].highestRewardedLevel,10);
});
test('shared learning reward remains single when teachers also change different profile fields',()=>{
 const base=state(),local=done(base),remote=done(base);local.students[0].name='edited';remote.students[0].photo='photo';
 local.students[0].manualCoinsAdjust=3;local.students[0].coins+=3;
 const merged=mergeAccountingChanges(base,local,remote);assert.equal(merged.students[0].coins,58);assert.equal(merged.students[0].xp,210);assert.equal(merged.students[0].name,'edited');assert.equal(merged.students[0].photo,'photo');
});
test('different current-day achievements remain additive, and manual coins remain independent',()=>{
 const base=state(),local=done(base,'sun'),remote=done(base,'mon');local.students[0].manualCoinsAdjust+=3;local.students[0].coins+=3;remote.students[0].manualCoinsAdjust+=4;remote.students[0].coins+=4;
 const merged=mergeAccountingChanges(base,local,remote);assert.equal(merged.students[0].coins,67);assert.equal(merged.students[0].xp,220);assert.equal(merged.students[0].manualCoinsAdjust,7);assert.equal(merged.students[0].coinsSpent,25);
});
test('two reversals of the same current achievement withdraw once and do not create a negative balance',()=>{
 const base=done(state());base.students[0].coins=5;const local=structuredClone(base);local.students[0].days.sun.h=false;local.students[0].recitationRatings.sun.h=undefined;local.students[0].xp-=10;local.students[0].coins-=5;
 const merged=mergeAccountingChanges(base,local,structuredClone(local));assert.equal(merged.students[0].coins,0);assert.equal(merged.students[0].xp,200);
});
test('a shared milestone pays its level bonus once even with different profile edits',()=>{
 let threshold=1;while(levelInfo(threshold).level===1)threshold++;
 const base=state();base.students[0].xp=threshold-10;base.students[0].highestRewardedLevel=1;
 const local=done(base),remote=done(base);for(const side of [local,remote]){side.students[0].highestRewardedLevel=2;side.students[0].coins+=LEVEL_COIN_REWARD;}
 local.students[0].name='edited';remote.students[0].photo='photo';
 const merged=mergeAccountingChanges(base,local,remote);assert.equal(merged.students[0].xp,threshold);assert.equal(merged.students[0].highestRewardedLevel,2);assert.equal(merged.students[0].coins,55+LEVEL_COIN_REWARD);
});
test('separate simultaneous reversals cannot silently overdraw the wallet',()=>{
 const base=done(done(state(),'sun'),'mon');base.students[0].coins=5;
 const local=structuredClone(base),remote=structuredClone(base);
 local.students[0].days.sun.h=false;local.students[0].xp-=10;local.students[0].coins-=5;
 remote.students[0].days.mon.h=false;remote.students[0].xp-=10;remote.students[0].coins-=5;
 assert.throws(()=>mergeAccountingChanges(base,local,remote),/مراجعة الرصيد/);assert.equal(base.students[0].coins,5);assert.equal(base.students[0].coinsSpent,25);
});
