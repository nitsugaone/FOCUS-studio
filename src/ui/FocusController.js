import {createHistoryController} from './HistoryController.js';
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
import {createPlaybackController} from './PlaybackController.js';
import {ListeningProgress} from '../session/ListeningProgress.js';
import {createSessionExtensionController} from './SessionExtensionController.js';
import {createMixLibraryController} from './MixLibraryController.js';
import {createResponsiveController} from './ResponsiveController.js';
import {SessionClock} from '../session/SessionClock.js';
import {FocusAudioEngine} from '../audio/FocusAudioEngine.js';
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
      const {updateRange,loadSettings,persistSettings,initVolumeControls,toggleMute}=createVolumeController({
        document,$,engine,storage,defaults:DEFAULTS
      });

      const {writeLocal,showStorageError,syncEntryUI,syncFadeUI,syncSceneLabels,syncRestSoundUI,syncStudio,initStudioControls,
        configureAudio,scheduleAudioClosing,scheduleAudioEntry,applyScene,
        currentMix,applySavedMix,applySharedMix}=createStudioController({
        $,clock,engine,storage,defaults:DEFAULTS,getStudio:()=>studio,setStudio:value=>{studio=value;},
        cycleTools,resetCycle,getCycleState:()=>cycleState,getPlaybackState:()=>({playing,transitioning}),
        isSilentRest,studioKey:STUDIO_KEY,updateRange,persistSettings,syncFocusHistoryProgress,syncUI
      });

      function isSilentRest() {return isSilentRestState(cycleState,studio.restSound);}

      const {selectedMixIndex,renderMixes,syncMixActions,initMixSearch}=createMixLibraryView({
        document,Option,$,state:mixState,cycleTools,syncMixUndoUI:()=>syncMixUndoUI()
      });

      const {syncMixUndoUI,initMixActions}=createMixLibraryController({
        state:mixState,$,writeLocal,renderMixes,selectedMixIndex,currentMix,syncMixActions,
        getPlaybackState:()=>({playing,transitioning}),applySavedMix
      });
      // Only crossing the breakpoint resets panels. Manual toggles within a
      // layout remain untouched, and playback nodes are never recreated.
      const setupResponsivePanels=createResponsiveController({window,$});

      function initStudio() {
        const loaded=storage.loadStudio(STUDIO_KEY);
        if(loaded)studio=loaded;
        mixState.mixes=storage.loadMixes(Object.keys(DEFAULTS));
        syncStudio();renderMixes();
        initMixSearch();
        initStudioControls();
        initMixActions();
        initFeedback();
      }

      const {initInsights,setFeedbackSession,clearFeedback,initFeedback}=createInsightsController({document,$,storage,writeLocal});

      let reloadingAfterRestore=false;

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
        return sessionTimer.resetCycle(plan,singleDuration);
      }

      const sessionPersistence=new SessionPersistence({storage,cycleTools});
      function saveSession(force=false) {
        const saved=sessionPersistence.save({duration:clock.durationMinutes,elapsed:clock.elapsedMs,cycle:cycleState},force);
        if(saved===false)showStorageError();
        return saved;
      }
      const {syncUpdateButton,setupInstallAndUpdates}=createPwaController({
        window,navigator,$,getPlaybackState:()=>({playing,transitioning}),saveSession
      });



      // Prevención de apagado de pantalla en escritorio / móviles (Screen Wake Lock API)
      const {requestWakeLock,releaseWakeLock,setupMediaSession,initPageLifecycle}=createBrowserPlaybackServices({
        navigator,isPlaying:()=>playing,play:()=>play(),pause:()=>pause()
      });

      const sessionTimer=createSessionTimerController({
        window,document,$,clock,cycleTools,isPlaying:()=>playing,getCycleState:()=>cycleState,
        setCycleState:value=>{cycleState=value;},pause:slowFade=>pause(slowFade),
        syncExtensionUI,applyScene,syncFocusHistoryProgress,saveSession,listeningProgress,modeLabelEl,
        syncCycleUI,syncUI,scheduleAudioClosing,scheduleAudioEntry
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
      sessionTimer.initResetControl();

      const {loadHistory,renderHistoryChart,initHistoryControls,
        syncFocusHistoryProgress:syncHistoryProgress}=createHistoryController({
        $,storage,clock,listeningProgress,isSilentRest
      });
      function syncFocusHistoryProgress(flush=false) {syncHistoryProgress(flush);}
      initHistoryControls();

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
      sessionTimer.restoreSession(sessionPersistence.restore());
      initInsights();
      initBackups();
      initCycles();

      sessionTimer.applyShortcut();

      initSharedMix();
      renderTimer();
      renderHistoryChart();
      syncUI();
    }