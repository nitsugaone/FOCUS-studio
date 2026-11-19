import {FocusAudioEngine} from '../src/audio/FocusAudioEngine.js';
import {SCENES} from '../src/audio/scenes.js';

const scene=document.querySelector('#scene');
const play=document.querySelector('#play');
const status=document.querySelector('#status');
const variants=document.querySelectorAll('input[name="version"]');
const enabled=crypto.getRandomValues(new Uint8Array(1))[0]%2===0?'A':'B';
const levels=Object.fromEntries(Object.entries(SCENES).map(([name,preset])=>[name,preset.binaural]));
const engine=new FocusAudioEngine({platform:window});
let active=false;

document.querySelector('#answer').textContent='La versión '+enabled+' añade la capa de 180/186 Hz. La otra reproduce el ambiente solo.';

function syncMix(refreshLevels=false) {
 const name=scene.value;
 const preset=SCENES[name];
 const mix={master:75,...preset.mix};
 const selected=document.querySelector('input[name="version"]:checked').value;
 // This page has its own module instances. The regular player keeps its original presets.
 preset.binaural=selected===enabled?levels[name]:0;
 engine.configure(
  {scene:name,evolution:35,brightness:50,melody:preset.melody!==false,stereoWidth:100,balance:0,
   notePace:'normal',fadeOutSeconds:20,fadeInSeconds:12},
  mix
 );
 if(refreshLevels&&engine.initialized()){
  for(const [layer,value] of Object.entries(mix))engine.updateLevel(layer,value);
 }
 engine.applyScene(0.12);
}

scene.addEventListener('change',()=>{
 syncMix(true);
 engine.resetNotes();
 engine.restartNotes();
});

for(const radio of variants)radio.addEventListener('change',()=>syncMix());

function showPlayback() {
 play.textContent=active?'Pausar':'Reproducir';
 status.textContent=active?'En reproducción.':'En pausa.';
}

play.addEventListener('click',async()=>{
 play.disabled=true;
 try {
  if(active)engine.pause();
  else {
   syncMix(true);
   await engine.resume();
   engine.start();
  }
  active=!active;
  showPlayback();
 } catch {
  status.textContent='No se pudo iniciar el audio. Recargá la página y volvé a intentar.';
 } finally {
  play.disabled=false;
 }
});

showPlayback();
play.disabled=false;
