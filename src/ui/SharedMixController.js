import {SCENES} from '../audio/scenes.js';
import {balanceLabel} from '../audio/dsp.js';
import {createShareTools} from '../session/sharing.js';

// Existing shared-link UI; audio/session application remains an explicit callback.
export function createSharedMixController({window,navigator,$,getPlaybackState,currentMix,applySharedMix,clearFeedback}) {
  const shareTools=createShareTools();
  let pendingSharedMix=null;

  async function shareGeneratedMix() {
    const button=$('native-share-link'),url=$('share-link').value;
    if(!url||button.disabled||typeof navigator.share!=='function')return;
    button.disabled=true;
    try {
      await navigator.share({title:'FOCUS — Paisaje sonoro',url});
      $('share-link-status').textContent='El enlace sigue disponible para compartir o copiar.';
    }catch(error) {
      if(error?.name==='AbortError') {
        $('share-link-status').textContent='Compartir cancelado. El enlace sigue disponible.';
      }else {
        $('share-link').focus();$('share-link').select();
        $('share-link-status').textContent='No se pudo abrir el menú de compartir. Usá Copiar enlace o copialo manualmente.';
      }
    }finally {button.disabled=false;}
  }

  function syncSharedMixButton() {
    const {playing,transitioning}=getPlaybackState();
    $('apply-shared-mix').disabled=!pendingSharedMix||playing||transitioning;
  }

  function clearSharedMixLink() {
    try {
      if(window.location.hash?.startsWith('#mix='))window.history.replaceState(null,'',window.location.pathname+window.location.search);
    }catch(_) {}
  }

  function previewSharedMix() {
    pendingSharedMix=null;$('shared-mix-preview').hidden=true;$('shared-mix-status').textContent='';
    const hash=window.location.hash||'';
    if(hash.startsWith('#mix=')) {
      try {
        pendingSharedMix=shareTools.decode(hash);
        const mix=pendingSharedMix;
        $('shared-mix-summary').textContent=SCENES[mix.scene].label+' · '+(mix.cyclePlan==='single'?(mix.duration?mix.duration+' minutos':'Sesión libre'):mix.cyclePlan.replace('-','/'))+' · Volumen maestro: '+mix.levels.master+'% · Amplitud estéreo: '+mix.stereoWidth+'% · Balance: '+balanceLabel(mix.balance)+' · Notas: '+(mix.melody?({sparse:'más espaciadas',normal:'ritmo actual',frequent:'más frecuentes'})[mix.notePace]:'desactivadas')+' · Entrada: '+(mix.fadeInSeconds?mix.fadeInSeconds+' s':'directa')+' · Cierre: '+mix.fadeOutSeconds+' s (hasta la mitad del tramo).'+(mix.preserveMix?' Conserva volúmenes y melodía al cambiar de ambiente.':'')+(mix.cyclePlan!=='single'?' Descansos: '+(mix.restSound==='silent'?'en silencio.':'con sonido.'):'');
        $('shared-mix-preview').hidden=false;
      }catch(_) {
        $('shared-mix-status').textContent='El enlace de mezcla no es válido o usa una versión incompatible. Tus ajustes se mantienen.';
      }
    }
    syncSharedMixButton();
  }

  function initSharedMix() {
    previewSharedMix();
    window.addEventListener('hashchange',previewSharedMix);
    $('create-share-link').addEventListener('click',()=>{
      try {
        const link=window.location.origin+window.location.pathname+shareTools.encode(currentMix(''));
        $('share-link').value=link;
        $('share-link-panel').hidden=false;
        $('share-link-status').textContent='Enlace creado con los ajustes actuales. Podés copiarlo y abrirlo en otro dispositivo.';
      }catch(_) {$('share-link-status').textContent='No se pudo crear el enlace de esta mezcla.';}
    });
    $('native-share-link').hidden=typeof navigator.share!=='function';
    $('native-share-link').addEventListener('click',shareGeneratedMix);
    $('copy-share-link').addEventListener('click',async()=>{
      if(!$('share-link').value)return;
      try {
        if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
        await navigator.clipboard.writeText($('share-link').value);
        $('share-link-status').textContent='Enlace copiado.';
      }catch(_) {
        $('share-link').focus();$('share-link').select();
        $('share-link-status').textContent='No se pudo copiar automáticamente. El enlace está seleccionado para copiarlo manualmente.';
      }
    });
    $('apply-shared-mix').addEventListener('click',()=>{
      const {playing,transitioning}=getPlaybackState();
      if(!pendingSharedMix||playing||transitioning)return;
      const mix=pendingSharedMix;
      const {sessionSaved,levelsSaved,studioSaved}=applySharedMix(mix);
      $('shared-mix-preview').hidden=true;pendingSharedMix=null;
      clearFeedback();
      $('shared-mix-status').textContent=sessionSaved&&levelsSaved&&studioSaved?'Ajustes compartidos aplicados. Tocá Iniciar para escuchar. Podés guardarlos en Mis mezclas.':'Ajustes aplicados en esta pestaña. No se pudieron guardar todos los cambios en este dispositivo.';
      clearSharedMixLink();syncSharedMixButton();
    });
    $('dismiss-shared-mix').addEventListener('click',()=>{
      pendingSharedMix=null;$('shared-mix-preview').hidden=true;
      $('shared-mix-status').textContent='Mezcla descartada. Tus ajustes se mantienen.';
      clearSharedMixLink();syncSharedMixButton();
    });
    syncSharedMixButton();
  }

  return {syncSharedMixButton,initSharedMix};
}
