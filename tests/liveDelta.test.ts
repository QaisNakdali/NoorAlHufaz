import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLiveDelta } from '../src/liveDelta.ts';
test('live changes apply to exact server base, leaving unsaved local state untouched', () => {
  const base = {rev: 1, data: {students:[{coins:100}],orders:[{id:'old'}]}};
  const patch = [{op:'set' as const,path:['students','0','coins'],value:95},{op:'insert' as const,path:['orders','0'],value:{id:'new'}}];
  const next = applyLiveDelta(base,{baseRev:1,rev:2,patch});
  assert.deepEqual(next,{rev:2,data:{students:[{coins:95}],orders:[{id:'new'},{id:'old'}]}});
  assert.equal(base.data.students[0].coins,100);
  assert.equal(applyLiveDelta(next,{baseRev:1,rev:2,patch}),next);
});
test('missing, out of order or oversized events request a fresh snapshot', () => {
  const base = {rev:1,data:{x:1}};
  assert.equal(applyLiveDelta(base,{baseRev:2,rev:3,patch:[]}),null);
  assert.equal(applyLiveDelta(base,{baseRev:1,rev:2}),null);
  assert.equal(applyLiveDelta(null,{baseRev:1,rev:2,patch:[]}),null);
});
test('invalid paths and prototype pollution are rejected without changing the base', () => {
  const base = {rev:1,data:{x:1}};
  for (const path of [['__proto__','polluted'],['missing','x'],['constructor','prototype']]) {
    assert.equal(applyLiveDelta(base,{baseRev:1,rev:2,patch:[{op:'set',path,value:true}]}),null);
  }
  assert.deepEqual(base.data,{x:1});
  assert.equal(({} as any).polluted,undefined);
});
