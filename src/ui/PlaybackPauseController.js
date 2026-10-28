// Coordinates the existing pause sequence through explicit application adapters.
export function createPlaybackPauseController({
  clock,getPlaybackState,setPlaying,getCycleState,setCycleState,completeCycle,
  getStudio,setFeedbackSession,$,engine,navigator,stopSessionClock,saveSession,
  releaseWakeLock,syncUI
}) {
  function pause(slowFade = false) {
    const {playing,transitioning}=getPlaybackState();
    if (!playing || transitioning) return;
    stopSessionClock();
    let cycleState=getCycleState();
    const reachedEnd=clock.durationMinutes>0&&clock.elapsedMs>=clock.durationMinutes*60000;
    if(reachedEnd&&cycleState.plan!=='single'){cycleState=completeCycle(cycleState);setCycleState(cycleState);saveSession(true);}
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
  return {pause};
}
