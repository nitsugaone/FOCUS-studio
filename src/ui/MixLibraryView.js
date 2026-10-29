import {SCENES} from '../audio/scenes.js';
import {mixSearchIndices} from '../storage/mixes.js';

// Saved-mix presentation reads shared library state; persistence remains in its controller.
export function createMixLibraryView({document,Option,$,state,cycleTools,syncMixUndoUI}) {
  function selectedMixIndex() {
    const value=$('saved-mixes').value;
    return value!=='' && state.mixes[Number(value)] ? Number(value) : -1;
  }

  function renderMixes(selected='') {
    const select=$('saved-mixes');select.replaceChildren(new Option('Elegí una mezcla',''));
    const favorites=$('favorite-mixes');favorites.replaceChildren();
    const query=$('mix-search').value,indices=mixSearchIndices(state.mixes,query);
    indices.forEach(i=>{
      const mix=state.mixes[i];
      select.add(new Option((mix.favorite?'★ ':'')+mix.name,String(i)));
      if(mix.favorite) {
        const button=document.createElement('button');
        button.type='button';button.className='subtle-button';
        button.textContent='★ '+mix.name;
        button.addEventListener('click',()=>{
          select.value=String(i);syncMixActions();$('preset-name').value=mix.name;$('load-mix').click();
        });
        favorites.append(button);
      }
    });
    select.value=indices.some(i=>String(i)===String(selected))?String(selected):'';
    select.disabled=indices.length===0;
    $('clear-mix-search').hidden=query.length===0;
    $('mix-search-status').textContent=!state.mixes.length?'Todavía no guardaste mezclas.':!indices.length?'No hay mezclas que coincidan. Probá con otro nombre.':indices.length+' de '+state.mixes.length+' mezclas';
    syncMixActions();syncMixUndoUI();
  }

  function syncMixActions() {
    const index=selectedMixIndex(), mix=state.mixes[index];
    ['update-mix','duplicate-mix','rename-mix','favorite-mix','delete-mix','load-mix'].forEach(id=>$(id).disabled=index<0);
    $('favorite-mix').textContent=mix?.favorite ? 'Quitar de favoritas' : 'Marcar favorita';
    $('favorite-mix').setAttribute('aria-pressed',String(Boolean(mix?.favorite)));
    syncSavedMixPreview(mix);
  }

  function syncSavedMixPreview(mix) {
    $('saved-mix-preview').hidden=!mix;
    $('saved-mix-sound').textContent='';
    $('saved-mix-session').textContent='';
    if(!mix)return;
    const plan=Object.prototype.hasOwnProperty.call(cycleTools.plans,mix.cyclePlan)?mix.cyclePlan:'single';
    const duration=cycleTools.validDuration(mix.duration)?mix.duration:0;
    const session=plan==='single'?(duration?duration+' minutos':'Sesión libre'):'Ciclo '+plan.replace('-','/')+' min · Descansos '+(mix.restSound==='silent'?'en silencio':'con sonido');
    $('saved-mix-sound').textContent=mix.name+' · '+SCENES[mix.scene].label+' · '+(mix.melody?'Melodía activada':'Sin melodía');
    $('saved-mix-session').textContent=session+' · Maestro '+mix.levels.master+'% · Textura '+mix.levels.noise+'% · Drone '+mix.levels.drone+'% · Notas '+mix.levels.notes+'%';
  }

  return {selectedMixIndex,renderMixes,syncMixActions};
}
