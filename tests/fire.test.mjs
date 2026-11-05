import {createCrackleBuffer as create} from '../src/audio/dsp.js';
import {SCENES} from '../src/audio/scenes.js';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

assert.equal(SCENES.fire.brown,0,'Fire has no continuous brown bed');
assert.equal(SCENES.fire.white,0,'Fire has no continuous white bed');
assert.equal(SCENES.fire.wind??0,0,'Fire has no wind layer');

const source=await readFile(new URL('../audio/noise-processor.js',import.meta.url),'utf8');
function processor(rate,seed=31) {
 let Type;new Function('AudioWorkletProcessor','registerProcessor','sampleRate',source)(class {},(_,value)=>Type=value,rate);
 return new Type({processorOptions:{seed}});
}
function render(node,size,outputs=3) {
 const data=Array.from({length:outputs},()=>Array.from({length:2},()=>new Float32Array(size)));
 assert.equal(node.process([],data),true);return data;
}
for(const rate of [8000,44100,48000,96000]) {
 const three=processor(rate),two=processor(rate);
 const data=render(three,rate*4),old=render(two,rate*4,2);
 for(let channel=0;channel<2;channel++) {
  assert.deepEqual(data[0][channel],old[0][channel],'Brown signal is independent of crackles');
  assert.deepEqual(data[1][channel],old[1][channel],'White signal is independent of crackles');
 }
 let peak=0,sum=0,active=0,cross=0,leftEnergy=0,rightEnergy=0;
 for(let i=0;i<data[2][0].length;i++) {
  const left=data[2][0][i],right=data[2][1][i];
  assert.ok(Number.isFinite(left)&&Number.isFinite(right));
  peak=Math.max(peak,Math.abs(left),Math.abs(right));sum+=left;
  if(Math.abs(left)>.001)active++;
  cross+=left*right;leftEnergy+=left*left;rightEnergy+=right*right;
 }
 assert.ok(peak>0.03&&peak<=.45,'Crackles are audible pulses with headroom');
 assert.ok(Math.abs(sum/data[2][0].length)<.005,'Crackles have no material DC bias');
 assert.ok(active/data[2][0].length>.02&&active/data[2][0].length<.5,'Texture is sparse');
 assert.ok(Math.abs(cross/Math.sqrt(leftEnergy*rightEnergy))<.15,'Independent stereo events');
 // The fire bed must remain behind the wood events, rather than becoming a fan-like wash.
 for(let channel=0;channel<2;channel++) {
  let bedEnergy=0,eventEnergy=0;
  for(let i=0;i<data[2][channel].length;i++) {
   const bed=SCENES.fire.brown*data[0][channel][i]+SCENES.fire.white*data[1][channel][i];
   bedEnergy+=bed*bed;
   eventEnergy+=(SCENES.fire.crackle*data[2][channel][i])**2;
  }
  assert.ok(bedEnergy<eventEnergy*.15,'Fire is event-led at every supported sample rate');
 }
}
const full=render(processor(48000),4096),node=processor(48000);
const blocks=Array.from({length:32},()=>render(node,128));
for(let channel=0;channel<2;channel++)assert.deepEqual(full[2][channel],Float32Array.from(blocks.flatMap(block=>Array.from(block[2][channel]))),'Crackles continue across block boundaries');

const fallback=create({sampleRate:8000,createBuffer(channels,length){const data=Array.from({length:channels},()=>new Float32Array(length));return{getChannelData:channel=>data[channel]};}});
for(let ch=0;ch<2;ch++) {
 const data=fallback.getChannelData(ch);
 assert.ok(data.every(Number.isFinite));assert.equal(Math.abs(data[0]),0);assert.equal(Math.abs(data.at(-1)),0);
 assert.ok(data.some(value=>Math.abs(value)>.03));assert.ok(data.every(value=>Math.abs(value)<=.45));
}
console.log('PASS: fire bounds, sparsity, stereo, DC, sample rates, block continuity, unchanged base signals and fallback seams');

function verifyWoodDynamics(data,label) {
 const windowSize=80,events=[];let quiet=0,windows=0,run=0;
 // 10 ms energy windows at 8 kHz distinguish short ticks, longer fractures and gaps.
 for(let start=0;start+windowSize<=data.length;start+=windowSize) {
  let energy=0;
  for(let i=start;i<start+windowSize;i++)energy+=data[i]*data[i];
  const rms=Math.sqrt(energy/windowSize);windows++;
  if(rms<.001)quiet++;
  if(rms>.003)run++;
  else if(run){events.push(run);run=0;}
 }
 if(run)events.push(run);
 assert.ok(quiet/windows>.4,label+': clear gaps remain between events');
 assert.ok(events.filter(length=>length<=3).length>=10,label+': short dry ticks remain');
 assert.ok(events.filter(length=>length>=10).length>=5,label+': wood fractures have audible-length tails');
}
const sustained=render(processor(8000),8000*30);
for(const channel of sustained[2])verifyWoodDynamics(channel,'worklet');
const originalRandom=Math.random;let fallbackSeed=93217,seededFallback;
try {
 Math.random=()=>{fallbackSeed^=fallbackSeed<<13;fallbackSeed^=fallbackSeed>>>17;fallbackSeed^=fallbackSeed<<5;return(fallbackSeed>>>0)/4294967296;};
 seededFallback=create({sampleRate:8000,createBuffer(channels,length){
  const data=Array.from({length:channels},()=>new Float32Array(length));
  return{getChannelData:channel=>data[channel]};
 }});
} finally {Math.random=originalRandom;}
for(let channel=0;channel<2;channel++)verifyWoodDynamics(seededFallback.getChannelData(channel),'buffer fallback');
console.log('PASS: event-led fire mix, short ticks, longer wood tails and quiet gaps in both renderers');
