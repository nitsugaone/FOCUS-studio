// Coordinates saved-mix transactions and recovery with explicit UI dependencies.
export function createMixLibraryController({state,$,writeLocal,renderMixes,selectedMixIndex}) {
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
  return {syncMixUndoUI,commitMixes,deleteSelectedMix,undoMixDeletion};
}
