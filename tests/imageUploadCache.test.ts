import test from "node:test";
import assert from "node:assert/strict";
import { cacheImageUploads } from "../src/imageUploadCache.ts";
import { externalizeDataImages } from "../src/cloudPayload.ts";
test("100 saves and concurrent saves reuse one successful image upload",async()=>{
  let calls=0;const upload=cacheImageUploads(async()=>{calls++;return 'https://example.test/image.webp';});
  await Promise.all(Array.from({length:10},()=>externalizeDataImages({photo:'data:image/webp;base64,abc'},upload)));
  for(let i=0;i<100;i++) await externalizeDataImages({photo:'data:image/webp;base64,abc'},upload);
  assert.equal(calls,1);
});
test("failed upload preserves the original and retries on the next save",async()=>{
  let calls=0;const upload=cacheImageUploads(async()=>{if(++calls===1) throw Error('offline');return 'https://example.test/image.webp';});
  const original={photo:'data:image/webp;base64,abc',id:'old'};
  assert.deepEqual(await externalizeDataImages(original,upload),original);
  assert.equal((await externalizeDataImages(original,upload) as typeof original).photo,'https://example.test/image.webp');assert.equal(calls,2);
});
test("cache is bounded and eviction never changes an image",async()=>{
  let calls=0;const upload=cacheImageUploads(async data=>{calls++;return 'https://example.test/'+data;},3);
  await upload('abc');await upload('def');await upload('abc');assert.equal(calls,3);
});
