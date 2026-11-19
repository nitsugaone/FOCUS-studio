import {readFile} from 'node:fs/promises';

export async function measureBinauralCalibration(page) {
 const paths=['scenes.js','dsp.js','FocusAudioEngine.js'];
 const [scenes,dsp,engine]=await Promise.all(paths.map(path=>readFile(new URL('../../../src/audio/'+path,import.meta.url),'utf8')));
 return page.evaluate(async ({scenes,dsp,engine})=>{
  const urls=[];
  const moduleURL=source=>{
   const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
   urls.push(url);
   return url;
  };
  const Context=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  const rate=16000,frequencies=[180,186];
  try {
   const scenesURL=moduleURL(scenes),dspURL=moduleURL(dsp);
   const engineURL=moduleURL(engine.replace("'./scenes.js'",JSON.stringify(scenesURL)).replace("'./dsp.js'",JSON.stringify(dspURL)));
   const [{SCENES},{FocusAudioEngine}]=await Promise.all([import(scenesURL),import(engineURL)]);

   async function render(scene,withPair) {
    const offline=new Context(2,5*rate,rate);
    // Use the real Web Audio nodes; only adapt the live-only context methods.
    const context=new Proxy(offline,{get(target,key){
     if(key==='state')return 'running';
     if(key==='createMediaStreamDestination')return ()=>target.createGain();
     const value=Reflect.get(target,key,target);
     return typeof value==='function'?value.bind(target):value;
    }});
    const audio=new FocusAudioEngine({platform:{AudioContext:function(){return context;},setTimeout:()=>0},clearTimeout:()=>{}});
    const preset=SCENES[scene],originalGain=preset.binaural,originalRandom=Math.random;
    let seed=642008;
    try {
     if(!withPair)preset.binaural=0;
     Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
     audio.configure({scene,brightness:50,evolution:35,stereoWidth:100,balance:0,fadeInSeconds:0,fadeOutSeconds:20,melody:false},{master:75,...preset.mix});
     await audio.resume();
     audio.start();
    } finally {
     preset.binaural=originalGain;
     Math.random=originalRandom;
    }
    return offline.startRendering();
   }

   function measure(before,after) {
    let baselineEnergy=0,addedEnergy=0,peak=0;
    const channels=[0,1].map(channel=>{
     const baseline=before.getChannelData(channel),mix=after.getChannelData(channel);
     const real=[0,0],imaginary=[0,0];
     // Analyze a two-second window after the startup fade.
     for(let index=3*rate;index<5*rate;index++){
      const sample=mix[index],delta=sample-baseline[index];
      baselineEnergy+=baseline[index]**2;
      addedEnergy+=delta**2;
      peak=Math.max(peak,Math.abs(sample));
      const seconds=(index-3*rate)/rate;
      for(let tone=0;tone<frequencies.length;tone++) {
       const phase=2*Math.PI*frequencies[tone]*seconds;
       real[tone]+=delta*Math.cos(phase);
       imaginary[tone]+=delta*Math.sin(phase);
      }
     }
     return real.map((value,tone)=>Math.hypot(value,imaginary[tone])/rate);
    });
    return {ratio:Math.sqrt(addedEnergy/baselineEnergy),addedRms:Math.sqrt(addedEnergy/(4*rate)),peak,channels};
   }

   const results=[];
   for(const scene of Object.keys(SCENES)) {
    const baseline=await render(scene,false);
    const mixed=await render(scene,true);
    results.push({scene,...measure(baseline,mixed)});
   }
   return results;
  } finally {
   for(const url of urls)URL.revokeObjectURL(url);
  }
 },{scenes,dsp,engine});
}
