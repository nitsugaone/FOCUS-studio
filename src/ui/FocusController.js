import {SessionPersistence} from '../session/SessionPersistence.js';
import {createSharedMixController} from './SharedMixController.js';
import {createBackupController} from './BackupController.js';
import {createInsightsController} from './InsightsController.js';
import {createPwaController} from './PwaController.js';
import {createBrowserPlaybackServices} from './BrowserPlaybackServices.js';
import {createDailyHistory} from '../storage/DailyHistory.js';
import {createPlaybackController} from './PlaybackController.js';
import {ListeningProgress} from '../session/ListeningProgress.js';
import {createSessionExtensionController} from './SessionExtensionController.js';
import {createMixLibraryController} from './MixLibraryController.js';
import {validStudio,mixSearchIndices,createMixCopy} from '../storage/mixes.js';
import {createResponsiveController} from './ResponsiveController.js';
import {createHistoryView} from './HistoryView.js';
import {SessionClock} from '../session/SessionClock.js';
import {FocusAudioEngine} from '../audio/FocusAudioEngine.js';
import {SCENES} from '../audio/scenes.js';
import {entryEnvelope,sessionEnvelope,balanceLabel} from '../audio/dsp.js';
import {StorageService} from '../storage/StorageService.js';
import {createCycleTools,isSilentRestState} from '../session/cycles.js';

