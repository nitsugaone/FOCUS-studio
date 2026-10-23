import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('      function windCoefficients(evolution)'),end=html.indexOf('      function applyScene(',start);
assert.ok(start>=0&&end>start);
const {coefficients,create}=new Function(html.slice(start,end)+'return {coefficients:windCoefficients,create:createWindGust};')();
for(const evolution of [0,1,35,100]) {
 const values=[],c=coefficients(evolution);
 const envelope=second=>c.base+c.slow*Math.sin(second/9)+c.slower*Math.sin(second/23);
 for(let second=0;second<7200;second++) {
  const value=envelope(second);
  assert.ok(Number.isFinite(value)&&value>=0.22-1e-10&&value<=0.82+1e-10,'Gain stays positive and bounded');
  assert.ok(Math.abs(envelope(second+0.5)-value)<0.014,'Ramps have no abrupt jumps');
  values.push(value);
 }
 if(evolution===0)assert.ok(values.every(value=>value===0.52),'Zero evolution keeps a steady breeze');
 else assert.ok(Math.max(...values)-Math.min(...values)>evolution/100*0.4,'Evolution controls variation');
}
for(const value of [-1,101,NaN,Infinity,'35',undefined])assert.throws(()=>coefficients(value));
const oscillators=[],gains=[];
function node(){return {gain:{value:0,cancelScheduledValues(){},setTargetAtTime(value){this.value=value;}},frequency:{value:0},connections:[],connect(target){this.connections.push(target);},start(){this.started=true;}};}
const context={currentTime:0,createGain(){const value=node();gains.push(value);return value;},createOscillator(){const value=node();oscillators.push(value);return value;}};
const input=node(),output=node(),gust=create(context,input,output,100);
assert.equal(input.connections[0],gust.envelope);assert.equal(gust.envelope.connections[0],output);
assert.equal(gust.envelope.gain.value,0.52);
assert.equal(oscillators.length,2);gust.start();
for(let i=0;i<2;i++) {
 assert.equal(oscillators[i].started,true);
 assert.equal(oscillators[i].connections[0],gust.depths[i]);
 assert.equal(gust.depths[i].connections[0],gust.envelope.gain,'Modulation runs in the audio graph');
 assert.equal(oscillators[i].frequency.value,1/(2*Math.PI*(i===0?9:23)));
}
assert.equal(gust.depths[0].gain.value,.18);assert.equal(gust.depths[1].gain.value,.12);
gust.setEvolution(0);assert.equal(gust.depths[0].gain.value,0);assert.equal(gust.depths[1].gain.value,0);
assert.equal(oscillators.length,2,'Changes reuse the same oscillators');
console.log('PASS: wind bounds, audio graph modulation, steady breeze, evolution strength and invalid values');
