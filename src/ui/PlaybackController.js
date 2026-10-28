// Coordinates playback lifecycle through explicit state and browser adapters.
export function createPlaybackController({
  clock,cycleTools,listeningProgress,getPlaybackState,setPlaying,setTransitioning,
  getCycleState,setCycleState,getStudio,setFeedbackSession,$,engine,navigator,
  configureAudio,applyScene,renderTimer,saveSession,setupMediaSession,
  startSessionClock,stopSessionClock,requestWakeLock,releaseWakeLock,
  hideError,showError,syncUI
}) {
  async function play() {
    const {playing,transitioning}=getPlaybackState();
    if (playing || transitioning) return;
    let cycleState=getCycleState();
    if(cycleState.plan!=='single'&&cycleState.completed) {
      cycleState=cycleTools.next(cycleState);setCycleState(cycleState);
      clock.durationMinutes=cycleTools.duration(cycleState);
      clock.elapsedMs=0;listeningProgress.checkpoint();renderTimer();saveSession(true);
    }
    setTransitioning(true);
    hideError();
    if (clock.durationMinutes > 0 && clock.elapsedMs >= clock.durationMinutes * 60000) {
      clock.elapsedMs = 0;
      listeningProgress.checkpoint();
      $('extension-status').textContent='';
    }
    syncUI();
    try {
      const wasInitialized=engine.initialized();
      configureAudio();await engine.resume();
      if(!wasInitialized) {
        const background=$('bg-audio');
        if(background)background.srcObject=engine.stream();
        setupMediaSession();
      }
      setPlaying(true);
      $('resume-status').textContent='';
      $('session-feedback').hidden=true;
      $('feedback-status').textContent='';
      applyScene(0.05);
      engine.start();
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
      setPlaying(false);
      stopSessionClock();
      showError(error && error.message ? error.message : 'No se pudo iniciar el audio.');
    } finally {
      setTransitioning(false);
      syncUI();
    }
  }

  function pause(slowFade = false) {
    const {playing,transitioning}=getPlaybackState();
    if (!playing || transitioning) return;
    stopSessionClock();
    let cycleState=getCycleState();
    const reachedEnd=clock.durationMinutes>0&&clock.elapsedMs>=clock.durationMinutes*60000;
    if(reachedEnd&&cycleState.plan!=='single'){cycleState=cycleTools.complete(cycleState);setCycleState(cycleState);saveSession(true);}
    if((slowFade||reachedEnd) && cycleState.phase==='focus') {
      setFeedbackSession({date:new Date().toISOString(),...getStudio(),minutes:Math.round(clock.elapsedMs/60000)});
      $('session-feedback').hidden=false;
    }
    setPlaying(false);
    engine.pause(slowFade);

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
  }
  return {play,pause};
}
