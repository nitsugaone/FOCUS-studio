import {readApplicationSource,extractFunctions} from './support/application-source.mjs';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const html=await readApplicationSource();
const envelope=new Function(extractFunctions(html,["sessionEnvelope","scheduleSessionClosing"])+'return sessionEnvelope;')();
for(const duration of [1,5,25,50,180])for(const elapsed of [0,1000,12000,30000,duration*60000-1000,duration*60000,duration*60000+1000]){
 const result=envelope(elapsed,duration,20);
 assert.equal(result.entry,Math.min(1,.4+elapsed/20000));
 assert.equal(result.exit,Math.min(1,Math.max(0,(duration*60000-elapsed)/20000)),'Default matches the prior envelope');
}
assert.equal(envelope(120000,3,60).exit,1);
assert.equal(envelope(150000,3,60).exit,.5);
assert.equal(envelope(180000,3,60).exit,0);
assert.equal(envelope(30000,1,60).effectiveFade,30);
assert.equal(envelope(30000,1,60).exit,1);
assert.equal(envelope(45000,1,60).exit,.5);
assert.equal(envelope(60000,1,60).exit,0);
for(const fade of [5,20,60]){
 assert.equal(envelope(1000000,0,fade).exit,1,'Free mode has no automatic closing');
 let previous=1;
 for(let elapsed=0;elapsed<=180000;elapsed+=1000){
  const {entry,exit}=envelope(elapsed,3,fade);
  assert.ok(entry>=.4&&entry<=1&&exit>=0&&exit<=previous);
  previous=exit;
 }
}
for(const args of [[-1,3,20],[0,-1,20],[0,1.5,20],[0,181,20],[0,3,10],[0,3,'20'],[NaN,3,20]])assert.throws(()=>envelope(...args));
console.log('PASS: original envelope, selectable closing, short-phase limit, free mode and invalid values');
