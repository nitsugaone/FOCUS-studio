import {readApplicationSource,extractFunctions} from './support/application-source.mjs';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=await readFile(new URL('../audio/noise-processor.js',import.meta.url),'utf8');
const html=await readApplicationSource();
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
}
const full=render(processor(48000),4096),node=processor(48000);
const blocks=Array.from({length:32},()=>render(node,128));
for(let channel=0;channel<2;channel++)assert.deepEqual(full[2][channel],Float32Array.from(blocks.flatMap(block=>Array.from(block[2][channel]))),'Crackles continue across block boundaries');
const create=new Function(extractFunctions(html,["createCrackleBuffer"])+'return createCrackleBuffer;')();
const fallback=create({sampleRate:8000,createBuffer(channels,length){const data=Array.from({length:channels},()=>new Float32Array(length));return{getChannelData:channel=>data[channel]};}});
for(let ch=0;ch<2;ch++) {
 const data=fallback.getChannelData(ch);
 assert.ok(data.every(Number.isFinite));assert.equal(Math.abs(data[0]),0);assert.equal(Math.abs(data.at(-1)),0);
 assert.ok(data.some(value=>Math.abs(value)>.03));assert.ok(data.every(value=>Math.abs(value)<=.45));
}
console.log('PASS: fire bounds, sparsity, stereo, DC, sample rates, block continuity, unchanged base signals and fallback seams');
