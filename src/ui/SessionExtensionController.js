import {sessionExtension} from '../session/cycles.js';

// Coordinates extension using the current clock and explicit application adapters.
export function createSessionExtensionController({
  clock,getCycleState,setCycleState,isPlaying,isTransitioning,$,modeLabelEl,
  advanceSessionClock,scheduleAudioClosing,applyScene,renderTimer,saveSession,syncUI
}) {
  function syncExtensionUI() {
    const cycleState=getCycleState();
    const button=$('extend-session'),next=sessionExtension(cycleState.plan,clock.durationMinutes,clock.elapsedMs);
    button.hidden=cycleState.plan!=='single'||clock.durationMinutes===0;
    button.disabled=isTransitioning()||!next;
    button.textContent=next?'+'+next.added+' min':clock.durationMinutes===180?'Máximo 180 min':'+5 min';
    button.setAttribute('aria-label',next?'Sumar '+next.added+' '+(next.added===1?'minuto':'minutos')+' a la sesión sin reiniciar':'La sesión no se puede prolongar');
  }
  function extendSession() {
    if(isTransitioning())return;
    advanceSessionClock();
    const cycleState=getCycleState();
    const next=sessionExtension(cycleState.plan,clock.durationMinutes,clock.elapsedMs);
    if(!next){renderTimer();syncExtensionUI();return;}
    clock.durationMinutes=next.duration;
    setCycleState({...cycleState,singleDuration:next.duration});
    $('custom-minutes').value=String(next.duration);
    $('custom-minutes').setAttribute('aria-invalid','false');
    $('custom-duration-status').textContent='';
    modeLabelEl.textContent='Cuenta regresiva ('+next.duration+' min)';
    if(isPlaying())scheduleAudioClosing(true);
    applyScene();renderTimer();
    const saved=saveSession(true);syncUI();
    $('extension-status').textContent='Sumaste '+next.added+' '+(next.added===1?'minuto':'minutos')+'. Duración total: '+next.duration+' minutos.'+(saved===false?' No se pudo guardar el cambio en este dispositivo.':'');
  }
  return {syncExtensionUI,extendSession};
}
