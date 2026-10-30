// Existing cycle view and plan events; cycle rules and reset side effects are injected.
export function createCycleController({
  document,$,clock,cycleTools,getCycleState,getPlaybackState,getRestSound,
  isSilentRest,modeLabelEl,syncSessionControls,extendSession,resetCycle
}) {
  function cycleAction() {
    const cycleState=getCycleState();
    if(cycleState.plan==='single'||!cycleState.completed)return {text:'Iniciar',label:isSilentRest()?'Iniciar descanso en silencio':'Iniciar paisaje sonoro'};
    const next=cycleTools.next(cycleState),last=next.round===1&&next.phase==='focus';
    return {text:last?'Repetir':next.phase==='rest'?'Descansar':'Siguiente',
      label:(last?'Repetir ciclo: ': 'Iniciar ')+(next.phase==='rest'?(getRestSound()==='silent'?'descanso en silencio':'descanso'):'ronda '+next.round)+' de '+cycleTools.duration(next)+' minutos'};
  }

  function syncCycleUI() {
    syncSessionControls();
    const cycleState=getCycleState(),{playing,transitioning}=getPlaybackState();
    const active=cycleState.plan!=='single';
    const locked=active||playing||transitioning;
    $('custom-minutes').disabled=locked;
    $('apply-duration').disabled=locked;
    $('custom-duration-hint').textContent=active?'La duración personalizada se usa en Una sesión.':playing||transitioning?'Pausá para aplicar otra duración.':'De 1 a 180 minutos. Aplicar en pausa reinicia el reloj.';
    $('session-plan').value=cycleState.plan;
    $('session-plan').disabled=playing||transitioning;
    $('cycle-hint').hidden=!active;
    $('cycle-hint').textContent='Hay un descanso entre rondas. Cada tramo se detiene al terminar y el siguiente empieza al tocar el botón. '+(getRestSound()==='silent'?'Los descansos en silencio no suman tiempo de escucha.':'El tiempo de escucha incluye los descansos con sonido.');
    document.querySelectorAll('.mode-chip').forEach(chip=>{chip.disabled=active;chip.setAttribute('aria-pressed',String(!active&&Number(chip.dataset.minutes)===clock.durationMinutes));});
    $('reset-timer').textContent=active?'Reiniciar tramo':'Reiniciar reloj';
    if(!active){$('cycle-status').textContent='';return;}
    const plan=cycleTools.plans[cycleState.plan],kind=cycleState.phase==='rest'?(isSilentRest()?'Descanso en silencio':'Descanso'):'Concentración';
    $('cycle-status').textContent=kind+' · Ronda '+cycleState.round+' de '+plan.rounds+
      (cycleState.completed?' · Tramo terminado':'');
    modeLabelEl.textContent=kind+' ('+clock.durationMinutes+' min)';
  }

  function initDurationControls() {
    document.querySelectorAll('.mode-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        if(getCycleState().plan!=='single')return;
        resetCycle('single',Number(chip.dataset.minutes)||0);
        if(getPlaybackState().playing)clock.lastTimestamp=Date.now();
      });
    });
    function applyCustomDuration() {
      const {playing,transitioning}=getPlaybackState();
      if(playing||transitioning||getCycleState().plan!=='single')return;
      const raw=$('custom-minutes').value.trim(),minutes=Number(raw);
      if(!raw||!cycleTools.validDuration(minutes)||minutes<1) {
        $('custom-duration-status').textContent='Ingresá un número entero de 1 a 180 minutos.';
        $('custom-minutes').setAttribute('aria-invalid','true');
        return;
      }
      $('custom-minutes').setAttribute('aria-invalid','false');
      resetCycle('single',minutes);
      $('custom-duration-status').textContent='Duración aplicada: '+minutes+' minutos. Tocá Iniciar cuando quieras.';
    }
    $('apply-duration').addEventListener('click',applyCustomDuration);
    $('custom-minutes').addEventListener('keydown',event=>{
      if(event.key==='Enter'){event.preventDefault();applyCustomDuration();}
    });
  }

  function initCycles() {
    const cycleState=getCycleState();
    if(cycleState.singleDuration>0)$('custom-minutes').value=cycleState.singleDuration;
    $('extend-session').addEventListener('click',extendSession);
    $('session-plan').addEventListener('change',()=>{
      const cycleState=getCycleState(),{playing,transitioning}=getPlaybackState();
      if(playing||transitioning){$('session-plan').value=cycleState.plan;return;}
      const value=$('session-plan').value;
      if(!Object.prototype.hasOwnProperty.call(cycleTools.plans,value))return;
      resetCycle(value,cycleState.plan==='single'&&cycleTools.validDuration(clock.durationMinutes)?clock.durationMinutes:cycleState.singleDuration);
    });
    syncCycleUI();
  }

  return {cycleAction,syncCycleUI,initCycles,initDurationControls};
}
