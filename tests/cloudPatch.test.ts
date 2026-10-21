import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCloudPatch } from '../src/cloudPatch.ts';
test('checkout delta does not transmit other students, photos or old orders',()=>{
  const photo='data:image/png;base64,'+'x'.repeat(100000);
  const oldOrders=Array.from({length:1000},(_,i)=>({id:String(i),itemImage:photo}));
  const student={id:'a',coins:100,photo};
  const before={students:[student,{id:'b',coins:200,photo}],orders:oldOrders,archive:{weeks:[photo]}};
  const after={...before,students:[{...student,coins:95},before.students[1]],orders:[{id:'new',price:5},...oldOrders]};
  const ops=buildCloudPatch(before,after);
  assert.deepEqual(ops,[{op:'set',path:['students','0','coins'],value:95},{op:'insert',path:['orders','0'],value:{id:'new',price:5}}]);
  assert(JSON.stringify(ops).length<300);
});
test('delta includes pending edits and respects undefined JSON fields',()=>{
  const before={students:[{id:'s',coins:1}],other:{name:'before',optional:1}};
  const after={students:[{id:'s',coins:2}],other:{name:'after',optional:undefined},newField:{nested:1}};
  assert.deepEqual(buildCloudPatch(before,after),[
    {op:'set',path:['students','0','coins'],value:2},
    {op:'remove',path:['other','optional']},
    {op:'set',path:['other','name'],value:'after'},
    {op:'set',path:['newField'],value:{nested:1}},
  ]);
});

test('normalized optional fields absent from JSON are not repeatedly removed',()=>{
  const before={students:[{id:'s',createdAt:undefined,days:{sun:{date:undefined}},guardianPhone:'123'}]};
  const after=structuredClone(before);after.students[0].guardianPhone='456';
  assert.deepEqual(buildCloudPatch(before,after),[{op:'set',path:['students','0','guardianPhone'],value:'456'}]);
  assert.deepEqual(buildCloudPatch(before,structuredClone(before)),[]);
});

test('clearing an existing optional field still removes it once',()=>{
  const before={optional:'saved'};const after={optional:undefined};
  assert.deepEqual(buildCloudPatch(before,after),[{op:'remove',path:['optional']}]);
  assert.deepEqual(buildCloudPatch(after,{}),[]);
});

test('prepending an archive with cloned unchanged history only transmits the new week',()=>{
  const before={weeksLog:[{week:6,records:[{id:'s',image:'old-image',optional:undefined}]}]};
  const after={weeksLog:[{week:7,records:[]},...structuredClone(before.weeksLog)]};
  assert.deepEqual(buildCloudPatch(before,after),[{op:'insert',path:['weeksLog','0'],value:{week:7,records:[]}}]);
});
