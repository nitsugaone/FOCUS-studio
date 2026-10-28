import {readApplicationSource,extractFunctions} from './support/application-source.mjs';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const html=await readApplicationSource();
const {envelope,schedule}=new Function(extractFunctions(html,["entryEnvelope","scheduleSessionEntry"])+'return {envelope:entryEnvelope,schedule:scheduleSessionEntry};')();
for(let elapsed=0;elapsed<=12000;elapsed+=125)assert.equal(envelope(elapsed),Math.min(1,.4+elapsed/20000),'Original curve remains unchanged');
for(const seconds of [0,3,12,30]){
 let previous=0;
 for(let elapsed=0;elapsed<=60000;elapsed+=125){
  const value=envelope(elapsed,seconds);
  assert.ok(value>=.4&&value<=1&&value>=previous);previous=value;
 }
 assert.equal(envelope(seconds*1000,seconds),1);
}
for(const args of [[-1,12],[NaN,12],[0,5],[0,'12'],[0,Infinity]])assert.throws(()=>envelope(...args));
function commands(elapsed,seconds,silent=false,smooth=false){
 const events=[],param={value:.8,cancelScheduledValues(time){events.push(['cancel',time]);},setValueAtTime(value,time){events.push(['set',value,time]);},linearRampToValueAtTime(value,time){events.push(['linear',value,time]);}};
 schedule({currentTime:100},param,elapsed,seconds,silent,smooth);return events;
}
assert.deepEqual(commands(0,12),[['cancel',100],['set',.4,100],['linear',1,112]]);
assert.deepEqual(commands(8000,12),[['cancel',100],['set',.8,100],['linear',1,104]],'Resume uses only the remaining entrance');
assert.deepEqual(commands(12000,12),[['cancel',100],['set',1,100]]);
assert.deepEqual(commands(0,0),[['cancel',100],['set',1,100]]);
assert.deepEqual(commands(0,30,true),[['cancel',100],['set',0,100]],'Silent rests remain silent');
const reset=commands(0,30,false,true);
assert.equal(reset[1][1],.8);assert.equal(reset[2][0],'linear');assert.equal(reset[2][2],100.06);assert.equal(reset.at(-1)[2],130);
assert.ok(reset[2][1]>.4&&reset[2][1]<.402);
console.log('PASS: original entry, selectable durations, monotonic bounds, paused resume, direct mode, silent rests and smooth reset');
