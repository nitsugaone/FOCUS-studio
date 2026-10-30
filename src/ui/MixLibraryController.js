import {createMixCopy} from '../storage/mixes.js';

// Coordinates saved-mix actions, transactions and recovery with explicit UI dependencies.
export function createMixLibraryController({
  state,$,writeLocal,renderMixes,selectedMixIndex,currentMix,syncMixActions,getPlaybackState,applySavedMix
}) {
  function syncMixUndoUI() {
    const available=state.deletionUndo!==null;
    $('undo-delete-mix').hidden=!available;
    $('undo-delete-mix').disabled=!available;
    $('mix-undo-hint').hidden=!available;
  }

  function commitMixes(next, selected='', reveal=false) {
    if(!writeLocal('focus-mixes-v3',next))return false;
    state.mixes=next;state.deletionUndo=null;
    if(reveal)$('mix-search').value='';
    renderMixes(selected);return true;
  }

  function deleteSelectedMix() {
    const index=selectedMixIndex();if(index<0)return;
    const mix=state.mixes[index],removed={index,mix:{...mix,levels:{...mix.levels}}};
    if(commitMixes(state.mixes.filter((_,i)=>i!==index))){
      state.deletionUndo=removed;syncMixUndoUI();
      $('studio-status').textContent='Mezcla eliminada.';
    }
  }

  function undoMixDeletion() {
    if(!state.deletionUndo)return;
    if(state.mixes.length>=50){$('studio-status').textContent='No hay espacio para recuperar la mezcla.';return;}
    const {mix}=state.deletionUndo,index=Math.min(state.deletionUndo.index,state.mixes.length);
    const next=[...state.mixes.slice(0,index),mix,...state.mixes.slice(index)];
    if(commitMixes(next,String(index),true)){
      $('preset-name').value=mix.name;
      $('studio-status').textContent='Mezcla recuperada. Cargala en pausa para usarla.';
    }
  }
  function initMixActions() {
    $('save-mix').addEventListener('click',()=>{
      const name=$('preset-name').value.trim(); if(!name){$('studio-status').textContent='Escribí un nombre para tu mezcla.';return;}
      if(state.mixes.length>=50){$('studio-status').textContent='Podés guardar hasta 50 mezclas.';return;}
      if(commitMixes([...state.mixes,currentMix(name)],String(state.mixes.length),true))$('studio-status').textContent='Mezcla guardada.';
    });
    $('load-mix').addEventListener('click',()=>{
      if($('saved-mixes').value==='')return;
      const mix=state.mixes[Number($('saved-mixes').value)];if(!mix)return;
      const {playing,transitioning}=getPlaybackState();
      if(playing||transitioning){$('studio-status').textContent=transitioning?'Esperá a que termine el inicio del audio para cargar una mezcla.':'Pausá la sesión antes de cargar una mezcla.';return;}
      applySavedMix(mix);
      $('studio-status').textContent='Mezcla cargada.';
    });
    $('delete-mix').addEventListener('click',deleteSelectedMix);
    $('undo-delete-mix').addEventListener('click',undoMixDeletion);

    $('saved-mixes').addEventListener('change',()=>{
      syncMixActions();
      const mix=state.mixes[selectedMixIndex()];
      if(mix)$('preset-name').value=mix.name;
    });
    $('update-mix').addEventListener('click',()=>{
      const i=selectedMixIndex();if(i<0)return;
      const next=state.mixes.map((mix,j)=>j===i?currentMix(mix.name,mix.favorite===true):mix);
      if(commitMixes(next,String(i)))$('studio-status').textContent='Ajustes de la mezcla actualizados.';
    });
    $('duplicate-mix').addEventListener('click',()=>{
      const index=selectedMixIndex();if(index<0)return;
      try {
        const copy=createMixCopy(state.mixes,index);
        if(commitMixes([...state.mixes,copy],String(state.mixes.length),true)){
          $('preset-name').value=copy.name;
          $('studio-status').textContent='Copia guardada. Cargala en pausa para editar su sonido.';
        }
      }catch(error){$('studio-status').textContent=error.message;}
    });
    $('rename-mix').addEventListener('click',()=>{
      const i=selectedMixIndex(),name=$('preset-name').value.trim();if(i<0)return;
      if(!name){$('studio-status').textContent='Escribí el nuevo nombre.';return;}
      if(commitMixes(state.mixes.map((mix,j)=>j===i?{...mix,name}:mix),String(i),true))$('studio-status').textContent='Mezcla renombrada.';
    });
    $('favorite-mix').addEventListener('click',()=>{
      const i=selectedMixIndex();if(i<0)return;
      commitMixes(state.mixes.map((mix,j)=>j===i?{...mix,favorite:mix.favorite!==true}:mix),String(i));
    });
  }

  return {syncMixUndoUI,commitMixes,deleteSelectedMix,undoMixDeletion,initMixActions};
}
