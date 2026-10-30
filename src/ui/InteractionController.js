// Existing concentration view and shortcuts; playback/volume actions remain injected.
export function createInteractionController({document,$,isPlaying,play,pause,toggleMute,syncSceneLabels,isEditableTarget}) {
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

  function initInteractions() {
    $('focus-view-toggle').addEventListener('click',()=>setFocusView(!focusView));

    document.addEventListener('keydown', (event) => {
      if(event.key==='Escape'&&focusView) {
        event.preventDefault();setFocusView(false);$('focus-view-toggle').focus();return;
      }
      if (event.repeat) return;
      const target = event.target;
      if (isEditableTarget(target)) return;

      if (event.code === 'Space') {
        event.preventDefault();
        isPlaying() ? pause() : play();
      } else if (event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        toggleMute();
      }
    });
  }

  return {initInteractions};
}
