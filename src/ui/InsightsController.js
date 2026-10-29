import {SCENES} from '../audio/scenes.js';
import {summarizeRatings} from '../storage/insights.js';

// Existing insights view and filter events, with explicit DOM/storage adapters.
export function createInsightsController({document,$,storage}) {
  function renderInsights() {
    const days=Number($('insights-period').value || 30),scene=$('insights-scene').value || 'all';
    const result=summarizeRatings(storage.read('focus-feedback-v3',[]),days,scene);
    $('insights-summary').textContent=result.count
      ? result.count+' '+(result.count===1?'valoración':'valoraciones')+' · Ayuda promedio: '+result.average.toFixed(1)+' de 5.'
      : 'Todavía no hay valoraciones para estos filtros.';
    $('insights-empty').hidden=result.count>0;
    $('insights-table-wrap').hidden=result.count===0;
    $('insights-comparison').textContent=!result.count ? '' : scene!=='all' ? 'Elegí Todos para comparar los ambientes entre sí.' : result.best
      ? SCENES[result.best.scene].label+' tiene el mayor promedio entre ambientes con al menos 3 valoraciones cada uno. Es una comparación orientativa.'
      : 'Para destacar un ambiente se necesitan al menos 3 valoraciones en cada uno de dos ambientes y promedios diferentes.';
    const body=$('insights-rows');body.replaceChildren();
    result.groups.forEach(group=>{
      const row=document.createElement('tr');
      [SCENES[group.scene].label,String(group.count),group.average.toFixed(1),group.lowDistractions+' de '+group.count].forEach(value=>{
        const cell=document.createElement('td');cell.textContent=value;row.append(cell);
      });
      body.append(row);
    });
    const recent=$('insights-recent');recent.replaceChildren();
    const distractions={low:'Pocas',medium:'Algunas',high:'Muchas'};
    result.rows.slice(0,10).forEach(record=>{
      const item=document.createElement('li'),title=document.createElement('strong'),details=document.createElement('p');
      title.textContent=SCENES[record.scene].label+' · '+record.rating+' de 5';
      const date=new Date(record.date);
      details.textContent=date.toLocaleDateString('es-AR')+' '+date.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})+
        ' · '+record.minutes+' min · '+distractions[record.distractions]+' distracciones';
      item.append(title);item.append(details);recent.append(item);
    });
  }
  function initInsights() {
    ['insights-period','insights-scene'].forEach(id=>$(id).addEventListener('change',renderInsights));
    renderInsights();
  }
  return {renderInsights,initInsights};
}
