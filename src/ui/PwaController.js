// Coordinates existing installation and explicit updates with browser/UI adapters.
export function createPwaController({window,navigator,$,getPlaybackState,saveSession}) {
  let waitingWorker=null;
  let updateReloadRequested=false;
  let installPrompt=null;

  function syncUpdateButton() {
    const {playing,transitioning}=getPlaybackState();
    $('apply-update').hidden=!waitingWorker;
    $('apply-update').disabled=playing || transitioning;
    if(waitingWorker)$('update-status').textContent=playing ? 'Hay una versión nueva. Pausá para actualizar.' : 'Nueva versión disponible. Tus mezclas se conservan.';
  }
  function setupInstallAndUpdates() {
    window.addEventListener('beforeinstallprompt',event=>{
      event.preventDefault();installPrompt=event;$('install-app').hidden=false;
    });
    window.addEventListener('appinstalled',()=>{installPrompt=null;$('install-app').hidden=true;});
    $('install-app').addEventListener('click',async()=>{
      if(!installPrompt)return;
      const prompt=installPrompt;installPrompt=null;$('install-app').hidden=true;
      try { await prompt.prompt(); await prompt.userChoice; }
      catch (_) { $('update-status').textContent='Usá el menú del navegador para instalar FOCUS.'; }
    });
    $('apply-update').addEventListener('click',()=>{
      const {playing,transitioning}=getPlaybackState();
      if(!waitingWorker || playing || transitioning)return;
      saveSession(true);updateReloadRequested=true;
      $('apply-update').disabled=true;
      waitingWorker.postMessage({type:'SKIP_WAITING'});
    });
    const connectionStatus=()=>{
      $('offline-status').textContent=navigator.onLine===false ? 'Sin conexión. La instalación guardada puede seguir funcionando.' : 'Con conexión. Preparando disponibilidad sin conexión…';
    };
    connectionStatus();
    if(!('serviceWorker' in navigator)) {
      $('offline-status').textContent='Este navegador no ofrece instalación sin conexión.';
      return;
    }
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(updateReloadRequested)window.location.reload();
    });
    const register=async()=>{
      try {
        const registration=await navigator.serviceWorker.register('./sw.js');
        const markWaiting=()=>{if(registration.waiting){waitingWorker=registration.waiting;syncUpdateButton();}};
        markWaiting();
        registration.addEventListener('updatefound',()=>{
          const worker=registration.installing;if(!worker)return;
          worker.addEventListener('statechange',()=>{if(worker.state==='installed')markWaiting();});
        });
        await navigator.serviceWorker.ready;
        $('offline-status').textContent=navigator.onLine===false ? 'Sin conexión · FOCUS disponible en este dispositivo.' : 'FOCUS está disponible sin conexión en este dispositivo.';
      } catch (_) {
        $('offline-status').textContent='No se pudo preparar el modo sin conexión. Volvé a abrir con internet.';
      }
    };
    window.addEventListener('load',register);
    window.addEventListener('online',register);
    window.addEventListener('offline',()=>{$('offline-status').textContent='Sin conexión · si ya instalaste FOCUS, podés seguir escuchando.';});
  }

  return {syncUpdateButton,setupInstallAndUpdates};
}
