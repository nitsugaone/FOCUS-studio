// Existing playback presentation and controls; audio actions and current state are injected.
export function createPlaybackView({
  window,navigator,$,getPlaybackState,getCycleState,isSilentRest,
  syncCycleUI,cycleAction,syncUpdateButton,syncBackupButtons,syncSharedMixButton,play,pause
}) {
  const btn = $('toggle');
  const playerCard = $('player-card');
  const statusPill = $('status-pill');
  const statusText = $('status-text');
  const playLabel = $('play-label');
  const playIcon = $('play-icon');
  const errorEl = $('error-message');

  function renderPlayback() {
    const {playing,transitioning}=getPlaybackState();
    btn.setAttribute('aria-pressed', String(playing));
    btn.setAttribute('aria-label', playing ? 'Pausar paisaje sonoro' : 'Iniciar paisaje sonoro');
    syncCycleUI();
    const action=cycleAction();
    playLabel.textContent = playing ? 'Pausar' : action.text;
    btn.setAttribute('aria-label',playing?(isSilentRest()?'Pausar descanso':'Pausar paisaje sonoro'):action.label);
    playIcon.innerHTML = playing
      ? '<path d="M7 5.5h3.6v13H7zM13.4 5.5H17v13h-3.6z"/>'
      : '<path d="M8 5.8c0-.8.9-1.3 1.6-.9l9 6.2a1.1 1.1 0 0 1 0 1.8l-9 6.2c-.7.5-1.6 0-1.6-.9V5.8Z"/>';
    const cycleState=getCycleState();
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

  function initPlaybackControls() {
    btn.addEventListener('click', () => (getPlaybackState().playing ? pause() : play()));
    $('mobile-toggle').addEventListener('click', () => (getPlaybackState().playing ? pause() : play()));
    // CSS limits the dock to mobile; the observer follows the original play button.
    if ('IntersectionObserver' in window) {
      const observer = new window.IntersectionObserver(([entry]) => {
        $('mobile-player').hidden=entry.isIntersecting;
      }, {threshold:0});
      observer.observe(btn);
    } else {
      $('mobile-player').hidden=false;
    }
  }

  return {renderPlayback,showError,hideError,initPlaybackControls};
}
