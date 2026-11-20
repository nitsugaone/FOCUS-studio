import {expect} from '@playwright/test';

export async function checkListeningPage(page,{build=false}={}) {
 if(build) {
  const response=await page.goto('./escucha/');
  expect(response?.status()).toBe(404);
  return;
 }

 await page.addInitScript(()=>{
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context)return;
  const tones=[],contexts=new Set(),connections=new WeakMap(),targets=new WeakMap();

  const connect=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(destination,...args) {
   const result=connect.call(this,destination,...args);
   const edges=connections.get(this)||[];
   edges.push(destination);
   connections.set(this,edges);
   return result;
  };
  const setTargetAtTime=AudioParam.prototype.setTargetAtTime;
  AudioParam.prototype.setTargetAtTime=function(value,...args) {
   const result=setTargetAtTime.call(this,value,...args);
   targets.set(this,value);
   return result;
  };
  const createOscillator=Context.prototype.createOscillator;
  Context.prototype.createOscillator=function(...args) {
   const oscillator=createOscillator.apply(this,args),start=oscillator.start;
   contexts.add(this);
   oscillator.start=function(...args) {
    const frequency=this.frequency.value;
    const result=start.apply(this,args);
    if(this.type==='sine'&&(frequency===180||frequency===186))tones.push({frequency,oscillator:this});
    return result;
   };
   return oscillator;
  };

  window.readListeningPair=()=>{
   const outputOf=node=>connections.get(node)?.[0];
   const gains=tones.map(({oscillator})=>outputOf(outputOf(oscillator))?.gain);
   // Use the scheduled value so the assertion does not depend on real time.
   const gain=gains.length===2&&gains[0]&&gains[0]===gains[1]?targets.get(gains[0]):null;
   return {frequencies:tones.map(({frequency})=>frequency).sort((a,b)=>a-b),contexts:contexts.size,gain};
  };
 });

 const response=await page.goto('./escucha/');
 expect(response?.status()).toBe(200);
 const scene=page.getByLabel('Ambiente'),play=page.locator('#play'),status=page.getByRole('status');
 const version=name=>page.getByRole('radio',{name,exact:true});

 await expect(play).toBeEnabled();
 await expect(play).toHaveText('Reproducir');
 await expect(status).toHaveText('En pausa.');
 await scene.selectOption('fire');
 await play.click();
 await expect(play).toHaveText('Pausar');
 await expect(status).toHaveText('En reproducción.');

 async function readGain(ambience,name) {
  await version(name).check();
  const graph=await page.evaluate(()=>window.readListeningPair());
  const label=ambience+' / '+name;
  expect(graph.frequencies,label).toEqual([180,186]);
  expect(graph.contexts,label).toBe(1);
  expect(Number.isFinite(graph.gain),label).toBe(true);
  return graph.gain;
 }

 for(const ambience of ['fire','rain','ocean','space','speech','wind']) {
  await scene.selectOption(ambience);
  const a=await readGain(ambience,'A'),b=await readGain(ambience,'B');
  expect(Math.min(a,b),ambience).toBe(0);
  expect(Math.max(a,b),ambience).toBeGreaterThan(0);
  await expect(status).toHaveText('En reproducción.');
 }

 await play.click();
 await expect(play).toHaveText('Reproducir');
 await expect(status).toHaveText('En pausa.');
 await scene.selectOption('fire');
 await readGain('paused fire','A');
 await expect(status).toHaveText('En pausa.');
 await play.click();
 await expect(status).toHaveText('En reproducción.');
 await readGain('resumed fire','B');
 await play.click();
 await expect(status).toHaveText('En pausa.');
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
}
