// View modes, quick scene cards and shortcuts coordinate the existing studio and player.
export function createInteractionController({window,document,$,quickSceneCards,getPlaybackState,selectScene,play,pause,toggleMute,syncSceneLabels,isEditableTarget}) {
  const modeKey='focus-view-mode';
  let focusView=true,focusSessionOptionsOpen=false;

  function setFocusView(enabled) {
    const sessionOptions=$('session-options');
    if(focusView&&!enabled)focusSessionOptionsOpen=Boolean(sessionOptions.open);
    focusView=enabled;
    document.body.dataset.focusView=String(focusView);
    sessionOptions.open=!focusView||focusSessionOptionsOpen;
    const control=$('focus-view-toggle');
    control.setAttribute('aria-pressed',String(focusView));
    control.textContent=focusView?'Personalizar mezcla':'Volver a Enfoque';
    syncSceneLabels();
  }

  function switchView(enabled) {
    setFocusView(enabled);
    try {
      const storage=window.sessionStorage;
      if(enabled)storage?.removeItem(modeKey);
      else storage?.setItem(modeKey,'studio');
    } catch (_) {
      // The view remains usable when session storage is blocked.
    }
  }

  function initInteractions() {
    focusSessionOptionsOpen=Boolean($('session-options').open);
    let restoreStudio=false;
    try {restoreStudio=window.sessionStorage?.getItem(modeKey)==='studio';} catch (_) {}
    setFocusView(!restoreStudio);
    $('focus-view-toggle').addEventListener('click',()=>switchView(!focusView));
    for(const card of quickSceneCards)card.addEventListener('click',()=>{
      const {playing,transitioning}=getPlaybackState();
      if(!transitioning&&selectScene(card.dataset.quickScene)&&!playing)return play();
    });

    document.addEventListener('keydown', (event) => {
      if(event.key==='Escape'&&!focusView) {
        event.preventDefault();switchView(true);$('focus-view-toggle').focus();return;
      }
      if (event.repeat) return;
      const target = event.target;
      if (isEditableTarget(target)) return;

      if (event.code === 'Space') {
        event.preventDefault();
        getPlaybackState().playing ? pause() : play();
      } else if (event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        toggleMute();
      }
    });
  }

  return {initInteractions};
}
