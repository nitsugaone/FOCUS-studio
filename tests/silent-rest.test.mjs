import {isSilentRestState as silent} from '../src/session/cycles.js';
import {ListeningProgress} from '../src/session/ListeningProgress.js';
import assert from 'node:assert/strict';

for(const plan of ['25-5','50-10']){
 assert.equal(silent({plan,phase:'rest'},'silent'),true);
 assert.equal(silent({plan,phase:'focus'},'silent'),false);
 assert.equal(silent({plan,phase:'rest'},'sound'),false);
}
assert.equal(silent({plan:'single',phase:'rest'},'silent'),false);
assert.equal(silent(null,'silent'),false);
function run() {
 const progress=new ListeningProgress(),additions=[];
 const record=(elapsedMs,silent)=>{
  const seconds=progress.advance(elapsedMs,{silent,flush:true});
  if(seconds)additions.push(seconds);
 };
 record(61500,true);
 const silentRecorded=progress.recordedMs;
 record(122500,false);
 record(123000,true);
 return {silentRecorded,sessionRecordedMs:progress.recordedMs,additions};
}
assert.deepEqual(run(),{silentRecorded:61500,sessionRecordedMs:123000,additions:[61]});
console.log('PASS: silent rest classification and history exclusion without retroactive listening');

// Periodic accounting retains fractions; flushes and repeated calls never double-count.
const progress=new ListeningProgress();
assert.equal(progress.advance(4999),0);
assert.equal(progress.recordedMs,0);
assert.equal(progress.advance(5500),5);
assert.equal(progress.recordedMs,5000);
assert.equal(progress.advance(5999,{flush:true}),0);
assert.equal(progress.advance(6500,{flush:true}),1);
assert.equal(progress.recordedMs,6000);
assert.equal(progress.advance(6500,{flush:true}),0);
assert.equal(progress.advance(5000,{flush:true}),0);
assert.equal(progress.recordedMs,6000);

// Restored progress is already recorded; a new session starts its own accounting.
progress.checkpoint(123500);
assert.equal(progress.advance(124499,{flush:true}),0);
assert.equal(progress.advance(124500,{flush:true}),1);
progress.checkpoint();
assert.equal(progress.recordedMs,0);
assert.equal(progress.advance(5000),5);

// Silent time and its fractional remainder must never be charged retroactively.
assert.equal(progress.advance(10600,{silent:true}),0);
assert.equal(progress.recordedMs,10600);
assert.equal(progress.advance(11599,{flush:true}),0);
assert.equal(progress.advance(11600,{flush:true}),1);
assert.equal(progress.recordedMs,11600);
