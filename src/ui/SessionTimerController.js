// Coordinates the existing timer display and tick lifecycle through injected state/actions.
export function createSessionTimerController({
  $,clock,cycleTools,isPlaying,getCycleState,setCycleState,pause,syncExtensionUI,
  applyScene,syncFocusHistoryProgress,saveSession,listeningProgress,modeLabelEl,
  syncCycleUI,syncUI,scheduleAudioClosing,scheduleAudioEntry
}) {
  const timerEl=$('timer');

  function formatSeconds(totalSecs) {
    const safe = Math.max(0, Math.floor(totalSecs));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const seconds = safe % 60;
    return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
  }

  function renderTimer() {
    const playing=isPlaying();
    const elapsedSecs = Math.floor(clock.elapsedMs / 1000);
    if (clock.durationMinutes > 0) {
      const targetSecs = clock.durationMinutes * 60;
      const remaining = Math.max(0, targetSecs - elapsedSecs);
      timerEl.textContent = formatSeconds(remaining);
      if (remaining === 0 && playing) {
        setCycleState(cycleTools.complete(getCycleState()));
        pause(true); // Cierre suave automático al cumplir el objetivo
      }
    } else {
      timerEl.textContent = formatSeconds(elapsedSecs);
    }
    $('mobile-timer').textContent=timerEl.textContent;
    syncExtensionUI();
  }

  function advanceSessionClock() {clock.advance(isPlaying());}
  function startSessionClock() {
    clock.start(()=>{
      if(!isPlaying())return;
      advanceSessionClock();applyScene();renderTimer();syncFocusHistoryProgress();saveSession();
    });
  }

  function stopSessionClock() {
    clock.stop(isPlaying());syncFocusHistoryProgress(true);saveSession(true);
  }

  function resetCycle(plan,singleDuration=getCycleState().singleDuration) {
    advanceSessionClock();syncFocusHistoryProgress(true);
    $('extension-status').textContent='';
    const cycleState=cycleTools.initial(plan,singleDuration);
    setCycleState(cycleState);
    clock.durationMinutes=cycleTools.duration(cycleState);
    listeningProgress.checkpoint();clock.elapsedMs=0;
    $('resume-status').textContent='';
    modeLabelEl.textContent=clock.durationMinutes?'Cuenta regresiva ('+clock.durationMinutes+' min)':'Tiempo de sesión (Libre)';
    $('custom-duration-status').textContent='';
    $('custom-minutes').setAttribute('aria-invalid','false');
    if(plan==='single'&&singleDuration>0)$('custom-minutes').value=singleDuration;
    if(isPlaying()) {
      clock.lastTimestamp=Date.now();
      scheduleAudioClosing(true);
      scheduleAudioEntry(true);
    }
    syncCycleUI();renderTimer();const saved=saveSession(true);syncUI();return saved;
  }

  function initResetControl() {
    $('reset-timer').addEventListener('click', () => {
      $('extension-status').textContent='';
      advanceSessionClock();
      setCycleState({...getCycleState(),completed:false});
      syncCycleUI();
      syncFocusHistoryProgress(true);
      listeningProgress.checkpoint();
      clock.elapsedMs = 0;
      saveSession(true);
      $('resume-status').textContent='';
      if (isPlaying()) {
        clock.lastTimestamp = Date.now();
        scheduleAudioClosing(true);
        scheduleAudioEntry(true);
      }
      renderTimer();
      syncUI();
    });
  }

  return {renderTimer,advanceSessionClock,startSessionClock,stopSessionClock,resetCycle,initResetControl};
}