export function startFocusApp({
  window=globalThis.window,document=globalThis.document,navigator=globalThis.navigator,
  localStorage=globalThis.localStorage,Option=globalThis.Option,
  clearTimeout=globalThis.clearTimeout,clearInterval=globalThis.clearInterval,
  URL=globalThis.URL,Blob=globalThis.Blob
}={}) {

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

      const engine=new FocusAudioEngine({platform:window,clearTimeout});
      let playing = false;
      let transitioning = false;
      let muted = false;
      let preMuteMaster = 75;


      // Reloj de alta precisión basado en timestamps reales (inmune a background tab throttling)
      const clock=new SessionClock({now:()=>Date.now(),setInterval:(fn,ms)=>window.setInterval(fn,ms),clearInterval});

      const listeningProgress=new ListeningProgress();
      const cycleTools=createCycleTools();
      let cycleState=cycleTools.initial();

      const STUDIO_KEY = 'focus-studio-v3';
      let studio = {scene:'rain',evolution:35,brightness:50,melody:true,stereoWidth:100,balance:0,notePace:'normal',fadeOutSeconds:20,fadeInSeconds:12,preserveMix:false,restSound:'sound'};
      const mixState={mixes:[],deletionUndo:null};
      let feedbackSession = null;
      const storage=new StorageService(localStorage);
      function readLocal(key,fallback) { return storage.read(key,fallback); }
      function writeLocal(key,value) {
        const saved=storage.write(key,value);
        if(!saved)$('studio-status').textContent='No se pudo guardar en este dispositivo.';
        return saved;
      }

      function syncEntryUI() {
        $('fade-in').value=String(studio.fadeInSeconds);
        $('fade-in').disabled=playing||transitioning;
        $('fade-in-hint').textContent=(studio.fadeInSeconds?'Alcanza el volumen elegido en '+studio.fadeInSeconds+' segundos al iniciar el tramo.':'Sin entrada gradual adicional.')+(playing||transitioning?' Pausá para cambiarla.':' Se conserva al pausar y continuar.');
      }

      function syncFadeUI() {
        $('fade-out').value=String(studio.fadeOutSeconds);
        $('fade-out').disabled=playing||transitioning||clock.durationMinutes===0;
        const seconds=clock.durationMinutes?Math.min(studio.fadeOutSeconds,clock.durationMinutes*30):0;
        $('fade-out-hint').textContent=!clock.durationMinutes?'Disponible en sesiones con duración y en ciclos. Se conserva tu elección.':'El volumen baja en los últimos '+seconds+' segundos del tramo.'+(seconds<studio.fadeOutSeconds?' El cierre se limita a la mitad de este tramo.':'')+(playing||transitioning?' Pausá para cambiarlo.':'');
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

      function configureAudio() {
        engine.configure(studio,Object.fromEntries(Object.keys(DEFAULTS).map(id=>[id,Number($('vol-'+id).value)])),{
          elapsedMs:clock.elapsedMs,durationMinutes:clock.durationMinutes,silent:isSilentRest()
        });
      }
      function scheduleAudioClosing(smooth=false) {configureAudio();engine.scheduleClosing(smooth);}
      function scheduleAudioEntry(smooth=false) {configureAudio();engine.scheduleEntry(smooth);}
      function applyScene(smooth=1.5) {
        syncStudio();configureAudio();engine.applyScene(smooth);
        if(!engine.initialized())return;
        const progress=clock.durationMinutes?Math.min(1,clock.elapsedMs/(clock.durationMinutes*60000)):0;
        // Audio automation owns the envelopes; the timer only updates their caption.
        const {exit}=sessionEnvelope(clock.elapsedMs,clock.durationMinutes,studio.fadeOutSeconds);
        const entry=entryEnvelope(clock.elapsedMs,studio.fadeInSeconds);
        $('session-phase').textContent=isSilentRest()?'Descanso en silencio':exit<1 ? 'Cierre gradual' : entry<1 ? 'Entrada suave' : cycleState.plan!=='single'&&cycleState.phase==='rest' ? 'Descanso sostenido' : progress>0 ? 'Concentración sostenida' : 'Sesión libre';

      }

      function selectedMixIndex() {
        const value=$('saved-mixes').value;
        return value!=='' && mixState.mixes[Number(value)] ? Number(value) : -1;
      }

      function renderMixes(selected='') {
        const select=$('saved-mixes');select.replaceChildren(new Option('Elegí una mezcla',''));
        const favorites=$('favorite-mixes');favorites.replaceChildren();
        const query=$('mix-search').value,indices=mixSearchIndices(mixState.mixes,query);
        indices.forEach(i=>{
          const mix=mixState.mixes[i];
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
        $('mix-search-status').textContent=!mixState.mixes.length?'Todavía no guardaste mezclas.':!indices.length?'No hay mezclas que coincidan. Probá con otro nombre.':indices.length+' de '+mixState.mixes.length+' mezclas';
        syncMixActions();syncMixUndoUI();
      }
      function syncMixActions() {
        const index=selectedMixIndex(), mix=mixState.mixes[index];
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
        return {...studio,name,favorite,cyclePlan:cycleState.plan,duration:cycleState.plan==='single'?clock.durationMinutes:cycleTools.plans[cycleState.plan].focus,
          levels:Object.fromEntries(Object.keys(DEFAULTS).map(k=>[k,Number($('vol-'+k).value)]))};
      }

      const {syncMixUndoUI,commitMixes,deleteSelectedMix,undoMixDeletion}=createMixLibraryController({
        state:mixState,$,writeLocal,renderMixes,selectedMixIndex
      });
      // Only crossing the breakpoint resets panels. Manual toggles within a
      // layout remain untouched, and playback nodes are never recreated.
      const setupResponsivePanels=createResponsiveController({window,$});

      function initStudio() {
        const loaded=readLocal(STUDIO_KEY,null);
        if(validStudio(loaded)) studio={scene:loaded.scene,evolution:loaded.evolution,brightness:loaded.brightness,melody:loaded.melody,stereoWidth:loaded.stereoWidth??100,balance:loaded.balance??0,notePace:loaded.notePace??'normal',fadeOutSeconds:loaded.fadeOutSeconds??20,fadeInSeconds:loaded.fadeInSeconds??12,preserveMix:loaded.preserveMix??false,restSound:loaded.restSound??'sound'};
        const mixes=readLocal('focus-mixes-v3',[]);
        mixState.mixes=Array.isArray(mixes) ? mixes.filter(m=>validStudio(m)&&typeof m.name==='string'&&m.levels&&Object.keys(DEFAULTS).every(k=>Number.isFinite(m.levels[k])&&m.levels[k]>=0&&m.levels[k]<=100)).slice(0,50) : [];
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
            if(playing||transitioning||!clock.durationMinutes||![5,20,60].includes(value)){syncFadeUI();return;}
            studio.fadeOutSeconds=value;
          }
          if(id==='rest-sound') {
            const value=$('rest-sound').value;
            if(playing||transitioning||cycleState.plan==='single'||!['sound','silent'].includes(value)){syncRestSoundUI();return;}
            syncFocusHistoryProgress(true);studio.restSound=value;
          }
          if(id==='preserve-mix')studio.preserveMix=$('preserve-mix').checked;
          if(id==='soundscape') {
            engine.resetNotes();
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
          if(playing&&['soundscape','melody','note-pace'].includes(id))engine.restartNotes();
        }));
        $('center-balance').addEventListener('click',()=>{
          studio.balance=0;applyScene();writeLocal(STUDIO_KEY,studio);
        });
        $('save-mix').addEventListener('click',()=>{
          const name=$('preset-name').value.trim(); if(!name){$('studio-status').textContent='Escribí un nombre para tu mezcla.';return;}
          if(mixState.mixes.length>=50){$('studio-status').textContent='Podés guardar hasta 50 mezclas.';return;}
          if(commitMixes([...mixState.mixes,currentMix(name)],String(mixState.mixes.length),true))$('studio-status').textContent='Mezcla guardada.';
        });
        $('load-mix').addEventListener('click',()=>{
          if($('saved-mixes').value==='')return;
          const mix=mixState.mixes[Number($('saved-mixes').value)];if(!mix)return;
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
          const mix=mixState.mixes[selectedMixIndex()];
          if(mix)$('preset-name').value=mix.name;
        });
        $('update-mix').addEventListener('click',()=>{
          const i=selectedMixIndex();if(i<0)return;
          const next=mixState.mixes.map((mix,j)=>j===i?currentMix(mix.name,mix.favorite===true):mix);
          if(commitMixes(next,String(i)))$('studio-status').textContent='Ajustes de la mezcla actualizados.';
        });
        $('duplicate-mix').addEventListener('click',()=>{
          const index=selectedMixIndex();if(index<0)return;
          try {
            const copy=createMixCopy(mixState.mixes,index);
            if(commitMixes([...mixState.mixes,copy],String(mixState.mixes.length),true)){
              $('preset-name').value=copy.name;
              $('studio-status').textContent='Copia guardada. Cargala en pausa para editar su sonido.';
            }
          }catch(error){$('studio-status').textContent=error.message;}
        });
        $('rename-mix').addEventListener('click',()=>{
          const i=selectedMixIndex(),name=$('preset-name').value.trim();if(i<0)return;
          if(!name){$('studio-status').textContent='Escribí el nuevo nombre.';return;}
          if(commitMixes(mixState.mixes.map((mix,j)=>j===i?{...mix,name}:mix),String(i),true))$('studio-status').textContent='Mezcla renombrada.';
        });
        $('favorite-mix').addEventListener('click',()=>{
          const i=selectedMixIndex();if(i<0)return;
          commitMixes(mixState.mixes.map((mix,j)=>j===i?{...mix,favorite:mix.favorite!==true}:mix),String(i));
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

      const {renderInsights,initInsights}=createInsightsController({document,$,storage});

      let reloadingAfterRestore=false;

      function applySharedMix(mix) {
        studio={scene:mix.scene,evolution:mix.evolution,brightness:mix.brightness,melody:mix.melody,stereoWidth:mix.stereoWidth??100,balance:mix.balance??0,notePace:mix.notePace??'normal',fadeOutSeconds:mix.fadeOutSeconds??20,fadeInSeconds:mix.fadeInSeconds??12,preserveMix:mix.preserveMix??false,restSound:mix.restSound??'sound'};
        Object.keys(DEFAULTS).forEach(key=>{$('vol-'+key).value=mix.levels[key];updateRange(key,false);});
        const sessionSaved=resetCycle(mix.cyclePlan,mix.cyclePlan==='single'?mix.duration:cycleState.singleDuration);
        applyScene();
        const levelsSaved=persistSettings(),studioSaved=writeLocal(STUDIO_KEY,studio);
        return {sessionSaved,levelsSaved,studioSaved};
      }
      const {syncSharedMixButton,initSharedMix}=createSharedMixController({
        window,navigator,$,getPlaybackState:()=>({playing,transitioning}),currentMix,applySharedMix,
        clearFeedback:()=>{$('session-feedback').hidden=true;feedbackSession=null;$('feedback-status').textContent='';}
      });

      const {syncBackupButtons,initBackups}=createBackupController({
        window,document,$,storage,URL,Blob,getPlaybackState:()=>({playing,transitioning}),
        reloadAfterRestore:()=>{reloadingAfterRestore=true;window.location.reload();}
      });

      function cycleAction() {
        if(cycleState.plan==='single'||!cycleState.completed)return {text:'Iniciar',label:isSilentRest()?'Iniciar descanso en silencio':'Iniciar paisaje sonoro'};
        const next=cycleTools.next(cycleState),last=next.round===1&&next.phase==='focus';
        return {text:last?'Repetir':next.phase==='rest'?'Descansar':'Siguiente',
          label:(last?'Repetir ciclo: ': 'Iniciar ')+(next.phase==='rest'?(studio.restSound==='silent'?'descanso en silencio':'descanso'):'ronda '+next.round)+' de '+cycleTools.duration(next)+' minutos'};
      }

      const {syncExtensionUI,extendSession}=createSessionExtensionController({
        clock,getCycleState:()=>cycleState,setCycleState:value=>{cycleState=value;},
        isPlaying:()=>playing,isTransitioning:()=>transitioning,$,modeLabelEl,
        advanceSessionClock,scheduleAudioClosing,applyScene,renderTimer,saveSession,syncUI
      });

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
        document.querySelectorAll('.mode-chip').forEach(chip=>{chip.disabled=active;chip.setAttribute('aria-pressed',String(!active&&Number(chip.dataset.minutes)===clock.durationMinutes));});
        $('reset-timer').textContent=active?'Reiniciar tramo':'Reiniciar reloj';
        if(!active){$('cycle-status').textContent='';return;}
        const plan=cycleTools.plans[cycleState.plan],kind=cycleState.phase==='rest'?(isSilentRest()?'Descanso en silencio':'Descanso'):'Concentración';
        $('cycle-status').textContent=kind+' · Ronda '+cycleState.round+' de '+plan.rounds+
          (cycleState.completed?' · Tramo terminado':'');
        modeLabelEl.textContent=kind+' ('+clock.durationMinutes+' min)';
      }
      function resetCycle(plan,singleDuration=cycleState.singleDuration) {
        advanceSessionClock();syncFocusHistoryProgress(true);
        $('extension-status').textContent='';
        cycleState=cycleTools.initial(plan,singleDuration);
        clock.durationMinutes=cycleTools.duration(cycleState);
        listeningProgress.checkpoint();clock.elapsedMs=0;
        $('resume-status').textContent='';
        modeLabelEl.textContent=clock.durationMinutes?'Cuenta regresiva ('+clock.durationMinutes+' min)':'Tiempo de sesión (Libre)';
        $('custom-duration-status').textContent='';
        $('custom-minutes').setAttribute('aria-invalid','false');
        if(plan==='single'&&singleDuration>0)$('custom-minutes').value=singleDuration;
        if(playing) {
          clock.lastTimestamp=Date.now();
          scheduleAudioClosing(true);
          scheduleAudioEntry(true);
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
          resetCycle(value,cycleState.plan==='single'&&cycleTools.validDuration(clock.durationMinutes)?clock.durationMinutes:cycleState.singleDuration);
        });
        syncCycleUI();
      }

      const sessionPersistence=new SessionPersistence({storage,cycleTools});
      function saveSession(force=false) {
        const saved=sessionPersistence.save({duration:clock.durationMinutes,elapsed:clock.elapsedMs,cycle:cycleState},force);
        if(saved===false)$('studio-status').textContent='No se pudo guardar en este dispositivo.';
        return saved;
      }
      function restoreSession() {
        const saved=sessionPersistence.restore();
        if(!saved)return;
        cycleState=saved.cycle;
        clock.durationMinutes=saved.duration;
        clock.elapsedMs=saved.elapsed;
        listeningProgress.checkpoint(clock.elapsedMs); // Time from the previous visit is already in history.
        document.querySelectorAll('.mode-chip').forEach(c=>c.setAttribute('aria-pressed',String(Number(c.dataset.minutes)===clock.durationMinutes)));
        modeLabelEl.textContent=clock.durationMinutes ? 'Cuenta regresiva ('+clock.durationMinutes+' min)' : 'Tiempo de sesión (Libre)';
        if(clock.elapsedMs>0 && (!clock.durationMinutes || clock.elapsedMs<clock.durationMinutes*60000)) {
          $('resume-status').textContent='Sesión recuperada. Tocá Iniciar para continuar.';
        }
      }
      const {syncUpdateButton,setupInstallAndUpdates}=createPwaController({
        window,navigator,$,getPlaybackState:()=>({playing,transitioning}),saveSession
      });



      // Prevención de apagado de pantalla en escritorio / móviles (Screen Wake Lock API)
      const {requestWakeLock,releaseWakeLock,setupMediaSession}=createBrowserPlaybackServices({
        navigator,isPlaying:()=>playing,play:()=>play(),pause:()=>pause()
      });

      function formatSeconds(totalSecs) {
        const safe = Math.max(0, Math.floor(totalSecs));
        const hours = Math.floor(safe / 3600);
        const minutes = Math.floor((safe % 3600) / 60);
        const seconds = safe % 60;
        return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
      }

      function renderTimer() {
        const elapsedSecs = Math.floor(clock.elapsedMs / 1000);
        if (clock.durationMinutes > 0) {
          const targetSecs = clock.durationMinutes * 60;
          const remaining = Math.max(0, targetSecs - elapsedSecs);
          timerEl.textContent = formatSeconds(remaining);
          if (remaining === 0 && playing) {
            cycleState=cycleTools.complete(cycleState);
            pause(true); // Cierre suave automático al cumplir el objetivo
          }
        } else {
          timerEl.textContent = formatSeconds(elapsedSecs);
        }
        $('mobile-timer').textContent=timerEl.textContent;
        syncExtensionUI();
      }

      function advanceSessionClock() {clock.advance(playing);}
      function startSessionClock() {
        clock.start(()=>{
          if(!playing)return;
          advanceSessionClock();applyScene();renderTimer();syncFocusHistoryProgress();saveSession();
        });
      }

      function stopSessionClock() {
        clock.stop(playing);syncFocusHistoryProgress(true);saveSession(true);
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

      const {play,pause}=createPlaybackController({
        clock,cycleTools,listeningProgress,
        getPlaybackState:()=>({playing,transitioning}),setPlaying:value=>{playing=value;},
        setTransitioning:value=>{transitioning=value;},
        getCycleState:()=>cycleState,setCycleState:value=>{cycleState=value;},
        getStudio:()=>studio,setFeedbackSession:value=>{feedbackSession=value;},$,engine,navigator,
        configureAudio,applyScene,renderTimer,saveSession,setupMediaSession,
        startSessionClock,stopSessionClock,requestWakeLock,releaseWakeLock,hideError,showError,syncUI
      });

      function updateRange(id, save = true) {
        const input = $('vol-' + id);
        const output = $('out-' + id);
        const value = Number(input.value);
        output.textContent = value + '%';
        input.style.setProperty('--progress', value + '%');
        engine.updateLevel(id,value);
        if (save) persistSettings();
        syncPresetState();
      }

      function loadSettings() {
        const saved=storage.read('focus-audio-settings-v2',null);
        Object.keys(DEFAULTS).forEach((id) => {
          const value = saved && Number.isFinite(saved[id]) ? Math.max(0, Math.min(100, saved[id])) : DEFAULTS[id];
          $('vol-' + id).value = value;
          updateRange(id, false);
        });
      }

      function persistSettings() {
        const settings = {};
        Object.keys(DEFAULTS).forEach((id) => { settings[id] = Number($('vol-' + id).value); });
        return storage.write('focus-audio-settings-v2',settings);
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
          if(playing)clock.lastTimestamp=Date.now();
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
        listeningProgress.checkpoint();
        clock.elapsedMs = 0;
        saveSession(true);
        $('resume-status').textContent='';
        if (playing) {
          clock.lastTimestamp = Date.now();
          scheduleAudioClosing(true);
          scheduleAudioEntry(true);
        }
        renderTimer();
        syncUI();
      });

      // ==========================================
      // SECCIÓN DE DATOS: HISTORIAL DE HÁBITOS DE FOCO (SVG NATIVO)
      // ==========================================
      const {loadHistory,addFocusSecondsToToday,getLast7DaysData,calculateStreak,resetHistory}=createDailyHistory({storage});

      function syncFocusHistoryProgress(flush = false) {
        const seconds=listeningProgress.advance(clock.elapsedMs,{silent:isSilentRest(),flush});
        if(seconds){addFocusSecondsToToday(seconds);renderHistoryChart();}
      }

      const renderHistoryChart=createHistoryView({$,getLast7DaysData,calculateStreak});

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
          resetHistory();
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

        if(!reloadingAfterRestore)stopSessionClock();
        releaseWakeLock();
        engine.close();
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
          clock.durationMinutes = modeParam;
          $('custom-minutes').value=modeParam;
          clock.elapsedMs=0;listeningProgress.checkpoint();
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