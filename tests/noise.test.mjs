import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
let Processor;
const source=await readFile(new URL('../audio/noise-processor.js',import.meta.url),'utf8');
new Function('AudioWorkletProcessor','registerProcessor','sampleRate',source)(class {},(_,type)=>Processor=type,48000);
const render=(processor,size)=>{
 const outputs=Array.from({length:2},()=>Array.from({length:2},()=>new Float32Array(size)));
 assert.equal(processor.process([],outputs),true);return outputs;
};
const processor=new Processor({processorOptions:{seed:137}});
let peak=0,whitePeak=0,sum=0,cross=0,energyL=0,energyR=0,first,later;
for(let frame=0;frame<8000;frame++) {
 const out=render(processor,128),left=out[0][0],right=out[0][1];
 if(frame===0)first=left.slice();
 if(frame===6000)later=left.slice(); // 16 seconds at 48 kHz.
 for(let i=0;i<128;i++) {
  assert.ok(Number.isFinite(left[i])&&Number.isFinite(right[i])&&Number.isFinite(out[1][0][i]));
  peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));
  whitePeak=Math.max(whitePeak,Math.abs(out[1][0][i]));
  sum+=left[i];cross+=left[i]*right[i];energyL+=left[i]**2;energyR+=right[i]**2;
 }
}
assert.ok(peak<1,'Brown noise has digital headroom');
assert.ok(whitePeak<=0.381,'White noise stays within its gain bound');
assert.ok(Math.abs(sum/1024000)<0.02,'No material DC bias');
assert.ok(Math.abs(cross/Math.sqrt(energyL*energyR))<0.1,'Stereo channels are independent');
assert.notDeepEqual(first,later,'No repeated 16-second buffer');
const a=new Processor({processorOptions:{seed:7}}),b=new Processor({processorOptions:{seed:7}});
const full=render(a,512);
const chunks=Array.from({length:4},()=>render(b,128));
for(let output=0;output<2;output++)for(let ch=0;ch<2;ch++) {
 assert.deepEqual(full[output][ch],Float32Array.from(chunks.flatMap(block=>Array.from(block[output][ch]))),'Signal is continuous across processing blocks');
}
for(const rate of [44100,96000]) {
 let Other;
 new Function('AudioWorkletProcessor','registerProcessor','sampleRate',source)(class {},(_,type)=>Other=type,rate);
 assert.ok(render(new Other({processorOptions:{seed:7}}),128)[0][0].every(Number.isFinite));
}
console.log('PASS: continuous noise, levels, DC, stereo, block continuity and sample rates');
