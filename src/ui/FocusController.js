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

      const {syncExtensionUI,extendSession}=createSessionExtensionController({
        clock,getCycleState:()=>cycleState,setCycleState:value=>{cycleState=value;},
        isPlaying:()=>playing,isTransitioning:()=>transitioning,$,modeLabelEl,
        advanceSessionClock,scheduleAudioClosing,applyScene,renderTimer,saveSession,syncUI
      });

      const {cycleAction,syncCycleUI,initCycles}=createCycleController({
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