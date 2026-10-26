import {StorageService} from '../storage/StorageService.js';
import {createCycleTools,isSilentRestState,sessionExtension} from '../session/cycles.js';

export function startFocusApp({
  window=globalThis.window,document=globalThis.document,navigator=globalThis.navigator,
  localStorage=globalThis.localStorage,Option=globalThis.Option,
  clearTimeout=globalThis.clearTimeout,clearInterval=globalThis.clearInterval,
  URL=globalThis.URL,Blob=globalThis.Blob
}={}) {


      // Escala pentatónica menor de La extendida (A2 a E4) para mayor riqueza sin disonancia
      const SCALE = [164.81, 220.00, 261.63, 293.66, 329.63, 392.00, 440.00];
      const TRIM = { master: 0.9, noise: 0.42, drone: 0.34, notes: 0.28 };
      const DEFAULTS = { master: 75, noise: 70, drone: 60, notes: 55 };
      const PRESETS = {
        balanced: { master: 75, noise: 70, drone: 60, notes: 55 },
        noise:    { master: 72, noise: 92, drone: 24, notes: 8 },
        minimal:  { master: 65, noise: 45, drone: 38, notes: 20 }
      };

      const $ = (id) => document.getElementById(id);
      const btn = $('toggle');
      const playerCard = $('player-card');
      const statusPill = $('status-pill');
      const statusText = $('status-text');
      const playLabel = $('play-label');
      const playIcon = $('play-icon');
      const timerEl = $('timer');
      const modeLabelEl = $('session-mode-label');
      const errorEl = $('error-message');

      let ctx = null;
      let nodes = {};
      let playing = false;
      let transitioning = false;
      let muted = false;
      let preMuteMaster = 75;
      let noteTimer = null;
      let suspendTimer = null;
      let elapsedTimer = null;
      let wakeLock = null;

      // Reloj de alta precisión basado en timestamps reales (inmune a background tab throttling)
      let accumulatedMs = 0;
      let lastTickTimestamp = 0;
      let targetDurationMinutes = 0; // 0 = Modo libre





      function createShareTools() {
        const cycles=createCycleTools(),scenes=['rain','ocean','space','speech','fire','wind'];
        const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
        const number=value=>Number.isFinite(value)&&value>=0&&value<=100;
        function normalize(value) {
          if(!object(value)||value.v!==1||!scenes.includes(value.scene)||!number(value.evolution)||!number(value.brightness)||typeof value.melody!=='boolean'||(value.stereoWidth!==undefined&&!number(value.stereoWidth))||(value.balance!==undefined&&(!Number.isInteger(value.balance)||value.balance<-100||value.balance>100))||!(value.notePace===undefined||['sparse','normal','frequent'].includes(value.notePace))||!(value.fadeInSeconds===undefined||[0,3,12,30].includes(value.fadeInSeconds))||!(value.fadeOutSeconds===undefined||[5,20,60].includes(value.fadeOutSeconds))||!(value.preserveMix===undefined||typeof value.preserveMix==='boolean')||!(value.restSound===undefined||['sound','silent'].includes(value.restSound))||!Object.prototype.hasOwnProperty.call(cycles.plans,value.cyclePlan)||!object(value.levels)||!['master','noise','drone','notes'].every(key=>number(value.levels[key])))throw Error('Enlace de mezcla inválido.');
          if(value.cyclePlan==='single'?!cycles.validDuration(value.duration):cycles.plans[value.cyclePlan].focus!==value.duration)throw Error('Duración de mezcla inválida.');
          return {v:1,scene:value.scene,evolution:value.evolution,brightness:value.brightness,melody:value.melody,stereoWidth:value.stereoWidth??100,balance:value.balance??0,notePace:value.notePace??'normal',fadeOutSeconds:value.fadeOutSeconds??20,fadeInSeconds:value.fadeInSeconds??12,preserveMix:value.preserveMix??false,restSound:value.restSound??'sound',cyclePlan:value.cyclePlan,duration:value.duration,
            levels:Object.fromEntries(['master','noise','drone','notes'].map(key=>[key,value.levels[key]]))};
        }
        function encode(mix) {return '#mix='+encodeURIComponent(JSON.stringify(normalize({...mix,v:1})));}
        function decode(hash) {
          if(typeof hash!=='string'||!hash.startsWith('#mix=')||hash.length>4096)throw Error('Enlace de mezcla inválido.');
          return normalize(JSON.parse(decodeURIComponent(hash.slice(5))));
        }
        return {normalize,encode,decode};
      }

      const cycleTools=createCycleTools();
      let cycleState=cycleTools.initial();
      const shareTools=createShareTools();
      let pendingSharedMix=null;
      let lastNote = -1;
      let noteStep = 0;


      const SCENES = {
        rain: { label:'Lluvia cálida', description:'Lluvia filtrada, fondo cálido y notas suaves.', cutoff:1900, root:65.406, rate:0.023, depth:70, white:0.65, interval:12, mix:{noise:75,drone:22,notes:18} },
        ocean: { label:'Océano profundo', description:'Ruido grave que respira lentamente como el oleaje.', cutoff:420, root:49, rate:0.065, depth:180, white:0.12, interval:18, mix:{noise:82,drone:35,notes:10} },
        space: { label:'Espacio', description:'Drone abierto y campanas sobre una armonía compartida.', cutoff:650, root:55, rate:0.014, depth:100, white:0.04, interval:8, mix:{noise:30,drone:65,notes:48} },
        wind: { label:'Viento entre hojas', description:'Brisa aireada con ráfagas lentas y susurro de hojas, sin melodía por defecto. Evolución regula las ráfagas.', cutoff:380, root:49, rate:0.02, depth:30, white:0, brown:0.18, wind:0.85, melody:false, interval:24, mix:{noise:70,drone:0,notes:0} },
        fire: { label:'Fogón suave', description:'Fondo grave con crepitaciones suaves e irregulares, sin melodía por defecto.', cutoff:900, root:49, rate:0.018, depth:35, white:0.06, crackle:0.55, melody:false, interval:22, mix:{noise:68,drone:0,notes:0} },
        speech: { melody:false, label:'Cubrir conversaciones', description:'Textura continua más amplia, sin melodía por defecto. Ajustá a un volumen cómodo.', cutoff:2600, root:55, rate:0.01, depth:0, white:0.85, interval:25, mix:{noise:82,drone:0,notes:0} }
      };
      const STUDIO_KEY = 'focus-studio-v3';
      let studio = {scene:'rain',evolution:35,brightness:50,melody:true,stereoWidth:100,balance:0,notePace:'normal',fadeOutSeconds:20,fadeInSeconds:12,preserveMix:false,restSound:'sound'};
      let savedMixes = [];
      let mixDeletionUndo = null;
      let feedbackSession = null;
      const storage=new StorageService(localStorage);
      function readLocal(key,fallback) { return storage.read(key,fallback); }
      function writeLocal(key,value) {
        const saved=storage.write(key,value);
        if(!saved)$('studio-status').textContent='No se pudo guardar en este dispositivo.';
        return saved;
      }
      function validStudio(value) {
        return value && SCENES[value.scene] && Number.isFinite(value.evolution) && value.evolution >= 0 && value.evolution <= 100
          && Number.isFinite(value.brightness) && value.brightness >= 0 && value.brightness <= 100 && typeof value.melody === 'boolean'
          && (value.stereoWidth===undefined||(Number.isFinite(value.stereoWidth)&&value.stereoWidth>=0&&value.stereoWidth<=100))
          && (value.balance===undefined||(Number.isInteger(value.balance)&&value.balance>=-100&&value.balance<=100))
          && (value.notePace===undefined||['sparse','normal','frequent'].includes(value.notePace))
          && (value.fadeInSeconds===undefined||[0,3,12,30].includes(value.fadeInSeconds))
          && (value.fadeOutSeconds===undefined||[5,20,60].includes(value.fadeOutSeconds))
          && (value.preserveMix===undefined||typeof value.preserveMix==='boolean')
          && (value.restSound===undefined||['sound','silent'].includes(value.restSound));
      }

      function entryEnvelope(elapsedMs,seconds=12) {
        if(!Number.isFinite(elapsedMs)||elapsedMs<0||![0,3,12,30].includes(seconds))throw Error('Entrada de sesión inválida.');
        return seconds===0?1:Math.min(1,0.4+elapsedMs/(seconds/0.6*1000));
      }
      function scheduleSessionEntry(context,param,elapsedMs,seconds=12,silent=false,smooth=false) {
        const value=entryEnvelope(elapsedMs,seconds),now=context.currentTime;
        const remaining=Math.max(0,seconds-elapsedMs/1000);
        const transition=smooth&&!silent?Math.min(0.06,remaining||0.06):0;
        const initial=transition?param.value:(silent?0:value);
        param.cancelScheduledValues(now);
        param.setValueAtTime(initial,now);
        if(transition)param.linearRampToValueAtTime(entryEnvelope(elapsedMs+transition*1000,seconds),now+transition);
        if(!silent&&remaining>transition)param.linearRampToValueAtTime(1,now+remaining);
      }
      function syncEntryUI() {
        $('fade-in').value=String(studio.fadeInSeconds);
        $('fade-in').disabled=playing||transitioning;
        $('fade-in-hint').textContent=(studio.fadeInSeconds?'Alcanza el volumen elegido en '+studio.fadeInSeconds+' segundos al iniciar el tramo.':'Sin entrada gradual adicional.')+(playing||transitioning?' Pausá para cambiarla.':' Se conserva al pausar y continuar.');
      }

      function sessionEnvelope(elapsedMs,durationMinutes,fadeOutSeconds=20) {
        if(!Number.isFinite(elapsedMs)||elapsedMs<0||!Number.isInteger(durationMinutes)||durationMinutes<0||durationMinutes>180||![5,20,60].includes(fadeOutSeconds))throw Error('Cierre de sesión inválido.');
        const entry=Math.min(1,0.4+elapsedMs/20000);
        const effectiveFade=durationMinutes?Math.min(fadeOutSeconds,durationMinutes*30):0;
        const exit=durationMinutes?Math.min(1,Math.max(0,(durationMinutes*60000-elapsedMs)/(effectiveFade*1000))):1;
        return {entry,exit,effectiveFade};
      }
      function scheduleSessionClosing(context,param,elapsedMs,durationMinutes,fadeOutSeconds=20,silent=false,smooth=false) {
        const {exit,effectiveFade}=sessionEnvelope(elapsedMs,durationMinutes,fadeOutSeconds);
        const now=context.currentTime;
        const remaining=durationMinutes?Math.max(0,durationMinutes*60-elapsedMs/1000):0;
        const initial=smooth&&!silent&&(!durationMinutes||remaining-effectiveFade>0.06)?param.value:null;
        param.cancelScheduledValues(now);
        param.setValueAtTime(initial??(silent?0:exit),now);
        if(initial!==null)param.linearRampToValueAtTime(exit,now+0.06);
        if(!silent&&durationMinutes&&remaining>0) {
          if(remaining>effectiveFade)param.setValueAtTime(1,now+remaining-effectiveFade);
          param.linearRampToValueAtTime(0,now+remaining);
        }
      }
      function syncFadeUI() {
        $('fade-out').value=String(studio.fadeOutSeconds);
        $('fade-out').disabled=playing||transitioning||targetDurationMinutes===0;
        const seconds=targetDurationMinutes?Math.min(studio.fadeOutSeconds,targetDurationMinutes*30):0;
        $('fade-out-hint').textContent=!targetDurationMinutes?'Disponible en sesiones con duración y en ciclos. Se conserva tu elección.':'El volumen baja en los últimos '+seconds+' segundos del tramo.'+(seconds<studio.fadeOutSeconds?' El cierre se limita a la mitad de este tramo.':'')+(playing||transitioning?' Pausá para cambiarlo.':'');
      }



      function isSilentRest() {return isSilentRestState(cycleState,studio.restSound);}
      function syncSceneLabels() {
        const label=isSilentRest()?'Descanso en silencio':SCENES[studio.scene].label;
        $('mobile-scene').textContent=label;$('focus-view-scene').textContent=label;
      }
      function syncRestSoundUI() {
        $('rest-sound-setting').hidden=cycleState.plan==='single';
        $('rest-sound').value=studio.restSound;
        $('rest-sound').disabled=playing||transitioning||cycleState.plan==='single';
      }

      function syncStudio() {
        syncEntryUI();
        syncRestSoundUI();
        syncFadeUI();
        $('soundscape').value=studio.scene; $('evolution').value=studio.evolution;
        $('brightness').value=studio.brightness; $('melody').checked=studio.melody;
        $('preserve-mix').checked=studio.preserveMix;
        $('note-pace').value=studio.notePace;$('note-pace').disabled=!studio.melody;
        $('note-pace-hint').textContent=studio.melody?'Cambia cuándo aparecen nuevas notas, sin modificar su volumen.':'Activá Incluir melodía para escuchar notas. Se conserva el ritmo elegido.';
        $('evolution-value').textContent=studio.evolution+'%';
        $('stereo-width').value=studio.stereoWidth;$('stereo-width-value').textContent=studio.stereoWidth+'%';
        $('channel-balance').value=studio.balance;
        $('channel-balance-value').textContent=balanceLabel(studio.balance);
        $('channel-balance').setAttribute('aria-valuetext',balanceLabel(studio.balance));
        $('scene-description').textContent=SCENES[studio.scene].description;
        syncSceneLabels();
      }
      function windCoefficients(evolution) {
        if(!Number.isFinite(evolution)||evolution<0||evolution>100)throw Error('Ráfagas inválidas.');
        return {base:0.52,slow:0.18*evolution/100,slower:0.12*evolution/100};
      }
      function createWindGust(context,input,output,evolution=35) {
        const envelope=context.createGain();envelope.gain.value=0.52;
        const oscillators=[context.createOscillator(),context.createOscillator()];
        const depths=[context.createGain(),context.createGain()];
        input.connect(envelope);envelope.connect(output);
        oscillators.forEach((osc,index)=>{
          osc.type='sine';osc.frequency.value=1/(2*Math.PI*(index===0?9:23));
          osc.connect(depths[index]);depths[index].connect(envelope.gain);
        });
        let current=null;
        function setEvolution(value) {
          const coefficients=windCoefficients(value);if(value===current)return;
          const first=current===null;current=value;
          depths.forEach((node,index)=>{
            const target=index===0?coefficients.slow:coefficients.slower;
            if(first)node.gain.value=target;
            else {node.gain.cancelScheduledValues(context.currentTime);node.gain.setTargetAtTime(target,context.currentTime,0.5);}
          });
        }
        setEvolution(evolution);
        return {envelope,oscillators,depths,setEvolution,start(){oscillators.forEach(osc=>osc.start());}};
      }
      function applyScene(smooth=1.5) {
        syncStudio();
        if (!ctx || !nodes.textureGain) return;
        nodes.stereoField?.setWidth(studio.stereoWidth);
        nodes.channelBalance?.setBalance(studio.balance);
        const scene=SCENES[studio.scene], evolution=studio.evolution/100;
        const progress=targetDurationMinutes ? Math.min(1, accumulatedMs/(targetDurationMinutes*60000)) : 0;
        const drift=1+0.12*evolution*Math.sin(accumulatedMs/110000);
        ramp(nodes.lp.frequency,scene.cutoff*(0.65+studio.brightness/100)*drift,smooth);
        ramp(nodes.lfo.frequency,scene.rate,smooth);
        ramp(nodes.lfoDepth.gain,scene.depth*evolution,smooth);
        ramp(nodes.textureFilter.frequency,scene.cutoff*(0.65+studio.brightness/100)*drift,smooth);
        ramp(nodes.textureGain.gain,scene.white,smooth);
        ramp(nodes.brownGain.gain,scene.brown??(1-scene.white),smooth);
        ramp(nodes.windGain.gain,scene.wind??0,smooth);
        nodes.windGust.setEvolution(studio.evolution);
        ramp(nodes.windLowpass.frequency,2600+studio.brightness*40,smooth);
        ramp(nodes.crackleGain.gain,scene.crackle??0,smooth);
        ramp(nodes.droneFilter.frequency,220+studio.brightness*6,smooth);
        ramp(nodes.droneLfoDepth.gain,110*evolution,smooth);
        const ratios=[1,2,3];
        nodes.droneOscs.forEach((osc,i)=>ramp(osc.frequency,scene.root*ratios[i]*(1+0.002*evolution*Math.sin(accumulatedMs/150000)),smooth));
        // Audio automation owns the envelopes; the timer only updates their caption.
        const {exit}=sessionEnvelope(accumulatedMs,targetDurationMinutes,studio.fadeOutSeconds);
        const entry=entryEnvelope(accumulatedMs,studio.fadeInSeconds);
        $('session-phase').textContent=isSilentRest()?'Descanso en silencio':exit<1 ? 'Cierre gradual' : entry<1 ? 'Entrada suave' : cycleState.plan!=='single'&&cycleState.phase==='rest' ? 'Descanso sostenido' : progress>0 ? 'Concentración sostenida' : 'Sesión libre';
      }

      function selectedMixIndex() {
        const value=$('saved-mixes').value;
        return value!=='' && savedMixes[Number(value)] ? Number(value) : -1;
      }
      function mixSearchIndices(mixes,query='') {
        if(!Array.isArray(mixes)||typeof query!=='string')return [];
        const fold=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
        const words=fold(query).trim().split(/\s+/).filter(Boolean);
        return mixes.reduce((indices,mix,index)=>{
          if(mix&&typeof mix.name==='string'){
            const text=fold(mix.name);
            if(words.every(word=>text.includes(word)))indices.push(index);
          }
          return indices;
        },[]);
      }
      function renderMixes(selected='') {
        const select=$('saved-mixes');select.replaceChildren(new Option('Elegí una mezcla',''));
        const favorites=$('favorite-mixes');favorites.replaceChildren();
        const query=$('mix-search').value,indices=mixSearchIndices(savedMixes,query);
        indices.forEach(i=>{
          const mix=savedMixes[i];
          select.add(new Option((mix.favorite?'★ ':'')+mix.name,String(i)));
          if(mix.favorite) {
            const button=document.createElement('button');
            button.type='button';button.className='subtle-button';
            button.textContent='★ '+mix.name;
            button.addEventListener('click',()=>{
              select.value=String(i);syncMixActions();$('preset-name').value=mix.name;$('load-mix').click();
            });
            favorites.append(button);
          }
        });
        select.value=indices.some(i=>String(i)===String(selected))?String(selected):'';
        select.disabled=indices.length===0;
        $('clear-mix-search').hidden=query.length===0;
        $('mix-search-status').textContent=!savedMixes.length?'Todavía no guardaste mezclas.':!indices.length?'No hay mezclas que coincidan. Probá con otro nombre.':indices.length+' de '+savedMixes.length+' mezclas';
        syncMixActions();syncMixUndoUI();
      }
      function syncMixActions() {
        const index=selectedMixIndex(), mix=savedMixes[index];
        ['update-mix','duplicate-mix','rename-mix','favorite-mix','delete-mix','load-mix'].forEach(id=>$(id).disabled=index<0);
        $('favorite-mix').textContent=mix?.favorite ? 'Quitar de favoritas' : 'Marcar favorita';
        $('favorite-mix').setAttribute('aria-pressed',String(Boolean(mix?.favorite)));
        syncSavedMixPreview(mix);
      }
      function syncSavedMixPreview(mix) {
        $('saved-mix-preview').hidden=!mix;
        $('saved-mix-sound').textContent='';
        $('saved-mix-session').textContent='';
        if(!mix)return;
        const plan=Object.prototype.hasOwnProperty.call(cycleTools.plans,mix.cyclePlan)?mix.cyclePlan:'single';
        const duration=cycleTools.validDuration(mix.duration)?mix.duration:0;
        const session=plan==='single'?(duration?duration+' minutos':'Sesión libre'):'Ciclo '+plan.replace('-','/')+' min · Descansos '+(mix.restSound==='silent'?'en silencio':'con sonido');
        $('saved-mix-sound').textContent=mix.name+' · '+SCENES[mix.scene].label+' · '+(mix.melody?'Melodía activada':'Sin melodía');
        $('saved-mix-session').textContent=session+' · Maestro '+mix.levels.master+'% · Textura '+mix.levels.noise+'% · Drone '+mix.levels.drone+'% · Notas '+mix.levels.notes+'%';
      }
      function currentMix(name, favorite=false) {
        return {...studio,name,favorite,cyclePlan:cycleState.plan,duration:cycleState.plan==='single'?targetDurationMinutes:cycleTools.plans[cycleState.plan].focus,
          levels:Object.fromEntries(Object.keys(DEFAULTS).map(k=>[k,Number($('vol-'+k).value)]))};
      }
      function createMixCopy(mixes,index) {
        if(!Array.isArray(mixes)||!Number.isInteger(index)||index<0||index>=mixes.length)throw Error('Elegí una mezcla para duplicar.');
        if(mixes.length>=50)throw Error('Podés guardar hasta 50 mezclas.');
        const source=mixes[index];
        if(!source||typeof source.name!=='string'||!source.levels||typeof source.levels!=='object'||Array.isArray(source.levels))throw Error('La mezcla seleccionada no es válida.');
        const key=name=>name.trim().normalize('NFC').toLocaleLowerCase('es');
        const used=new Set(mixes.filter(mix=>mix&&typeof mix.name==='string').map(mix=>key(mix.name)));
        const base=source.name.trim()||'Mezcla';
        for(let number=1;number<=50;number++){
          const suffix=number===1?' (copia)':' (copia '+number+')';
          let stem='';
          for(const char of base){if(stem.length+char.length>60-suffix.length)break;stem+=char;}
          const name=stem.trimEnd()+suffix;
          if(!used.has(key(name)))return {...source,name,favorite:false,levels:{...source.levels}};
        }
        throw Error('No se pudo elegir un nombre para la copia.');
      }

      function syncMixUndoUI() {
        const available=mixDeletionUndo!==null;
        $('undo-delete-mix').hidden=!available;
        $('undo-delete-mix').disabled=!available;
        $('mix-undo-hint').hidden=!available;
      }
      function commitMixes(next, selected='', reveal=false) {
        if(!writeLocal('focus-mixes-v3',next))return false;
        savedMixes=next;mixDeletionUndo=null;
        if(reveal)$('mix-search').value='';
        renderMixes(selected);return true;
      }
      function deleteSelectedMix() {
        const index=selectedMixIndex();if(index<0)return;
        const mix=savedMixes[index],removed={index,mix:{...mix,levels:{...mix.levels}}};
        if(commitMixes(savedMixes.filter((_,i)=>i!==index))){
          mixDeletionUndo=removed;syncMixUndoUI();
          $('studio-status').textContent='Mezcla eliminada.';
        }
      }
      function undoMixDeletion() {
        if(!mixDeletionUndo)return;
        if(savedMixes.length>=50){$('studio-status').textContent='No hay espacio para recuperar la mezcla.';return;}
        const {mix}=mixDeletionUndo,index=Math.min(mixDeletionUndo.index,savedMixes.length);
        const next=[...savedMixes.slice(0,index),mix,...savedMixes.slice(index)];
        if(commitMixes(next,String(index),true)){
          $('preset-name').value=mix.name;
          $('studio-status').textContent='Mezcla recuperada. Cargala en pausa para usarla.';
        }
      }
      // Only crossing the breakpoint resets panels. Manual toggles within a
      // layout remain untouched, and playback nodes are never recreated.
      function setupResponsivePanels() {
        if (!('matchMedia' in window)) return;
        const compact = window.matchMedia('(max-width: 900px)');
        const updatePanels = () => {
          ['sound-settings','mix-settings','history-card'].forEach(id => {
            $(id).open = !compact.matches;
          });
        };
        updatePanels();
        if (compact.addEventListener) compact.addEventListener('change',updatePanels);
        else if (compact.addListener) compact.addListener(updatePanels);
      }

      function initStudio() {
        const loaded=readLocal(STUDIO_KEY,null);
        if(validStudio(loaded)) studio={scene:loaded.scene,evolution:loaded.evolution,brightness:loaded.brightness,melody:loaded.melody,stereoWidth:loaded.stereoWidth??100,balance:loaded.balance??0,notePace:loaded.notePace??'normal',fadeOutSeconds:loaded.fadeOutSeconds??20,fadeInSeconds:loaded.fadeInSeconds??12,preserveMix:loaded.preserveMix??false,restSound:loaded.restSound??'sound'};
        const mixes=readLocal('focus-mixes-v3',[]);
        savedMixes=Array.isArray(mixes) ? mixes.filter(m=>validStudio(m)&&typeof m.name==='string'&&m.levels&&Object.keys(DEFAULTS).every(k=>Number.isFinite(m.levels[k])&&m.levels[k]>=0&&m.levels[k]<=100)).slice(0,50) : [];
        syncStudio();renderMixes();
        $('mix-search').addEventListener('input',()=>renderMixes($('saved-mixes').value));
        $('clear-mix-search').addEventListener('click',()=>{
          $('mix-search').value='';renderMixes($('saved-mixes').value);$('mix-search').focus();
        });
        ['soundscape','evolution','brightness','melody','stereo-width','channel-balance','note-pace','fade-in','fade-out','preserve-mix','rest-sound'].forEach(id=>$(id).addEventListener('input',()=>{
          if(id==='fade-in') {
            const value=Number($('fade-in').value);
            if(playing||transitioning||!['0','3','12','30'].includes($('fade-in').value)){syncEntryUI();return;}
            studio.fadeInSeconds=value;
          }
          if(id==='fade-out') {
            const value=Number($('fade-out').value);
            if(playing||transitioning||!targetDurationMinutes||![5,20,60].includes(value)){syncFadeUI();return;}
            studio.fadeOutSeconds=value;
          }
          if(id==='rest-sound') {
            const value=$('rest-sound').value;
            if(playing||transitioning||cycleState.plan==='single'||!['sound','silent'].includes(value)){syncRestSoundUI();return;}
            syncFocusHistoryProgress(true);studio.restSound=value;
          }
          if(id==='preserve-mix')studio.preserveMix=$('preserve-mix').checked;
          if(id==='soundscape') {
            lastNote=-1;noteStep=0;
            studio.scene=$('soundscape').value;
            if(!studio.preserveMix) {
              studio.melody=SCENES[studio.scene].melody!==false;
              Object.entries(SCENES[studio.scene].mix).forEach(([k,v])=>{$('vol-'+k).value=v;updateRange(k,false);});
              persistSettings();
            }
          }
          if(id==='evolution')studio.evolution=Number($('evolution').value);
          if(id==='brightness')studio.brightness=Number($('brightness').value);
          if(id==='stereo-width')studio.stereoWidth=Number($('stereo-width').value);
          if(id==='channel-balance') {
            const value=Number($('channel-balance').value);
            if(!Number.isInteger(value)||value<-100||value>100){syncStudio();return;}
            studio.balance=value;
          }
          if(id==='melody')studio.melody=$('melody').checked;
          if(id==='note-pace') {
            if(!['sparse','normal','frequent'].includes($('note-pace').value)){syncStudio();return;}
            studio.notePace=$('note-pace').value;
          }
          applyScene();writeLocal(STUDIO_KEY,studio);
          if(id==='rest-sound')syncUI();
          if(playing&&['soundscape','melody','note-pace'].includes(id))scheduleNextNote();
        }));
        $('center-balance').addEventListener('click',()=>{
          studio.balance=0;applyScene();writeLocal(STUDIO_KEY,studio);
        });
        $('save-mix').addEventListener('click',()=>{
          const name=$('preset-name').value.trim(); if(!name){$('studio-status').textContent='Escribí un nombre para tu mezcla.';return;}
          if(savedMixes.length>=50){$('studio-status').textContent='Podés guardar hasta 50 mezclas.';return;}
          if(commitMixes([...savedMixes,currentMix(name)],String(savedMixes.length),true))$('studio-status').textContent='Mezcla guardada.';
        });
        $('load-mix').addEventListener('click',()=>{
          if($('saved-mixes').value==='')return;
          const mix=savedMixes[Number($('saved-mixes').value)];if(!mix)return;
          if(playing||transitioning){$('studio-status').textContent=transitioning?'Esperá a que termine el inicio del audio para cargar una mezcla.':'Pausá la sesión antes de cargar una mezcla.';return;}
          studio={scene:mix.scene,evolution:mix.evolution,brightness:mix.brightness,melody:mix.melody,stereoWidth:mix.stereoWidth??100,balance:mix.balance??0,notePace:mix.notePace??'normal',fadeOutSeconds:mix.fadeOutSeconds??20,fadeInSeconds:mix.fadeInSeconds??12,preserveMix:mix.preserveMix??false,restSound:mix.restSound??'sound'};
          Object.keys(DEFAULTS).forEach(k=>{$('vol-'+k).value=mix.levels[k];updateRange(k,false);});
          const plan=Object.prototype.hasOwnProperty.call(cycleTools.plans,mix.cyclePlan)?mix.cyclePlan:'single';
          resetCycle(plan,plan==='single'?(cycleTools.validDuration(mix.duration)?mix.duration:0):cycleState.singleDuration);
          applyScene();persistSettings();writeLocal(STUDIO_KEY,studio);
          $('studio-status').textContent='Mezcla cargada.';
        });
        $('delete-mix').addEventListener('click',deleteSelectedMix);
        $('undo-delete-mix').addEventListener('click',undoMixDeletion);

        $('saved-mixes').addEventListener('change',()=>{
          syncMixActions();
          const mix=savedMixes[selectedMixIndex()];
          if(mix)$('preset-name').value=mix.name;
        });
        $('update-mix').addEventListener('click',()=>{
          const i=selectedMixIndex();if(i<0)return;
          const next=savedMixes.map((mix,j)=>j===i?currentMix(mix.name,mix.favorite===true):mix);
          if(commitMixes(next,String(i)))$('studio-status').textContent='Ajustes de la mezcla actualizados.';
        });
        $('duplicate-mix').addEventListener('click',()=>{
          const index=selectedMixIndex();if(index<0)return;
          try {
            const copy=createMixCopy(savedMixes,index);
            if(commitMixes([...savedMixes,copy],String(savedMixes.length),true)){
              $('preset-name').value=copy.name;
              $('studio-status').textContent='Copia guardada. Cargala en pausa para editar su sonido.';
            }
          }catch(error){$('studio-status').textContent=error.message;}
        });
        $('rename-mix').addEventListener('click',()=>{
          const i=selectedMixIndex(),name=$('preset-name').value.trim();if(i<0)return;
          if(!name){$('studio-status').textContent='Escribí el nuevo nombre.';return;}
          if(commitMixes(savedMixes.map((mix,j)=>j===i?{...mix,name}:mix),String(i),true))$('studio-status').textContent='Mezcla renombrada.';
        });
        $('favorite-mix').addEventListener('click',()=>{
          const i=selectedMixIndex();if(i<0)return;
          commitMixes(savedMixes.map((mix,j)=>j===i?{...mix,favorite:mix.favorite!==true}:mix),String(i));
        });
        $('save-feedback').addEventListener('click',()=>{
          if(!feedbackSession)return;
          const old=readLocal('focus-feedback-v3',[]);
          const ratings=Array.isArray(old)?old:[];
          ratings.push({...feedbackSession,rating:Number($('session-rating').value),distractions:$('session-distraction').value});
          if(writeLocal('focus-feedback-v3',ratings.slice(-200))) {
            $('session-feedback').hidden=true;feedbackSession=null;
            $('feedback-status').textContent='Valoración guardada en este dispositivo.';
            renderInsights();
          }
        });
      }



      function summarizeRatings(records, days=30, scene='all', now=Date.now()) {
        const allowedScenes=Object.keys(SCENES);
        const valid=(Array.isArray(records)?records:[]).slice(-200).filter(record=>{
          if(!record || typeof record!=='object')return false;
          const date=typeof record.date==='string'?Date.parse(record.date):NaN;
          return Number.isFinite(date) && date<=now
            && allowedScenes.includes(record.scene)
            && Number.isInteger(record.rating) && record.rating>=1 && record.rating<=5
            && Number.isFinite(record.minutes) && record.minutes>0 && record.minutes<=10080
            && ['low','medium','high'].includes(record.distractions);
        });
        const period=[0,7,30].includes(days)?days:30;
        const rows=valid.filter(record=>(!period || Date.parse(record.date)>=now-period*86400000) && (scene==='all'||record.scene===scene))
          .sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
        const groups=allowedScenes.map(id=>{
          const entries=rows.filter(record=>record.scene===id);
          return {scene:id,count:entries.length,average:entries.length ? entries.reduce((sum,row)=>sum+row.rating,0)/entries.length : 0,
            lowDistractions:entries.filter(row=>row.distractions==='low').length};
        }).filter(group=>group.count>0).sort((a,b)=>b.average-a.average||b.count-a.count);
        const eligible=groups.filter(group=>group.count>=3);
        const best=eligible.length>=2 && Math.round(eligible[0].average*10)>Math.round(eligible[1].average*10) ? eligible[0] : null;
        return {rows,groups,best,count:rows.length,average:rows.length?rows.reduce((sum,row)=>sum+row.rating,0)/rows.length:0};
      }

      function renderInsights() {
        const days=Number($('insights-period').value || 30),scene=$('insights-scene').value || 'all';
        const result=summarizeRatings(readLocal('focus-feedback-v3',[]),days,scene);
        $('insights-summary').textContent=result.count
          ? result.count+' '+(result.count===1?'valoración':'valoraciones')+' · Ayuda promedio: '+result.average.toFixed(1)+' de 5.'
          : 'Todavía no hay valoraciones para estos filtros.';
        $('insights-empty').hidden=result.count>0;
        $('insights-table-wrap').hidden=result.count===0;
        $('insights-comparison').textContent=!result.count ? '' : scene!=='all' ? 'Elegí Todos para comparar los ambientes entre sí.' : result.best
          ? SCENES[result.best.scene].label+' tiene el mayor promedio entre ambientes con al menos 3 valoraciones cada uno. Es una comparación orientativa.'
          : 'Para destacar un ambiente se necesitan al menos 3 valoraciones en cada uno de dos ambientes y promedios diferentes.';
        const body=$('insights-rows');body.replaceChildren();
        result.groups.forEach(group=>{
          const row=document.createElement('tr');
          [SCENES[group.scene].label,String(group.count),group.average.toFixed(1),group.lowDistractions+' de '+group.count].forEach(value=>{
            const cell=document.createElement('td');cell.textContent=value;row.append(cell);
          });
          body.append(row);
        });
        const recent=$('insights-recent');recent.replaceChildren();
        const distractions={low:'Pocas',medium:'Algunas',high:'Muchas'};
        result.rows.slice(0,10).forEach(record=>{
          const item=document.createElement('li'),title=document.createElement('strong'),details=document.createElement('p');
          title.textContent=SCENES[record.scene].label+' · '+record.rating+' de 5';
          const date=new Date(record.date);
          details.textContent=date.toLocaleDateString('es-AR')+' '+date.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})+
            ' · '+record.minutes+' min · '+distractions[record.distractions]+' distracciones';
          item.append(title);item.append(details);recent.append(item);
        });
      }
      function initInsights() {
        ['insights-period','insights-scene'].forEach(id=>$(id).addEventListener('change',renderInsights));
        renderInsights();
      }




      const backupTools=storage;
      let pendingBackup=null,backupReadSequence=0;
      let reloadingAfterRestore=false;

      async function shareGeneratedMix() {
        const button=$('native-share-link'),url=$('share-link').value;
        if(!url||button.disabled||typeof navigator.share!=='function')return;
        button.disabled=true;
        try {
          await navigator.share({title:'FOCUS — Paisaje sonoro',url});
          $('share-link-status').textContent='El enlace sigue disponible para compartir o copiar.';
        }catch(error) {
          if(error?.name==='AbortError') {
            $('share-link-status').textContent='Compartir cancelado. El enlace sigue disponible.';
          }else {
            $('share-link').focus();$('share-link').select();
            $('share-link-status').textContent='No se pudo abrir el menú de compartir. Usá Copiar enlace o copialo manualmente.';
          }
        }finally {button.disabled=false;}
      }

      function syncSharedMixButton() {
        $('apply-shared-mix').disabled=!pendingSharedMix||playing||transitioning;
      }
      function clearSharedMixLink() {
        try {
          if(window.location.hash?.startsWith('#mix='))window.history.replaceState(null,'',window.location.pathname+window.location.search);
        }catch(_) {}
      }
      function previewSharedMix() {
        pendingSharedMix=null;$('shared-mix-preview').hidden=true;$('shared-mix-status').textContent='';
        const hash=window.location.hash||'';
        if(hash.startsWith('#mix=')) {
          try {
            pendingSharedMix=shareTools.decode(hash);
            const mix=pendingSharedMix;
            $('shared-mix-summary').textContent=SCENES[mix.scene].label+' · '+(mix.cyclePlan==='single'?(mix.duration?mix.duration+' minutos':'Sesión libre'):mix.cyclePlan.replace('-','/'))+' · Volumen maestro: '+mix.levels.master+'% · Amplitud estéreo: '+mix.stereoWidth+'% · Balance: '+balanceLabel(mix.balance)+' · Notas: '+(mix.melody?({sparse:'más espaciadas',normal:'ritmo actual',frequent:'más frecuentes'})[mix.notePace]:'desactivadas')+' · Entrada: '+(mix.fadeInSeconds?mix.fadeInSeconds+' s':'directa')+' · Cierre: '+mix.fadeOutSeconds+' s (hasta la mitad del tramo).'+(mix.preserveMix?' Conserva volúmenes y melodía al cambiar de ambiente.':'')+(mix.cyclePlan!=='single'?' Descansos: '+(mix.restSound==='silent'?'en silencio.':'con sonido.'):'');
            $('shared-mix-preview').hidden=false;
          }catch(_) {
            $('shared-mix-status').textContent='El enlace de mezcla no es válido o usa una versión incompatible. Tus ajustes se mantienen.';
          }
        }
        syncSharedMixButton();
      }
      function initSharedMix() {
        previewSharedMix();
        window.addEventListener('hashchange',previewSharedMix);
        $('create-share-link').addEventListener('click',()=>{
          try {
            const link=window.location.origin+window.location.pathname+shareTools.encode(currentMix(''));
            $('share-link').value=link;
            $('share-link-panel').hidden=false;
            $('share-link-status').textContent='Enlace creado con los ajustes actuales. Podés copiarlo y abrirlo en otro dispositivo.';
          }catch(_) {$('share-link-status').textContent='No se pudo crear el enlace de esta mezcla.';}
        });
        $('native-share-link').hidden=typeof navigator.share!=='function';
        $('native-share-link').addEventListener('click',shareGeneratedMix);
        $('copy-share-link').addEventListener('click',async()=>{
          if(!$('share-link').value)return;
          try {
            if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
            await navigator.clipboard.writeText($('share-link').value);
            $('share-link-status').textContent='Enlace copiado.';
          }catch(_) {
            $('share-link').focus();$('share-link').select();
            $('share-link-status').textContent='No se pudo copiar automáticamente. El enlace está seleccionado para copiarlo manualmente.';
          }
        });
        $('apply-shared-mix').addEventListener('click',()=>{
          if(!pendingSharedMix||playing||transitioning)return;
          const mix=pendingSharedMix;
          studio={scene:mix.scene,evolution:mix.evolution,brightness:mix.brightness,melody:mix.melody,stereoWidth:mix.stereoWidth??100,balance:mix.balance??0,notePace:mix.notePace??'normal',fadeOutSeconds:mix.fadeOutSeconds??20,fadeInSeconds:mix.fadeInSeconds??12,preserveMix:mix.preserveMix??false,restSound:mix.restSound??'sound'};
          Object.keys(DEFAULTS).forEach(key=>{$('vol-'+key).value=mix.levels[key];updateRange(key,false);});
          const sessionSaved=resetCycle(mix.cyclePlan,mix.cyclePlan==='single'?mix.duration:cycleState.singleDuration);
          applyScene();
          const levelsSaved=persistSettings(),studioSaved=writeLocal(STUDIO_KEY,studio);
          $('shared-mix-preview').hidden=true;pendingSharedMix=null;
          $('session-feedback').hidden=true;feedbackSession=null;$('feedback-status').textContent='';
          $('shared-mix-status').textContent=sessionSaved&&levelsSaved&&studioSaved?'Ajustes compartidos aplicados. Tocá Iniciar para escuchar. Podés guardarlos en Mis mezclas.':'Ajustes aplicados en esta pestaña. No se pudieron guardar todos los cambios en este dispositivo.';
          clearSharedMixLink();syncSharedMixButton();
        });
        $('dismiss-shared-mix').addEventListener('click',()=>{
          pendingSharedMix=null;$('shared-mix-preview').hidden=true;
          $('shared-mix-status').textContent='Mezcla descartada. Tus ajustes se mantienen.';
          clearSharedMixLink();syncSharedMixButton();
        });
        syncSharedMixButton();
      }

      function syncBackupButtons() {
        $('import-backup').disabled=!pendingBackup||playing||transitioning;
        try{$('undo-backup').hidden=!backupTools.canUndo();}catch(_){$('undo-backup').hidden=true;}
        $('undo-backup').disabled=playing||transitioning;
      }
      function previewBackup() {
        if(!pendingBackup)return;
        try {
          const plan=backupTools.planImport(pendingBackup,$('backup-settings').checked);
          const info=plan.summary;
          $('backup-summary').textContent='Archivo: '+info.mixesInFile+' mezclas, '+info.daysInFile+' días y '+info.ratingsInFile+' valoraciones. Se agregarán '+info.mixesAdded+' mezclas y '+info.ratingsAdded+' valoraciones.'+
            (info.ratingsDiscarded?' Se descartarán '+info.ratingsDiscarded+' valoraciones antiguas por el límite de 200.':'')+
            (info.includeSettings?' Se usarán también los ajustes y la sesión de la copia.':' Tus volúmenes, ambiente y sesión actuales se mantienen.');
          $('backup-preview').hidden=false;
          $('backup-status').textContent=playing?'Pausá la reproducción antes de importar.':'Revisá la vista previa y elegí Importar para aplicar.';
          syncBackupButtons();
        }catch(error){pendingBackup=null;$('backup-preview').hidden=true;$('backup-status').textContent=error.message;syncBackupButtons();}
      }
      function initBackups() {
        $('backup-file').addEventListener('change',async()=>{
          const sequence=++backupReadSequence;
          pendingBackup=null;$('backup-preview').hidden=true;syncBackupButtons();
          const file=$('backup-file').files?.[0];if(!file)return;
          if(file.size>1048576){$('backup-status').textContent='El archivo supera el límite de 1 MB.';return;}
          $('backup-status').textContent='Leyendo copia…';
          try {
            const text=await file.text();if(sequence!==backupReadSequence)return;
            const parsed=JSON.parse(text);backupTools.validateBackup(parsed);pendingBackup=parsed;previewBackup();
          }catch(error){if(sequence===backupReadSequence){$('backup-status').textContent='No se pudo abrir la copia: '+error.message;syncBackupButtons();}}
        });
        $('backup-settings').addEventListener('change',previewBackup);
        $('cancel-backup').addEventListener('click',()=>{
          backupReadSequence++;pendingBackup=null;$('backup-file').value='';$('backup-preview').hidden=true;
          $('backup-status').textContent='Importación cancelada.';syncBackupButtons();
        });
        $('import-backup').addEventListener('click',()=>{
          if(!pendingBackup||playing||transitioning)return;
          try{backupTools.applyImport(pendingBackup,$('backup-settings').checked);reloadingAfterRestore=true;window.location.reload();}
          catch(error){$('backup-status').textContent=error.message;syncBackupButtons();}
        });
        $('undo-backup').addEventListener('click',()=>{
          if(playing||transitioning)return;
          try{backupTools.undoImport();reloadingAfterRestore=true;window.location.reload();}
          catch(error){$('backup-status').textContent=error.message;syncBackupButtons();}
        });
        $('export-backup').addEventListener('click',()=>{
          try {
            const content=JSON.stringify(backupTools.exportBackup(),null,2);
            const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));
            const link=document.createElement('a');link.href=url;
            link.download='focus-copia-'+new Date().toISOString().slice(0,10)+'.json';
            document.body.append(link);link.click();link.remove();
            window.setTimeout(()=>URL.revokeObjectURL(url),10000);
            $('backup-status').textContent='Copia preparada para descargar.';
          }catch(error){$('backup-status').textContent='No se pudo crear la copia: '+error.message;}
        });
        syncBackupButtons();
      }


      function cycleAction() {
        if(cycleState.plan==='single'||!cycleState.completed)return {text:'Iniciar',label:isSilentRest()?'Iniciar descanso en silencio':'Iniciar paisaje sonoro'};
        const next=cycleTools.next(cycleState),last=next.round===1&&next.phase==='focus';
        return {text:last?'Repetir':next.phase==='rest'?'Descansar':'Siguiente',
          label:(last?'Repetir ciclo: ': 'Iniciar ')+(next.phase==='rest'?(studio.restSound==='silent'?'descanso en silencio':'descanso'):'ronda '+next.round)+' de '+cycleTools.duration(next)+' minutos'};
      }

      function syncExtensionUI() {
        const button=$('extend-session'),next=sessionExtension(cycleState.plan,targetDurationMinutes,accumulatedMs);
        button.hidden=cycleState.plan!=='single'||targetDurationMinutes===0;
        button.disabled=transitioning||!next;
        button.textContent=next?'+'+next.added+' min':targetDurationMinutes===180?'Máximo 180 min':'+5 min';
        button.setAttribute('aria-label',next?'Sumar '+next.added+' '+(next.added===1?'minuto':'minutos')+' a la sesión sin reiniciar':'La sesión no se puede prolongar');
      }
      function extendSession() {
        if(transitioning)return;
        advanceSessionClock();
        const next=sessionExtension(cycleState.plan,targetDurationMinutes,accumulatedMs);
        if(!next){renderTimer();syncExtensionUI();return;}
        targetDurationMinutes=next.duration;
        cycleState={...cycleState,singleDuration:next.duration};
        $('custom-minutes').value=String(next.duration);
        $('custom-minutes').setAttribute('aria-invalid','false');
        $('custom-duration-status').textContent='';
        modeLabelEl.textContent='Cuenta regresiva ('+next.duration+' min)';
        if(playing)scheduleSessionClosing(ctx,nodes.closingGain.gain,accumulatedMs,targetDurationMinutes,studio.fadeOutSeconds,isSilentRest(),true);
        applyScene();renderTimer();
        const saved=saveSession(true);syncUI();
        $('extension-status').textContent='Sumaste '+next.added+' '+(next.added===1?'minuto':'minutos')+'. Duración total: '+next.duration+' minutos.'+(saved===false?' No se pudo guardar el cambio en este dispositivo.':'');
      }

      function syncCycleUI() {
        syncExtensionUI();
        syncEntryUI();syncFadeUI();syncRestSoundUI();syncSceneLabels();
        const active=cycleState.plan!=='single';
        const locked=active||playing||transitioning;
        $('custom-minutes').disabled=locked;
        $('apply-duration').disabled=locked;
        $('custom-duration-hint').textContent=active?'La duración personalizada se usa en Una sesión.':playing||transitioning?'Pausá para aplicar otra duración.':'De 1 a 180 minutos. Aplicar en pausa reinicia el reloj.';
        $('session-plan').value=cycleState.plan;
        $('session-plan').disabled=playing||transitioning;
        $('cycle-hint').hidden=!active;
        $('cycle-hint').textContent='Hay un descanso entre rondas. Cada tramo se detiene al terminar y el siguiente empieza al tocar el botón. '+(studio.restSound==='silent'?'Los descansos en silencio no suman tiempo de escucha.':'El tiempo de escucha incluye los descansos con sonido.');
        document.querySelectorAll('.mode-chip').forEach(chip=>{chip.disabled=active;chip.setAttribute('aria-pressed',String(!active&&Number(chip.dataset.minutes)===targetDurationMinutes));});
        $('reset-timer').textContent=active?'Reiniciar tramo':'Reiniciar reloj';
        if(!active){$('cycle-status').textContent='';return;}
        const plan=cycleTools.plans[cycleState.plan],kind=cycleState.phase==='rest'?(isSilentRest()?'Descanso en silencio':'Descanso'):'Concentración';
        $('cycle-status').textContent=kind+' · Ronda '+cycleState.round+' de '+plan.rounds+
          (cycleState.completed?' · Tramo terminado':'');
        modeLabelEl.textContent=kind+' ('+targetDurationMinutes+' min)';
      }
      function resetCycle(plan,singleDuration=cycleState.singleDuration) {
        advanceSessionClock();syncFocusHistoryProgress(true);
        $('extension-status').textContent='';
        cycleState=cycleTools.initial(plan,singleDuration);
        targetDurationMinutes=cycleTools.duration(cycleState);
        sessionRecordedMs=0;accumulatedMs=0;
        $('resume-status').textContent='';
        modeLabelEl.textContent=targetDurationMinutes?'Cuenta regresiva ('+targetDurationMinutes+' min)':'Tiempo de sesión (Libre)';
        $('custom-duration-status').textContent='';
        $('custom-minutes').setAttribute('aria-invalid','false');
        if(plan==='single'&&singleDuration>0)$('custom-minutes').value=singleDuration;
        if(playing) {
          lastTickTimestamp=Date.now();
          scheduleSessionClosing(ctx,nodes.closingGain.gain,0,targetDurationMinutes,studio.fadeOutSeconds,isSilentRest(),true);
          scheduleSessionEntry(ctx,nodes.sessionGain.gain,0,studio.fadeInSeconds,isSilentRest(),true);
        }
        syncCycleUI();renderTimer();const saved=saveSession(true);syncUI();return saved;
      }
      function initCycles() {
        if(cycleState.singleDuration>0)$('custom-minutes').value=cycleState.singleDuration;
        $('extend-session').addEventListener('click',extendSession);
        $('session-plan').addEventListener('change',()=>{
          if(playing||transitioning){$('session-plan').value=cycleState.plan;return;}
          const value=$('session-plan').value;
          if(!Object.prototype.hasOwnProperty.call(cycleTools.plans,value))return;
          resetCycle(value,cycleState.plan==='single'&&cycleTools.validDuration(targetDurationMinutes)?targetDurationMinutes:cycleState.singleDuration);
        });
        syncCycleUI();
      }

      const SESSION_KEY='focus-session-v1';
      let lastSessionSave=0;
      let waitingWorker=null;
      let updateReloadRequested=false;
      let installPrompt=null;
      function saveSession(force=false) {
        if(!force && Date.now()-lastSessionSave<5000)return;
        lastSessionSave=Date.now();
        return writeLocal(SESSION_KEY,{duration:targetDurationMinutes,elapsed:accumulatedMs,cycle:cycleState});
      }
      function restoreSession() {
        const saved=readLocal(SESSION_KEY,null);
        if(!saved || !Number.isFinite(saved.elapsed) || saved.elapsed<0 || saved.elapsed>7*86400000)return;
        const restored=saved.cycle?cycleTools.normalize(saved.cycle):cycleTools.initial('single',cycleTools.validDuration(saved.duration)?saved.duration:0);
        if(!restored || cycleTools.duration(restored)!==saved.duration)return;
        cycleState=restored;
        targetDurationMinutes=saved.duration;
        accumulatedMs=targetDurationMinutes ? Math.min(saved.elapsed,targetDurationMinutes*60000) : saved.elapsed;
        if(cycleState.plan!=='single'&&accumulatedMs>=targetDurationMinutes*60000)cycleState.completed=true;
        sessionRecordedMs=accumulatedMs; // Time from the previous visit is already in history.
        document.querySelectorAll('.mode-chip').forEach(c=>c.setAttribute('aria-pressed',String(Number(c.dataset.minutes)===targetDurationMinutes)));
        modeLabelEl.textContent=targetDurationMinutes ? 'Cuenta regresiva ('+targetDurationMinutes+' min)' : 'Tiempo de sesión (Libre)';
        if(accumulatedMs>0 && (!targetDurationMinutes || accumulatedMs<targetDurationMinutes*60000)) {
          $('resume-status').textContent='Sesión recuperada. Tocá Iniciar para continuar.';
        }
      }
      function syncUpdateButton() {
        $('apply-update').hidden=!waitingWorker;
        $('apply-update').disabled=playing || transitioning;
        if(waitingWorker)$('update-status').textContent=playing ? 'Hay una versión nueva. Pausá para actualizar.' : 'Nueva versión disponible. Tus mezclas se conservan.';
      }
      function setupInstallAndUpdates() {
        window.addEventListener('beforeinstallprompt',event=>{
          event.preventDefault();installPrompt=event;$('install-app').hidden=false;
        });
        window.addEventListener('appinstalled',()=>{installPrompt=null;$('install-app').hidden=true;});
        $('install-app').addEventListener('click',async()=>{
          if(!installPrompt)return;
          const prompt=installPrompt;installPrompt=null;$('install-app').hidden=true;
          try { await prompt.prompt(); await prompt.userChoice; }
          catch (_) { $('update-status').textContent='Usá el menú del navegador para instalar FOCUS.'; }
        });
        $('apply-update').addEventListener('click',()=>{
          if(!waitingWorker || playing || transitioning)return;
          saveSession(true);updateReloadRequested=true;
          $('apply-update').disabled=true;
          waitingWorker.postMessage({type:'SKIP_WAITING'});
        });
        const connectionStatus=()=>{
          $('offline-status').textContent=navigator.onLine===false ? 'Sin conexión. La instalación guardada puede seguir funcionando.' : 'Con conexión. Preparando disponibilidad sin conexión…';
        };
        connectionStatus();
        if(!('serviceWorker' in navigator)) {
          $('offline-status').textContent='Este navegador no ofrece instalación sin conexión.';
          return;
        }
        navigator.serviceWorker.addEventListener('controllerchange',()=>{
          if(updateReloadRequested)window.location.reload();
        });
        const register=async()=>{
          try {
            const registration=await navigator.serviceWorker.register('./sw.js');
            const markWaiting=()=>{if(registration.waiting){waitingWorker=registration.waiting;syncUpdateButton();}};
            markWaiting();
            registration.addEventListener('updatefound',()=>{
              const worker=registration.installing;if(!worker)return;
              worker.addEventListener('statechange',()=>{if(worker.state==='installed')markWaiting();});
            });
            await navigator.serviceWorker.ready;
            $('offline-status').textContent=navigator.onLine===false ? 'Sin conexión · FOCUS disponible en este dispositivo.' : 'FOCUS está disponible sin conexión en este dispositivo.';
          } catch (_) {
            $('offline-status').textContent='No se pudo preparar el modo sin conexión. Volvé a abrir con internet.';
          }
        };
        window.addEventListener('load',register);
        window.addEventListener('online',register);
        window.addEventListener('offline',()=>{$('offline-status').textContent='Sin conexión · si ya instalaste FOCUS, podés seguir escuchando.';});
      }

      const level = (id) => {
        const value = Number($('vol-' + id).value) / 100;
        return value * value * TRIM[id];
      };

      const ramp = (param, value, timeConstant = 0.06) => {
        if (!ctx || !param) return;
        param.cancelScheduledValues(ctx.currentTime);
        param.setTargetAtTime(value, ctx.currentTime, timeConstant);
      };

      // MEJORA 1: Buffer Estéreo Real (2 canales independientes con crossfade circular)
      function createStereoBrownBuffer(audioContext, seconds = 16) {
        const length = Math.floor(audioContext.sampleRate * seconds);
        const crossfade = Math.min(Math.floor(audioContext.sampleRate * 1.5), Math.floor(length / 4));
        const buffer = audioContext.createBuffer(2, length, audioContext.sampleRate);

        for (let ch = 0; ch < 2; ch++) {
          const raw = new Float32Array(length + crossfade);
          let last = 0;
          for (let i = 0; i < raw.length; i++) {
            const white = Math.random() * 2 - 1;
            last = (last + 0.024 * white) / 1.024;
            raw[i] = last;
          }

          const data = buffer.getChannelData(ch);
          let peak = 0;
          for (let i = 0; i < length; i++) {
            if (i < crossfade) {
              const t = (i / crossfade) * Math.PI / 2;
              data[i] = raw[i] * Math.sin(t) + raw[length + i] * Math.cos(t);
            } else {
              data[i] = raw[i];
            }
            peak = Math.max(peak, Math.abs(data[i]));
          }
          const normalization = peak > 0 ? 0.82 / peak : 1;
          for (let i = 0; i < length; i++) data[i] *= normalization;
        }
        return buffer;
      }

      // MEJORA 2: Impulso algorítmico estéreo para reverberación sedosa en notas pentatónicas
      function createWarmReverbImpulse(audioContext, duration = 3.2, decay = 2.6) {
        const length = Math.floor(audioContext.sampleRate * duration);
        const impulse = audioContext.createBuffer(2, length, audioContext.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
          const data = impulse.getChannelData(ch);
          let lp = 0;
          for (let i = 0; i < length; i++) {
            const env = Math.pow(1 - i / length, decay);
            const white = (Math.random() * 2 - 1) * env;
            // Suavizado pasa-bajos para evitar cola metálica
            lp = lp + 0.18 * (white - lp);
            data[i] = lp * 0.7;
          }
        }
        return impulse;
      }

      // Prevención de apagado de pantalla en escritorio / móviles (Screen Wake Lock API)
      async function requestWakeLock() {
        if ('wakeLock' in navigator && playing && !wakeLock) {
          try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
              wakeLock = null;
            });
          } catch (_) {
            wakeLock = null;
          }
        }
      }

      async function releaseWakeLock() {
        if (wakeLock) {
          try {
            await wakeLock.release();
          } catch (_) {}
          wakeLock = null;
        }
      }

      // Configuración de MediaSession para controles en pantalla de bloqueo y auriculares
      function setupMediaSession() {
        if (!('mediaSession' in navigator)) return;
        try {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: 'Focus — Paisaje Sonoro',
            artist: 'Síntesis Binaural',
            album: 'Motor Procedural',
            artwork: [
              {
                src: './icons/icon-192.png',
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: './icons/icon-512.png',
                sizes: '512x512',
                type: 'image/png'
              }
            ]
          });

          navigator.mediaSession.setActionHandler('play', () => { play(); });
          navigator.mediaSession.setActionHandler('pause', () => { pause(); });
          navigator.mediaSession.setActionHandler('stop', () => { pause(); });
        } catch (_) {}
      }


      function createCrackleBuffer(context) {
        const buffer=context.createBuffer(2,context.sampleRate*19,context.sampleRate);
        const decay=Math.exp(-1/(context.sampleRate*0.006)),edge=context.sampleRate*0.02;
        for(let ch=0;ch<2;ch++) {
          const data=buffer.getChannelData(ch);let envelope=0;
          for(let i=0;i<data.length;i++) {
            if(Math.random()<8/context.sampleRate)envelope=Math.min(1,envelope+0.3+Math.random()*0.7);
            envelope*=decay;
            data[i]=(Math.random()*2-1)*envelope*0.45*Math.min(1,i/edge,(data.length-1-i)/edge);
          }
        }
        return buffer;
      }

      function startBufferedNoise() {
        nodes.noiseSrc=ctx.createBufferSource();
        nodes.noiseSrc.buffer=createStereoBrownBuffer(ctx);
        nodes.noiseSrc.loop=true;
        const texture=ctx.createBuffer(2,ctx.sampleRate*19,ctx.sampleRate);
        for(let ch=0;ch<2;ch++) {
          const data=texture.getChannelData(ch);
          for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*0.38;
        }
        nodes.textureSrc=ctx.createBufferSource();
        nodes.textureSrc.buffer=texture;nodes.textureSrc.loop=true;
        nodes.noiseSrc.connect(nodes.brownGain);
        nodes.textureSrc.connect(nodes.textureFilter);
        nodes.textureSrc.connect(nodes.windHighpass);
        nodes.textureSrc.start();nodes.noiseSrc.start();
        nodes.crackleSrc=ctx.createBufferSource();
        nodes.crackleSrc.buffer=createCrackleBuffer(ctx);nodes.crackleSrc.loop=true;
        nodes.crackleSrc.connect(nodes.crackleFilter);nodes.crackleSrc.start();
      }

      async function startNoiseSources() {
        if(ctx.audioWorklet && window.AudioWorkletNode) {
          try {
            await ctx.audioWorklet.addModule('./audio/noise-processor.js');
            const source=new window.AudioWorkletNode(ctx,'focus-continuous-noise',{
              numberOfInputs:0,numberOfOutputs:3,outputChannelCount:[2,2,2]
            });
            source.connect(nodes.brownGain,0);
            source.connect(nodes.textureFilter,1);
            source.connect(nodes.crackleFilter,2);
            source.connect(nodes.windHighpass,1);
            nodes.noiseWorklet=source;
            source.addEventListener('processorerror',()=>{
              source.disconnect();
              nodes.noiseWorklet=null;
              if(ctx.state!=='closed')startBufferedNoise();
            },{once:true});
            return;
          } catch (_) {
            // Browsers without worklet support or with a blocked module keep audio.
          }
        }
        startBufferedNoise();
      }


      function stereoCoefficients(value) {
        if(!Number.isFinite(value)||value<0||value>100)throw Error('Amplitud estéreo inválida.');
        const width=value/100;
        return {direct:(1+width)/2,cross:(1-width)/2};
      }
      function createStereoField(context,input,output,width=100) {
        const stereo=context.createGain();
        stereo.channelCount=2;stereo.channelCountMode='explicit';stereo.channelInterpretation='speakers';
        const splitter=context.createChannelSplitter(2),merger=context.createChannelMerger(2);
        const directL=context.createGain(),directR=context.createGain(),crossL=context.createGain(),crossR=context.createGain();
        input.connect(stereo);stereo.connect(splitter);
        splitter.connect(directL,0);splitter.connect(crossL,0);
        splitter.connect(directR,1);splitter.connect(crossR,1);
        directL.connect(merger,0,0);crossR.connect(merger,0,0);
        directR.connect(merger,0,1);crossL.connect(merger,0,1);
        merger.connect(output);
        let currentWidth=null;
        function setWidth(value,smooth=0.08) {
          const coefficients=stereoCoefficients(value);
          if(value===currentWidth)return;
          currentWidth=value;
          [[directL,coefficients.direct],[directR,coefficients.direct],[crossL,coefficients.cross],[crossR,coefficients.cross]].forEach(([node,target])=>{
            if(smooth>0){node.gain.cancelScheduledValues(context.currentTime);node.gain.setTargetAtTime(target,context.currentTime,smooth);}
            else node.gain.value=target;
          });
        }
        setWidth(width,0);
        return {setWidth};
      }

      function balanceCoefficients(value) {
        if(!Number.isInteger(value)||value<-100||value>100)throw Error('Balance inválido.');
        return {left:Math.min(1,1-value/100),right:Math.min(1,1+value/100)};
      }
      function balanceLabel(value=0) {
        return value===0?'Centro':Math.abs(value)+'% '+(value<0?'izquierda':'derecha');
      }
      function createChannelBalance(context,input,output,value=0) {
        const stereo=context.createGain();
        stereo.channelCount=2;stereo.channelCountMode='explicit';stereo.channelInterpretation='speakers';
        const splitter=context.createChannelSplitter(2),merger=context.createChannelMerger(2);
        const left=context.createGain(),right=context.createGain();
        input.connect(stereo);stereo.connect(splitter);
        splitter.connect(left,0);splitter.connect(right,1);
        left.connect(merger,0,0);right.connect(merger,0,1);merger.connect(output);
        let current=null;
        function setBalance(next,smooth=0.08) {
          const coefficients=balanceCoefficients(next);
          if(next===current)return;current=next;
          [[left,coefficients.left],[right,coefficients.right]].forEach(([node,target])=>{
            if(smooth>0){node.gain.cancelScheduledValues(context.currentTime);node.gain.setTargetAtTime(target,context.currentTime,smooth);}
            else node.gain.value=target;
          });
        }
        setBalance(value,0);return {setBalance};
      }

      async function initAudio() {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) throw new Error('Este navegador no admite Web Audio API.');

        ctx = new AudioContextClass({ latencyHint: 'playback' });
        if(ctx.state==='suspended')await ctx.resume();

        // Compresor / Limitador maestro
        nodes.comp = ctx.createDynamicsCompressor();
        nodes.comp.threshold.value = -18;
        nodes.comp.knee.value = 22;
        nodes.comp.ratio.value = 6;
        nodes.comp.attack.value = 0.012;
        nodes.comp.release.value = 0.35;

        nodes.fade = ctx.createGain();
        nodes.fade.gain.value = 0;
        nodes.master = ctx.createGain();
        nodes.master.gain.value = level('master');
        nodes.sessionGain = ctx.createGain();
        nodes.master.connect(nodes.sessionGain);
        nodes.closingGain=ctx.createGain();
        nodes.closingGain.gain.value=1;
        nodes.sessionGain.connect(nodes.closingGain);
        nodes.closingGain.connect(nodes.fade);
        nodes.balanceInput=ctx.createGain();
        nodes.stereoField=createStereoField(ctx,nodes.fade,nodes.balanceInput,studio.stereoWidth);
        nodes.channelBalance=createChannelBalance(ctx,nodes.balanceInput,nodes.comp,studio.balance);
        nodes.comp.connect(ctx.destination);

        // MediaStreamAudioDestinationNode para supervivencia del audio con pantalla apagada en móviles
        nodes.streamDest = ctx.createMediaStreamDestination();
        nodes.comp.connect(nodes.streamDest);

        const bgAudio = $('bg-audio');
        if (bgAudio) {
          bgAudio.srcObject = nodes.streamDest.stream;
        }

        setupMediaSession();

        // CAPA 1: Ruido marrón estéreo con doble modulación orgánica

        nodes.lp = ctx.createBiquadFilter();
        nodes.lp.type = 'lowpass';
        nodes.lp.frequency.value = 340;
        nodes.lp.Q.value = 0.65;

        nodes.lfo = ctx.createOscillator();
        nodes.lfo.type = 'sine';
        nodes.lfo.frequency.value = 0.065;
        nodes.lfoDepth = ctx.createGain();
        nodes.lfoDepth.gain.value = 185;
        nodes.lfo.connect(nodes.lfoDepth);
        nodes.lfoDepth.connect(nodes.lp.frequency);

        nodes.noiseGain = ctx.createGain();
        nodes.noiseGain.gain.value = level('noise');
        nodes.brownGain=ctx.createGain();
        nodes.textureGain=ctx.createGain();
        nodes.windGain=ctx.createGain();nodes.windGain.gain.value=0;
        nodes.windHighpass=ctx.createBiquadFilter();nodes.windHighpass.type='highpass';nodes.windHighpass.frequency.value=650;nodes.windHighpass.Q.value=0.5;
        nodes.windLowpass=ctx.createBiquadFilter();nodes.windLowpass.type='lowpass';nodes.windLowpass.Q.value=0.5;
        nodes.windHighpass.connect(nodes.windLowpass);
        nodes.windGust=createWindGust(ctx,nodes.windLowpass,nodes.windGain,studio.evolution);
        nodes.windGain.connect(nodes.noiseGain);
        nodes.crackleGain=ctx.createGain();
        nodes.crackleGain.gain.value=0;
        nodes.crackleFilter=ctx.createBiquadFilter();
        nodes.crackleFilter.type='lowpass';nodes.crackleFilter.frequency.value=3400;nodes.crackleFilter.Q.value=0.5;
        nodes.crackleFilter.connect(nodes.crackleGain);nodes.crackleGain.connect(nodes.noiseGain);
        nodes.textureFilter=ctx.createBiquadFilter();
        nodes.textureFilter.type='lowpass';
        nodes.textureFilter.Q.value=0.5;
        nodes.textureFilter.connect(nodes.textureGain);
        nodes.textureGain.connect(nodes.noiseGain);
        nodes.brownGain.connect(nodes.lp);
        nodes.lp.connect(nodes.noiseGain);
        nodes.noiseGain.connect(nodes.master);

        // CAPA 2: Drone armónico con apertura estéreo y filtro pasa-bajos cálido
        nodes.droneFilter = ctx.createBiquadFilter();
        nodes.droneFilter.type = 'lowpass';
        nodes.droneFilter.frequency.value = 420;
        nodes.droneFilter.Q.value = 0.5;

        nodes.droneLfo = ctx.createOscillator();
        nodes.droneLfo.type = 'sine';
        nodes.droneLfo.frequency.value = 0.04;
        nodes.droneLfoDepth = ctx.createGain();
        nodes.droneLfoDepth.gain.value = 110;
        nodes.droneLfo.connect(nodes.droneLfoDepth);
        nodes.droneLfoDepth.connect(nodes.droneFilter.frequency);

        nodes.droneGain = ctx.createGain();
        nodes.droneGain.gain.value = level('drone');
        nodes.droneFilter.connect(nodes.droneGain);
        nodes.droneGain.connect(nodes.master);

        const droneDefs = [
          { type: 'sine',     frequency: 55,  detune: 0,  amplitude: 0.32, pan: 0.0 },   // Sub-fundamental
          { type: 'sine',     frequency: 110, detune: -5, amplitude: 0.45, pan: -0.28 }, // Tónica izq
          { type: 'triangle', frequency: 165, detune: 5,  amplitude: 0.26, pan: 0.28 }   // Quinta der (filtrada)
        ];

        nodes.droneOscs = droneDefs.map((def) => {
          const osc = ctx.createOscillator();
          osc.type = def.type;
          osc.frequency.value = def.frequency;
          osc.detune.value = def.detune;
          const gain = ctx.createGain();
          gain.gain.value = def.amplitude;

          if (ctx.createStereoPanner) {
            const panner = ctx.createStereoPanner();
            panner.pan.value = def.pan;
            osc.connect(gain);
            gain.connect(panner);
            panner.connect(nodes.droneFilter);
          } else {
            osc.connect(gain);
            gain.connect(nodes.droneFilter);
          }
          return osc;
        });

        // CAPA 3: Notas pentatónicas con bus de reverberación paralela
        nodes.notesGain = ctx.createGain();
        nodes.notesGain.gain.value = level('notes');
        nodes.notesGain.connect(nodes.master);

        nodes.reverb = ctx.createConvolver();
        nodes.reverb.buffer = createWarmReverbImpulse(ctx);
        nodes.reverbWet = ctx.createGain();
        nodes.reverbWet.gain.value = 0.55;
        nodes.reverb.connect(nodes.reverbWet);
        nodes.reverbWet.connect(nodes.notesGain);

        await startNoiseSources();
        applyScene(0.05);
        nodes.lfo.start();
        nodes.droneLfo.start();
        nodes.droneOscs.forEach((osc) => osc.start());
        nodes.windGust.start();
      }

      function playNote() {
        if (!ctx || ctx.state !== 'running' || !nodes.notesGain || !studio.melody || isSilentRest()) return;
        let index;
        if(studio.evolution===0) {
          index=[0,2,4,2][noteStep++ % 4];
        } else if(lastNote<0) {
          index=0;
        } else {
          const leap=Math.random()<studio.evolution/250 ? 2 : 1;
          const direction=Math.random()<0.5 ? -1 : 1;
          index=lastNote+direction*leap;
          if(index<0 || index>=SCALE.length)index=lastNote-direction*leap;
        }
        lastNote=index;

        const start = ctx.currentTime;
        const attack = 0.85;
        const decay = 4.2;
        const end = start + attack + decay;

        const oscFund = ctx.createOscillator();
        const oscHarm = ctx.createOscillator();
        const harmGain = ctx.createGain();
        const envelope = ctx.createGain();

        const baseFreq = SCENES[studio.scene].root * [2, 2.378414, 2.66968, 3, 3.563595, 4, 4.756828][index];
        oscFund.type = 'sine';
        oscFund.frequency.value = baseFreq;
        oscFund.detune.value = (Math.random() - 0.5) * 6;

        // Armónico sutil de octava superior para timbre cristalino
        oscHarm.type = 'sine';
        oscHarm.frequency.value = baseFreq * 2;
        harmGain.gain.value = 0.12;

        envelope.gain.setValueAtTime(0.0001, start);
        envelope.gain.linearRampToValueAtTime(0.85, start + attack);
        envelope.gain.exponentialRampToValueAtTime(0.0001, end);

        oscFund.connect(envelope);
        oscHarm.connect(harmGain);
        harmGain.connect(envelope);

        let outputNode = envelope;
        if (ctx.createStereoPanner) {
          const panner = ctx.createStereoPanner();
          panner.pan.value = (Math.random() - 0.5) * 0.9; // Paneo suave entre -0.45 y +0.45
          envelope.connect(panner);
          outputNode = panner;
        }

        // Señal directa + envío a reverberación
        outputNode.connect(nodes.notesGain);
        if (nodes.reverb) outputNode.connect(nodes.reverb);

        oscFund.addEventListener('ended', () => {
          outputNode.disconnect();
          envelope.disconnect();
          harmGain.disconnect();
          oscFund.disconnect();
          oscHarm.disconnect();
        }, { once: true });

        oscFund.start(start);
        oscHarm.start(start);
        oscFund.stop(end + 0.1);
        oscHarm.stop(end + 0.1);
      }


      function noteDelaySeconds(interval,evolution,pace='normal',random=Math.random()) {
        const factors={sparse:2,normal:1,frequent:.75};
        if(!Number.isFinite(interval)||interval<=0||!Number.isFinite(evolution)||evolution<0||evolution>100||!Object.prototype.hasOwnProperty.call(factors,pace)||!Number.isFinite(random)||random<0||random>1)throw Error('Ritmo de notas inválido.');
        return interval*factors[pace]*(1+random*evolution/100);
      }
      function scheduleNextNote() {
        clearTimeout(noteTimer);noteTimer=null;
        if (!playing || !studio.melody || isSilentRest()) return;
        const delay=noteDelaySeconds(SCENES[studio.scene].interval,studio.evolution,studio.notePace)*1000;
        noteTimer = window.setTimeout(() => {
          if (!playing || !studio.melody || isSilentRest()) return;
          playNote();
          scheduleNextNote();
        }, delay);
      }

      function formatSeconds(totalSecs) {
        const safe = Math.max(0, Math.floor(totalSecs));
        const hours = Math.floor(safe / 3600);
        const minutes = Math.floor((safe % 3600) / 60);
        const seconds = safe % 60;
        return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
      }

      function renderTimer() {
        const elapsedSecs = Math.floor(accumulatedMs / 1000);
        if (targetDurationMinutes > 0) {
          const targetSecs = targetDurationMinutes * 60;
          const remaining = Math.max(0, targetSecs - elapsedSecs);
          timerEl.textContent = formatSeconds(remaining);
          if (remaining === 0 && playing) {
            if(cycleState.plan!=='single')cycleState.completed=true;
            pause(true); // Cierre suave automático al cumplir el objetivo
          }
        } else {
          timerEl.textContent = formatSeconds(elapsedSecs);
        }
        $('mobile-timer').textContent=timerEl.textContent;
        syncExtensionUI();
      }

      function advanceSessionClock() {
        if(!playing||lastTickTimestamp<=0)return;
        const now=Date.now();
        accumulatedMs+=Math.max(0,now-lastTickTimestamp);
        if(targetDurationMinutes>0)accumulatedMs=Math.min(accumulatedMs,targetDurationMinutes*60000);
        lastTickTimestamp=now;
      }
      function startSessionClock() {
        clearInterval(elapsedTimer);
        lastTickTimestamp = Date.now();
        elapsedTimer = window.setInterval(() => {
          if (!playing) return;
          advanceSessionClock();
          applyScene();
          renderTimer();
          syncFocusHistoryProgress();
          saveSession();
        }, 500);
      }

      function stopSessionClock() {
        advanceSessionClock();
        lastTickTimestamp = 0;
        clearInterval(elapsedTimer);
        elapsedTimer = null;
        syncFocusHistoryProgress(true);
        saveSession(true);
      }

      function syncUI() {
        btn.setAttribute('aria-pressed', String(playing));
        btn.setAttribute('aria-label', playing ? 'Pausar paisaje sonoro' : 'Iniciar paisaje sonoro');
        syncCycleUI();
        const action=cycleAction();
        playLabel.textContent = playing ? 'Pausar' : action.text;
        btn.setAttribute('aria-label',playing?(isSilentRest()?'Pausar descanso':'Pausar paisaje sonoro'):action.label);
        playIcon.innerHTML = playing
          ? '<path d="M7 5.5h3.6v13H7zM13.4 5.5H17v13h-3.6z"/>'
          : '<path d="M8 5.8c0-.8.9-1.3 1.6-.9l9 6.2a1.1 1.1 0 0 1 0 1.8l-9 6.2c-.7.5-1.6 0-1.6-.9V5.8Z"/>';
        statusText.textContent = playing ? (isSilentRest()?'Descanso en silencio':'Sonando') : cycleState.plan!=='single'&&cycleState.completed?'Tramo terminado':'En pausa';
        statusPill.dataset.playing = String(playing);
        playerCard.classList.toggle('is-playing', playing);
        syncUpdateButton();
        syncBackupButtons();
        syncSharedMixButton();
        btn.disabled = transitioning;
        const mobileToggle=$('mobile-toggle');
        mobileToggle.disabled=transitioning;
        mobileToggle.textContent=playing ? 'Pausar' : action.text;
        mobileToggle.setAttribute('aria-label',playing ? (isSilentRest()?'Pausar descanso':'Pausar paisaje sonoro') : action.label);
        mobileToggle.setAttribute('aria-pressed',String(playing));

        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
        }
      }

      function showError(message) {
        errorEl.textContent = message;
        errorEl.dataset.visible = 'true';
      }

      function hideError() {
        errorEl.textContent = '';
        errorEl.dataset.visible = 'false';
      }

      async function play() {
        if (playing || transitioning) return;
        if(cycleState.plan!=='single'&&cycleState.completed) {
          cycleState=cycleTools.next(cycleState);
          targetDurationMinutes=cycleTools.duration(cycleState);
          accumulatedMs=0;sessionRecordedMs=0;renderTimer();saveSession(true);
        }
        transitioning = true;
        hideError();
        if (targetDurationMinutes > 0 && accumulatedMs >= targetDurationMinutes * 60000) {
          accumulatedMs = 0;
          sessionRecordedMs = 0;
          $('extension-status').textContent='';
        }
        syncUI();
        try {
          if (!ctx) await initAudio();
          clearTimeout(suspendTimer);
          if (ctx.state !== 'running') await ctx.resume();
          playing = true;
          $('resume-status').textContent='';
          $('session-feedback').hidden=true;
          $('feedback-status').textContent='';
          applyScene(0.05);
          scheduleSessionClosing(ctx,nodes.closingGain.gain,accumulatedMs,targetDurationMinutes,studio.fadeOutSeconds,isSilentRest());
          scheduleSessionEntry(ctx,nodes.sessionGain.gain,accumulatedMs,studio.fadeInSeconds,isSilentRest());
          ramp(nodes.fade.gain, 1, 0.65);
          playNote();
          scheduleNextNote();
          startSessionClock();

          // Sincronizar elemento de audio enlazado al stream para background playback
          const bgAudio = $('bg-audio');
          if (bgAudio) {
            bgAudio.play().catch(() => {});
          }

          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
          }

          requestWakeLock();
        } catch (error) {
          playing = false;
          stopSessionClock();
          showError(error && error.message ? error.message : 'No se pudo iniciar el audio.');
        } finally {
          transitioning = false;
          syncUI();
        }
      }

      function pause(slowFade = false) {
        if (!playing || transitioning) return;
        stopSessionClock();
        const reachedEnd=targetDurationMinutes>0&&accumulatedMs>=targetDurationMinutes*60000;
        if(reachedEnd&&cycleState.plan!=='single'){cycleState.completed=true;saveSession(true);}
        if((slowFade||reachedEnd) && cycleState.phase==='focus') {
          feedbackSession={date:new Date().toISOString(),...studio,minutes:Math.round(accumulatedMs/60000)};
          $('session-feedback').hidden=false;
        }
        playing = false;
        clearTimeout(noteTimer);
        noteTimer = null;
        const fadeTime = slowFade ? 1.8 : 0.14;
        ramp(nodes.fade && nodes.fade.gain, 0, fadeTime);

        // Pausar elemento de audio auxiliar y wake lock
        const bgAudio = $('bg-audio');
        if (bgAudio) {
          bgAudio.pause();
        }

        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'paused';
        }

        releaseWakeLock();

        syncUI();
        clearTimeout(suspendTimer);
        suspendTimer = window.setTimeout(() => {
          if (!playing && ctx && ctx.state === 'running') {
            ctx.suspend().catch(() => {});
          }
        }, slowFade ? 4500 : 750);
      }

      function updateRange(id, save = true) {
        const input = $('vol-' + id);
        const output = $('out-' + id);
        const value = Number(input.value);
        output.textContent = value + '%';
        input.style.setProperty('--progress', value + '%');
        const paramMap = {
          master: () => nodes.master && nodes.master.gain,
          noise:  () => nodes.noiseGain && nodes.noiseGain.gain,
          drone:  () => nodes.droneGain && nodes.droneGain.gain,
          notes:  () => nodes.notesGain && nodes.notesGain.gain
        };
        const param = paramMap[id]();
        if (param && ctx && ctx.state !== 'closed') ramp(param, level(id), 0.06);
        if (save) persistSettings();
        syncPresetState();
      }

      function loadSettings() {
        let saved = null;
        try { saved = JSON.parse(storage.getItem('focus-audio-settings-v2') || 'null'); }
        catch (_) { saved = null; }
        Object.keys(DEFAULTS).forEach((id) => {
          const value = saved && Number.isFinite(saved[id]) ? Math.max(0, Math.min(100, saved[id])) : DEFAULTS[id];
          $('vol-' + id).value = value;
          updateRange(id, false);
        });
      }

      function persistSettings() {
        const settings = {};
        Object.keys(DEFAULTS).forEach((id) => { settings[id] = Number($('vol-' + id).value); });
        try { storage.setItem('focus-audio-settings-v2', JSON.stringify(settings)); return true; }
        catch (_) {return false;}
      }

      function syncPresetState() {
        document.querySelectorAll('[data-preset]').forEach((button) => {
          const preset = PRESETS[button.dataset.preset];
          const selected = preset && Object.keys(DEFAULTS).every((id) => Number($('vol-' + id).value) === preset[id]);
          button.setAttribute('aria-pressed', String(Boolean(selected)));
        });
      }

      document.querySelectorAll('.range').forEach((input) => {
        const id = input.id.replace('vol-', '');
        input.addEventListener('input', () => updateRange(id));
      });

      document.querySelectorAll('[data-preset]').forEach((button) => {
        button.addEventListener('click', () => {
          const values = PRESETS[button.dataset.preset];
          if (!values) return;
          Object.keys(values).forEach((id) => {
            $('vol-' + id).value = values[id];
            updateRange(id, false);
          });
          persistSettings();
          syncPresetState();
        });
      });

      document.querySelectorAll('.mode-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          if(cycleState.plan!=='single')return;
          resetCycle('single',Number(chip.dataset.minutes)||0);
          if(playing)lastTickTimestamp=Date.now();
        });
      });
      function applyCustomDuration() {
        if(playing||transitioning||cycleState.plan!=='single')return;
        const raw=$('custom-minutes').value.trim(),minutes=Number(raw);
        if(!raw||!cycleTools.validDuration(minutes)||minutes<1) {
          $('custom-duration-status').textContent='Ingresá un número entero de 1 a 180 minutos.';
          $('custom-minutes').setAttribute('aria-invalid','true');
          return;
        }
        $('custom-minutes').setAttribute('aria-invalid','false');
        resetCycle('single',minutes);
        $('custom-duration-status').textContent='Duración aplicada: '+minutes+' minutos. Tocá Iniciar cuando quieras.';
      }
      $('apply-duration').addEventListener('click',applyCustomDuration);
      $('custom-minutes').addEventListener('keydown',event=>{
        if(event.key==='Enter'){event.preventDefault();applyCustomDuration();}
      });

      btn.addEventListener('click', () => (playing ? pause() : play()));
      $('mobile-toggle').addEventListener('click', () => (playing ? pause() : play()));
      // CSS limits the dock to mobile; the observer follows the original play button.
      if ('IntersectionObserver' in window) {
        const observer = new window.IntersectionObserver(([entry]) => {
          $('mobile-player').hidden=entry.isIntersecting;
        }, {threshold:0});
        observer.observe(btn);
      } else {
        $('mobile-player').hidden=false;
      }
      $('reset-timer').addEventListener('click', () => {
        $('extension-status').textContent='';
        advanceSessionClock();
        cycleState={...cycleState,completed:false};
        syncCycleUI();
        syncFocusHistoryProgress(true);
        sessionRecordedMs = 0;
        accumulatedMs = 0;
        saveSession(true);
        $('resume-status').textContent='';
        if (playing) {
          lastTickTimestamp = Date.now();
          scheduleSessionClosing(ctx,nodes.closingGain.gain,0,targetDurationMinutes,studio.fadeOutSeconds,isSilentRest(),true);
          scheduleSessionEntry(ctx,nodes.sessionGain.gain,0,studio.fadeInSeconds,isSilentRest(),true);
        }
        renderTimer();
        syncUI();
      });

      // ==========================================
      // SECCIÓN DE DATOS: HISTORIAL DE HÁBITOS DE FOCO (SVG NATIVO)
      // ==========================================
      const HISTORY_STORAGE_KEY = 'focus-daily-history-v1';
      let sessionRecordedMs = 0;
      let dailyHistory = null;

      function getTodayKey() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }

      function getInitialHistory() {
        return {};
      }

      function loadHistory() {
        try {
          const raw = storage.getItem(HISTORY_STORAGE_KEY);
          if (raw) {
            dailyHistory = JSON.parse(raw);
          }
        } catch (_) {
          dailyHistory = null;
        }
        if (!dailyHistory || typeof dailyHistory !== 'object') {
          dailyHistory = getInitialHistory();
          persistHistory();
        }
        const todayKey = getTodayKey();
        if (typeof dailyHistory[todayKey] !== 'number') {
          dailyHistory[todayKey] = 0;
          persistHistory();
        }
      }

      function persistHistory() {
        try {
          storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(dailyHistory));
        } catch (_) {}
      }

      function addFocusSecondsToToday(seconds) {
        if (seconds <= 0) return;
        const todayKey = getTodayKey();
        if (typeof dailyHistory[todayKey] !== 'number') {
          dailyHistory[todayKey] = 0;
        }
        dailyHistory[todayKey] = Math.round((dailyHistory[todayKey] + seconds / 60) * 10) / 10;
        persistHistory();
      }

      function syncFocusHistoryProgress(flush = false) {
        const currentMs = accumulatedMs;
        if(isSilentRest()){sessionRecordedMs=currentMs;return;}
        const deltaMs = currentMs - sessionRecordedMs;
        if (deltaMs >= (flush ? 1000 : 5000)) {
          const deltaSecs = Math.floor(deltaMs / 1000);
          sessionRecordedMs += deltaSecs * 1000;
          addFocusSecondsToToday(deltaSecs);
          renderHistoryChart();
        }
      }

      function getLast7DaysData() {
        const days = [];
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const now = new Date();
        const todayKey = getTodayKey();

        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const isToday = (key === todayKey);
          const mins = Math.round(Number(dailyHistory[key]) || 0);
          days.push({
            dateKey: key,
            dayLabel: isToday ? 'Hoy' : dayNames[d.getDay()],
            dayNum: `${d.getDate()}/${d.getMonth() + 1}`,
            minutes: mins,
            isToday
          });
        }
        return days;
      }

      function calculateStreak(days) {
        let streak = 0;
        for (let i = days.length - 1; i >= 0; i--) {
          if (days[i].minutes > 0) {
            streak++;
          } else if (days[i].isToday) {
            continue;
          } else {
            break;
          }
        }
        return streak;
      }

      function renderHistoryChart() {
        const svg = $('history-svg');
        if (!svg) return;

        const days = getLast7DaysData();
        const totalMinutes = days.reduce((sum, d) => sum + d.minutes, 0);
        const avgMinutes = Math.round(totalMinutes / days.length);
        const streak = calculateStreak(days);
        const todayMinutes = days[days.length - 1].minutes;

        const elTotal = $('metric-total');
        const elAvg = $('metric-avg');
        const elToday = $('metric-today');
        const elStreak = $('hist-streak-chip');

        if (elTotal) elTotal.textContent = `${totalMinutes} min`;
        if (elAvg) elAvg.textContent = `${avgMinutes} min`;
        if (elToday) elToday.textContent = `${todayMinutes} min`;
        if (elStreak) elStreak.textContent = `🔥 Racha: ${streak} ${streak === 1 ? 'día' : 'días'}`;

        const svgW = 680;
        const svgH = 180;
        const padL = 46;
        const padR = 20;
        const padT = 24;
        const padB = 42;
        const plotW = svgW - padL - padR;
        const plotH = svgH - padT - padB;

        const maxRecorded = Math.max(...days.map(d => d.minutes), 0);
        const gridMax = Math.max(60, Math.ceil((maxRecorded * 1.15) / 15) * 15);
        const gridSteps = [
          { val: Math.round(gridMax * 0.33), y: padT + plotH - (gridMax * 0.33 / gridMax) * plotH },
          { val: Math.round(gridMax * 0.66), y: padT + plotH - (gridMax * 0.66 / gridMax) * plotH },
          { val: gridMax,                    y: padT + plotH - (gridMax / gridMax) * plotH }
        ];

        let content = `
          <defs>
            <linearGradient id="barGradPrev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#9bb4ff" stop-opacity="0.95"/>
              <stop offset="100%" stop-color="#5573ca" stop-opacity="0.8"/>
            </linearGradient>
            <linearGradient id="barGradToday" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#8ce5c5" stop-opacity="1"/>
              <stop offset="100%" stop-color="#46a386" stop-opacity="0.85"/>
            </linearGradient>
            <filter id="glowToday" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#8ce5c5" flood-opacity="0.45"/>
            </filter>
          </defs>
        `;

        gridSteps.forEach(step => {
          content += `
            <line x1="${padL}" y1="${step.y.toFixed(1)}" x2="${svgW - padR}" y2="${step.y.toFixed(1)}" stroke="rgba(161, 178, 219, 0.12)" stroke-dasharray="3 3"/>
            <text x="${padL - 8}" y="${(step.y + 3.5).toFixed(1)}" font-size="9" fill="#717c96" text-anchor="end" font-variant-numeric="tabular-nums">${step.val}m</text>
          `;
        });

        content += `<line x1="${padL}" y1="${padT + plotH}" x2="${svgW - padR}" y2="${padT + plotH}" stroke="rgba(161, 178, 219, 0.22)"/>`;

        const slotW = plotW / days.length;
        const barW = Math.min(42, slotW * 0.58);

        days.forEach((d, i) => {
          const cx = padL + i * slotW + slotW / 2;
          const barX = cx - barW / 2;
          const trackY = padT;
          const trackH = plotH;

          content += `<rect x="${barX.toFixed(1)}" y="${trackY}" width="${barW}" height="${trackH}" rx="7" fill="rgba(155, 180, 255, 0.035)"/>`;

          if (d.minutes > 0) {
            const barH = Math.max(5, (d.minutes / gridMax) * plotH);
            const barY = padT + plotH - barH;
            const gradId = d.isToday ? 'url(#barGradToday)' : 'url(#barGradPrev)';
            const filterAttr = d.isToday ? 'filter="url(#glowToday)"' : '';
            content += `<rect x="${barX.toFixed(1)}" y="${barY.toFixed(1)}" width="${barW}" height="${barH.toFixed(1)}" rx="6" fill="${gradId}" ${filterAttr}/>`;

            const labelY = Math.max(padT - 7, barY - 6);
            content += `<text x="${cx.toFixed(1)}" y="${labelY.toFixed(1)}" font-size="10" font-weight="700" fill="${d.isToday ? '#c7f5e4' : '#c0d0ff'}" text-anchor="middle" font-variant-numeric="tabular-nums">${d.minutes}m</text>`;
          } else {
            content += `<text x="${cx.toFixed(1)}" y="${padT + plotH - 6}" font-size="10" fill="#58637c" text-anchor="middle">0m</text>`;
          }

          const dayColor = d.isToday ? '#8ce5c5' : '#8e98b0';
          const dayWeight = d.isToday ? '750' : '550';
          content += `<text x="${cx.toFixed(1)}" y="${(padT + plotH + 16).toFixed(1)}" font-size="11" font-weight="${dayWeight}" fill="${dayColor}" text-anchor="middle">${d.dayLabel}</text>`;
          content += `<text x="${cx.toFixed(1)}" y="${(padT + plotH + 29).toFixed(1)}" font-size="9" fill="${d.isToday ? '#8ce5c5' : '#59657f'}" text-anchor="middle">${d.dayNum}</text>`;
        });

        svg.innerHTML = content;
      }

      const btnSimulated = $('btn-add-simulated');
      if (btnSimulated) {
        btnSimulated.addEventListener('click', () => {
          addFocusSecondsToToday(15 * 60);
          renderHistoryChart();
        });
      }

      const btnResetHistory = $('btn-reset-history');
      if (btnResetHistory) {
        btnResetHistory.addEventListener('click', () => {
          dailyHistory = {};
          const todayKey = getTodayKey();
          dailyHistory[todayKey] = 0;
          persistHistory();
          renderHistoryChart();
        });
      }


      let focusView=false;
      function setFocusView(enabled) {
        focusView=Boolean(enabled);
        document.body.dataset.focusView=String(focusView);
        const control=$('focus-view-toggle');
        control.setAttribute('aria-pressed',String(focusView));
        control.textContent=focusView?'Ver todos los controles':'Vista de concentración';
        $('focus-view-scene').hidden=!focusView;
        syncSceneLabels();
      }
      $('focus-view-toggle').addEventListener('click',()=>setFocusView(!focusView));

      document.addEventListener('keydown', (event) => {
        if(event.key==='Escape'&&focusView) {
          event.preventDefault();setFocusView(false);$('focus-view-toggle').focus();return;
        }
        if (event.repeat) return;
        const target = event.target;
        if (target instanceof HTMLElement && target.matches('input, button, textarea, select, a, [contenteditable="true"]')) return;

        if (event.code === 'Space') {
          event.preventDefault();
          playing ? pause() : play();
        } else if (event.key === 'm' || event.key === 'M') {
          event.preventDefault();
          const masterInput = $('vol-master');
          if (!muted && Number(masterInput.value) > 0) {
            preMuteMaster = Number(masterInput.value);
            muted = true;
            masterInput.value = 0;
          } else {
            muted = false;
            masterInput.value = preMuteMaster || 75;
          }
          updateRange('master');
        }
      });

      document.addEventListener('visibilitychange', async () => {
        if (!document.hidden && playing) {
          advanceSessionClock();
          applyScene();
          renderTimer();
          if(playing)await requestWakeLock();
        }
      });

      window.addEventListener('pagehide', () => {
        clearTimeout(noteTimer);
        clearTimeout(suspendTimer);
        if(!reloadingAfterRestore)stopSessionClock();
        releaseWakeLock();
        if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
      });

      setupInstallAndUpdates();

      loadSettings();
      initStudio();
      setupResponsivePanels();
      loadHistory();
      restoreSession();
      initInsights();
      initBackups();
      initCycles();

      // Soporte para accesos directos PWA (shortcuts)
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const modeParam = Number(urlParams.get('duration') || urlParams.get('mode'));
        if (modeParam > 0 && cycleTools.validDuration(modeParam)) {
          cycleState=cycleTools.initial('single',modeParam);
          targetDurationMinutes = modeParam;
          $('custom-minutes').value=modeParam;
          accumulatedMs=0;sessionRecordedMs=0;
          $('resume-status').textContent='';
          document.querySelectorAll('.mode-chip').forEach((c) => {
            c.setAttribute('aria-pressed', String(Number(c.dataset.minutes) === modeParam));
          });
          modeLabelEl.textContent = `Cuenta regresiva (${modeParam} min)`;
          saveSession(true);
        }
      } catch (_) {}

      initSharedMix();
      renderTimer();
      renderHistoryChart();
      syncUI();
    }