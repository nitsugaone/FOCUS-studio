import {SCENES} from '../audio/scenes.js';
      function summarizeRatings(records, days=30, scene='all', now=Date.now()) {
        const allowedScenes=Object.keys(SCENES);
        const valid=(Array.isArray(records)?records:[]).slice(-200).filter(record=>{
          if(!record || typeof record!=='object')return false;
          const date=typeof record.date==='string'?Date.parse(record.date):NaN;
          return Number.isFinite(date) && date<=now
            && allowedScenes.includes(record.scene)
            && Number.isInteger(record.rating) && record.rating>=1 && record.rating<=5
            && Number.isFinite(record.minutes) && record.minutes>0 && record.minutes<=10080
            && ['low','medium','high'].includes(record.distractions);
        });
        const period=[0,7,30].includes(days)?days:30;
        const rows=valid.filter(record=>(!period || Date.parse(record.date)>=now-period*86400000) && (scene==='all'||record.scene===scene))
          .sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
        const groups=allowedScenes.map(id=>{
          const entries=rows.filter(record=>record.scene===id);
          return {scene:id,count:entries.length,average:entries.length ? entries.reduce((sum,row)=>sum+row.rating,0)/entries.length : 0,
            lowDistractions:entries.filter(row=>row.distractions==='low').length};
        }).filter(group=>group.count>0).sort((a,b)=>b.average-a.average||b.count-a.count);
        const eligible=groups.filter(group=>group.count>=3);
        const best=eligible.length>=2 && Math.round(eligible[0].average*10)>Math.round(eligible[1].average*10) ? eligible[0] : null;
        return {rows,groups,best,count:rows.length,average:rows.length?rows.reduce((sum,row)=>sum+row.rating,0)/rows.length:0};
      }
export {summarizeRatings};
