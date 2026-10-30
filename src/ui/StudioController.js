import {SCENES} from '../audio/scenes.js';
import {balanceLabel} from '../audio/dsp.js';

// Existing studio controls with current application state and audio/storage adapters.
export function createStudioController({
  $,clock,engine,getStudio,getCycleState,getPlaybackState,isSilentRest,studioKey,
  updateRange,persistSettings,syncFocusHistoryProgress,applyScene,writeLocal,syncUI
}) {
  function syncEntryUI() {
    const studio=getStudio(),{playing,transitioning}=getPlaybackState();
    $('fade-in').value=String(studio.fadeInSeconds);
    $('fade-in').disabled=playing||transitioning;
    $('fade-in-hint').textContent=(studio.fadeInSeconds?'Alcanza el volumen elegido en '+studio.fadeInSeconds+' segundos al iniciar el tramo.':'Sin entrada gradual adicional.')+(playing||transitioning?' Pausá para cambiarla.':' Se conserva al pausar y continuar.');
  }

  function syncFadeUI() {
    const studio=getStudio(),{playing,transitioning}=getPlaybackState();
    $('fade-out').value=String(studio.fadeOutSeconds);
    $('fade-out').disabled=playing||transitioning||clock.durationMinutes===0;
    const seconds=clock.durationMinutes?Math.min(studio.fadeOutSeconds,clock.durationMinutes*30):0;
    $('fade-out-hint').textContent=!clock.durationMinutes?'Disponible en sesiones con duración y en ciclos. Se conserva tu elección.':'El volumen baja en los últimos '+seconds+' segundos del tramo.'+(seconds<studio.fadeOutSeconds?' El cierre se limita a la mitad de este tramo.':'')+(playing||transitioning?' Pausá para cambiarlo.':'');
  }

  function syncSceneLabels() {
    const studio=getStudio();
    const label=isSilentRest()?'Descanso en silencio':SCENES[studio.scene].label;
    $('mobile-scene').textContent=label;$('focus-view-scene').textContent=label;
  }

  function syncRestSoundUI() {
    const studio=getStudio(),cycleState=getCycleState(),{playing,transitioning}=getPlaybackState();
    $('rest-sound-setting').hidden=cycleState.plan==='single';
    $('rest-sound').value=studio.restSound;
    $('rest-sound').disabled=playing||transitioning||cycleState.plan==='single';
  }

  function syncStudio() {
    syncEntryUI();
    syncRestSoundUI();
    syncFadeUI();
    const studio=getStudio();
    $('soundscape').value=studio.scene; $('evolution').value=studio.evolution;
    $('brightness').value=studio.brightness; $('melody').checked=studio.melody;
    $('preserve-mix').checked=studio.preserveMix;
    $('note-pace').value=studio.notePace;$('note-pace').disabled=!studio.melody;
    $('note-pace-hint').textContent=studio.melody?'Cambia cuándo aparecen nuevas notas, sin modificar su volumen.':'Activá Incluir melodía para escuchar notas. Se conserva el ritmo elegido.';
    $('evolution-value').textContent=studio.evolution+'%';
    $('stereo-width').value=studio.stereoWidth;$('stereo-width-value').textContent=studio.stereoWidth+'%';
    $('channel-balance').value=studio.balance;
    $('channel-balance-value').textContent=balanceLabel(studio.balance);
    $('channel-balance').setAttribute('aria-valuetext',balanceLabel(studio.balance));
    $('scene-description').textContent=SCENES[studio.scene].description;
    syncSceneLabels();
  }

  function initStudioControls() {
    ['soundscape','evolution','brightness','melody','stereo-width','channel-balance','note-pace','fade-in','fade-out','preserve-mix','rest-sound'].forEach(id=>$(id).addEventListener('input',()=>{
      const studio=getStudio(),cycleState=getCycleState(),{playing,transitioning}=getPlaybackState();
      if(id==='fade-in') {
        const value=Number($('fade-in').value);
        if(playing||transitioning||!['0','3','12','30'].includes($('fade-in').value)){syncEntryUI();return;}
        studio.fadeInSeconds=value;
      }
      if(id==='fade-out') {
        const value=Number($('fade-out').value);
        if(playing||transitioning||!clock.durationMinutes||![5,20,60].includes(value)){syncFadeUI();return;}
        studio.fadeOutSeconds=value;
      }
      if(id==='rest-sound') {
        const value=$('rest-sound').value;
        if(playing||transitioning||cycleState.plan==='single'||!['sound','silent'].includes(value)){syncRestSoundUI();return;}
        syncFocusHistoryProgress(true);studio.restSound=value;
      }
      if(id==='preserve-mix')studio.preserveMix=$('preserve-mix').checked;
      if(id==='soundscape') {
        engine.resetNotes();
        studio.scene=$('soundscape').value;
        if(!studio.preserveMix) {
          studio.melody=SCENES[studio.scene].melody!==false;
          Object.entries(SCENES[studio.scene].mix).forEach(([k,v])=>{$('vol-'+k).value=v;updateRange(k,false);});
          persistSettings();
        }
      }
      if(id==='evolution')studio.evolution=Number($('evolution').value);
      if(id==='brightness')studio.brightness=Number($('brightness').value);
      if(id==='stereo-width')studio.stereoWidth=Number($('stereo-width').value);
      if(id==='channel-balance') {
        const value=Number($('channel-balance').value);
        if(!Number.isInteger(value)||value<-100||value>100){syncStudio();return;}
        studio.balance=value;
      }
      if(id==='melody')studio.melody=$('melody').checked;
      if(id==='note-pace') {
        if(!['sparse','normal','frequent'].includes($('note-pace').value)){syncStudio();return;}
        studio.notePace=$('note-pace').value;
      }
      applyScene();writeLocal(studioKey,studio);
      if(id==='rest-sound')syncUI();
      if(getPlaybackState().playing&&['soundscape','melody','note-pace'].includes(id))engine.restartNotes();
    }));
    $('center-balance').addEventListener('click',()=>{
      const studio=getStudio();
      studio.balance=0;applyScene();writeLocal(studioKey,studio);
    });
  }

  return {syncEntryUI,syncFadeUI,syncSceneLabels,syncRestSoundUI,syncStudio,initStudioControls};
}
