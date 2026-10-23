import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('      function windEnvelope(seconds,evolution)'),end=html.indexOf('      function applyScene(',start);
assert.ok(start>=0&&end>start);
const envelope=new Function(html.slice(start,end)+'return windEnvelope;')();
for(const evolution of [0,1,35,100]) {
 const values=[];
 for(let second=0;second<7200;second++) {
  const value=envelope(second,evolution);
  assert.ok(Number.isFinite(value)&&value>=0.22-1e-10&&value<=0.82+1e-10,'Gain stays positive and bounded');
  assert.ok(Math.abs(envelope(second+0.5,evolution)-value)<0.014,'Ramps have no abrupt jumps');
  values.push(value);
 }
 if(evolution===0)assert.ok(values.every(value=>value===0.52),'Zero evolution keeps a steady breeze');
 else assert.ok(Math.max(...values)-Math.min(...values)>evolution/100*0.4,'Evolution controls audible variation');
}
for(const args of [[-1,35],[Infinity,35],[NaN,35],[0,-1],[0,101],[0,NaN],[0,'35']])assert.throws(()=>envelope(...args));
console.log('PASS: wind envelope bounds, half-second continuity, stable breeze, evolution strength and invalid values');
