import {createSessionTimerController} from './SessionTimerController.js';
import {createPlaybackView} from './PlaybackView.js';
import {createInteractionController} from './InteractionController.js';
import {createVolumeController} from './VolumeController.js';
import {createStudioController} from './StudioController.js';
import {createMixLibraryView} from './MixLibraryView.js';
import {createCycleController} from './CycleController.js';
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
import {validStudio} from '../storage/mixes.js';
import {createResponsiveController} from './ResponsiveController.js';
import {createHistoryView} from './HistoryView.js';
import {SessionClock} from '../session/SessionClock.js';
import {FocusAudioEngine} from '../audio/FocusAudioEngine.js';
import {entryEnvelope,sessionEnvelope} from '../audio/dsp.js';
import {StorageService} from '../storage/StorageService.js';
import {createCycleTools,isSilentRestState} from '../session/cycles.js';

export function startFocusApp({
  window=globalThis.window,document=globalThis.document,navigator=globalThis.navigator,
  localStorage=globalThis.localStorage,Option=globalThis.Option,
  clearTimeout=globalThis.clearTimeout,clearInterval=globalThis.clearInterval,
  URL=globalThis.URL,Blob=globalThis.Blob
}={}) {

      const DEFAULTS = { master: 75, noise: 70, drone: 60, notes: 55 };

      const $ = (id) => document.getElementById(id);
      const modeLabelEl = $('session-mode-label');

      const engine=new FocusAudioEngine({platform:window,clearTimeout});
      let playing = false;
      let transitioning = false;


      // Reloj de alta precisión basado en timestamps reales (inmune a background tab throttling)
      const clock=new SessionClock({now:()=>Date.now(),setInterval:(fn,ms)=>window.setInterval(fn,ms),clearInterval});

      const listeningProgress=new ListeningProgress();
      const cycleTools=createCycleTools();
      let cycleState=cycleTools.initial();

      const STUDIO_KEY = 'focus-studio-v3';
      let studio = {scene:'rain',evolution:35,brightness:50,melody:true,stereoWidth:100,balance:0,notePace:'normal',fadeOutSeconds:20,fadeInSeconds:12,preserveMix:false,restSound:'sound'};
      const mixState={mixes:[],deletionUndo:null};
      const storage=new StorageService(localStorage);
      function readLocal(key,fallback) { return storage.read(key,fallback); }
      function writeLocal(key,value) {
        const saved=storage.write(key,value);
        if(!saved)$('studio-status').textContent='No se pudo guardar en este dispositivo.';
        return saved;
      }

      const {updateRange,loadSettings,persistSettings,initVolumeControls,toggleMute}=createVolumeController({
        document,$,engine,storage,defaults:DEFAULTS
      });

      const {syncEntryUI,syncFadeUI,syncSceneLabels,syncRestSoundUI,syncStudio,initStudioControls}=createStudioController({
        $,clock,engine,getStudio:()=>studio,getCycleState:()=>cycleState,getPlaybackState:()=>({playing,transitioning}),
        isSilentRest,studioKey:STUDIO_KEY,updateRange,persistSettings,syncFocusHistoryProgress,applyScene,writeLocal,syncUI
      });

      function isSilentRest() {return isSilentRestState(cycleState,studio.restSound);}

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

      const {selectedMixIndex,renderMixes,syncMixActions}=createMixLibraryView({
        document,Option,$,state:mixState,cycleTools,syncMixUndoUI:()=>syncMixUndoUI()
      });

      function currentMix(name, favorite=false) {
        return {...studio,name,favorite,cyclePlan:cycleState.plan,duration:cycleState.plan==='single'?clock.durationMinutes:cycleTools.plans[cycleState.plan].focus,
          levels:Object.fromEntries(Object.keys(DEFAULTS).map(k=>[k,Number($('vol-'+k).value)]))};
      }

      function applySavedMix(mix) {
        studio={scene:mix.scene,evolution:mix.evolution,brightness:mix.brightness,melody:mix.melody,stereoWidth:mix.stereoWidth??100,balance:mix.balance??0,notePace:mix.notePace??'normal',fadeOutSeconds:mix.fadeOutSeconds??20,fadeInSeconds:mix.fadeInSeconds??12,preserveMix:mix.preserveMix??false,restSound:mix.restSound??'sound'};
        Object.keys(DEFAULTS).forEach(k=>{$('vol-'+k).value=mix.levels[k];updateRange(k,false);});
        const plan=Object.prototype.hasOwnProperty.call(cycleTools.plans,mix.cyclePlan)?mix.cyclePlan:'single';
        resetCycle(plan,plan==='single'?(cycleTools.validDuration(mix.duration)?mix.duration:0):cycleState.singleDuration);
        applyScene();persistSettings();writeLocal(STUDIO_KEY,studio);
      }

      const {syncMixUndoUI,initMixActions}=createMixLibraryController({
        state:mixState,$,writeLocal,renderMixes,selectedMixIndex,currentMix,syncMixActions,
        getPlaybackState:()=>({playing,transitioning}),applySavedMix
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
        initStudioControls();
        initMixActions();
        initFeedback();
      }

      const {initInsights,setFeedbackSession,clearFeedback,initFeedback}=createInsightsController({document,$,storage,writeLocal});

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
        clearFeedback
      });

      const {syncBackupButtons,initBackups}=createBackupController({
        window,document,$,storage,URL,Blob,getPlaybackState:()=>({playing,transitioning}),
        reloadAfterRestore:()=>{reloadingAfterRestore=true;window.location.reload();}
      });

      const {syncExtensionUI,extendSession}=createSessionExtensionController({
        clock,getCycleState:()=>cycleState,setCycleState:value=>{cycleState=value;},
        isPlaying:()=>playing,isTransitioning:()=>transitioning,$,modeLabelEl,
        advanceSessionClock,scheduleAudioClosing,applyScene,renderTimer,saveSession,syncUI
      });

      const {cycleAction,syncCycleUI,initCycles,initDurationControls}=createCycleController({
        document,$,clock,cycleTools,getCycleState:()=>cycleState,getPlaybackState:()=>({playing,transitioning}),
        getRestSound:()=>studio.restSound,isSilentRest,modeLabelEl,extendSession,resetCycle,
        syncSessionControls:()=>{syncExtensionUI();syncEntryUI();syncFadeUI();syncRestSoundUI();syncSceneLabels();}
      });
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
      const {requestWakeLock,releaseWakeLock,setupMediaSession,initPageLifecycle}=createBrowserPlaybackServices({
        navigator,isPlaying:()=>playing,play:()=>play(),pause:()=>pause()
      });

      const sessionTimer=createSessionTimerController({
        $,clock,cycleTools,isPlaying:()=>playing,getCycleState:()=>cycleState,
        setCycleState:value=>{cycleState=value;},pause:slowFade=>pause(slowFade),
        syncExtensionUI,applyScene,syncFocusHistoryProgress,saveSession
      });
      function renderTimer() {sessionTimer.renderTimer();}
      function advanceSessionClock() {sessionTimer.advanceSessionClock();}
      function startSessionClock() {sessionTimer.startSessionClock();}
      function stopSessionClock() {sessionTimer.stopSessionClock();}

      const {renderPlayback,showError,hideError,initPlaybackControls}=createPlaybackView({
        window,navigator,$,getPlaybackState:()=>({playing,transitioning}),getCycleState:()=>cycleState,
        isSilentRest,syncCycleUI,cycleAction,syncUpdateButton,syncBackupButtons,syncSharedMixButton,
        play:()=>play(),pause:()=>pause()
      });
      function syncUI() {renderPlayback();}

      const {play,pause}=createPlaybackController({
        clock,cycleTools,listeningProgress,
        getPlaybackState:()=>({playing,transitioning}),setPlaying:value=>{playing=value;},
        setTransitioning:value=>{transitioning=value;},
        getCycleState:()=>cycleState,setCycleState:value=>{cycleState=value;},
        getStudio:()=>studio,setFeedbackSession,$,engine,navigator,
        configureAudio,applyScene,renderTimer,saveSession,setupMediaSession,
        startSessionClock,stopSessionClock,requestWakeLock,releaseWakeLock,hideError,showError,syncUI
      });

      initVolumeControls();

      initDurationControls();

      initPlaybackControls();
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

      const {initInteractions}=createInteractionController({
        document,$,isPlaying:()=>playing,play,pause,toggleMute,syncSceneLabels,
        isEditableTarget:target=>target instanceof HTMLElement&&target.matches('input, button, textarea, select, a, [contenteditable="true"]')
      });
      initInteractions();

      initPageLifecycle({
        window,document,advanceSessionClock,applyScene,renderTimer,stopSessionClock,
        isReloadingAfterRestore:()=>reloadingAfterRestore,closeAudio:()=>engine.close()
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