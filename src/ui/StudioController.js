import {studioSettings} from '../storage/studio.js';
import {SCENES} from '../audio/scenes.js';
import {balanceLabel,entryEnvelope,sessionEnvelope} from '../audio/dsp.js';

// Existing studio controls with current application state and audio/storage adapters.
export function createStudioController({
  $,clock,engine,storage,defaults,getStudio,setStudio,cycleTools,resetCycle,getCycleState,getPlaybackState,isSilentRest,studioKey,
  updateRange,persistSettings,syncFocusHistoryProgress,syncUI
}) {
  function showStorageError() {
    $('studio-status').textContent='No se pudo guardar en este dispositivo.';
  }

  function writeLocal(key,value) {
    const saved=storage.write(key,value);
    if(!saved)showStorageError();
    return saved;
  }

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

  function configureAudio() {
    const studio=getStudio();
    engine.configure(studio,Object.fromEntries(Object.keys(defaults).map(id=>[id,Number($('vol-'+id).value)])),{
      elapsedMs:clock.elapsedMs,durationMinutes:clock.durationMinutes,silent:isSilentRest()
    });
  }
  function scheduleAudioClosing(smooth=false) {configureAudio();engine.scheduleClosing(smooth);}
  function scheduleAudioEntry(smooth=false) {configureAudio();engine.scheduleEntry(smooth);}
  function applyScene(smooth=1.5) {
    syncStudio();configureAudio();engine.applyScene(smooth);
    if(!engine.initialized())return;
    const studio=getStudio(),cycleState=getCycleState();
    const progress=clock.durationMinutes?Math.min(1,clock.elapsedMs/(clock.durationMinutes*60000)):0;
    // Audio automation owns the envelopes; the timer only updates their caption.
    const {exit}=sessionEnvelope(clock.elapsedMs,clock.durationMinutes,studio.fadeOutSeconds);
    const entry=entryEnvelope(clock.elapsedMs,studio.fadeInSeconds);
    $('session-phase').textContent=isSilentRest()?'Descanso en silencio':exit<1 ? 'Cierre gradual' : entry<1 ? 'Entrada suave' : cycleState.plan!=='single'&&cycleState.phase==='rest' ? 'Descanso sostenido' : progress>0 ? 'Concentración sostenida' : 'Sesión libre';

  }

  function currentMix(name, favorite=false) {
    const studio=getStudio(),cycleState=getCycleState();
    return {...studio,name,favorite,cyclePlan:cycleState.plan,duration:cycleState.plan==='single'?clock.durationMinutes:cycleTools.plans[cycleState.plan].focus,
      levels:Object.fromEntries(Object.keys(defaults).map(k=>[k,Number($('vol-'+k).value)]))};
  }

  function applySavedMix(mix) {
    setStudio(studioSettings(mix));
    Object.keys(defaults).forEach(k=>{$('vol-'+k).value=mix.levels[k];updateRange(k,false);});
    const plan=Object.prototype.hasOwnProperty.call(cycleTools.plans,mix.cyclePlan)?mix.cyclePlan:'single';
    resetCycle(plan,plan==='single'?(cycleTools.validDuration(mix.duration)?mix.duration:0):getCycleState().singleDuration);
    applyScene();persistSettings();writeLocal(studioKey,getStudio());
  }

  function applySharedMix(mix) {
    setStudio(studioSettings(mix));
    Object.keys(defaults).forEach(key=>{$('vol-'+key).value=mix.levels[key];updateRange(key,false);});
    const sessionSaved=resetCycle(mix.cyclePlan,mix.cyclePlan==='single'?mix.duration:getCycleState().singleDuration);
    applyScene();
    const levelsSaved=persistSettings(),studioSaved=writeLocal(studioKey,getStudio());
    return {sessionSaved,levelsSaved,studioSaved};
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

  return {writeLocal,showStorageError,syncEntryUI,syncFadeUI,syncSceneLabels,syncRestSoundUI,syncStudio,initStudioControls,
    configureAudio,scheduleAudioClosing,scheduleAudioEntry,applyScene,currentMix,applySavedMix,applySharedMix};
}
