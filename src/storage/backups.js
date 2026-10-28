import {createCycleTools} from '../session/cycles.js';
      function createBackupTools(storage) {
        const keys={mixes:'focus-mixes-v3',history:'focus-daily-history-v1',ratings:'focus-feedback-v3',settings:'focus-audio-settings-v2',studio:'focus-studio-v3',session:'focus-session-v1'};
        const undoKey='focus-backup-undo-v1';
        const backupCycles=createCycleTools();
        const scenes=['rain','ocean','space','speech','fire','wind'];
        const object=value=>value && typeof value==='object' && !Array.isArray(value);
        const number=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max;
        const requireValid=(condition,message)=>{if(!condition)throw Error(message);};
        const normalizeStudio=value=>{
          requireValid(object(value)&&scenes.includes(value.scene)&&number(value.evolution,0,100)&&number(value.brightness,0,100)&&typeof value.melody==='boolean'&&(value.stereoWidth===undefined||number(value.stereoWidth,0,100))&&(value.balance===undefined||(Number.isInteger(value.balance)&&number(value.balance,-100,100)))&&(value.notePace===undefined||['sparse','normal','frequent'].includes(value.notePace))&&(value.fadeInSeconds===undefined||[0,3,12,30].includes(value.fadeInSeconds))&&(value.fadeOutSeconds===undefined||[5,20,60].includes(value.fadeOutSeconds))&&(value.preserveMix===undefined||typeof value.preserveMix==='boolean')&&(value.restSound===undefined||['sound','silent'].includes(value.restSound)),'Ajustes de ambiente inválidos.');
          return {scene:value.scene,evolution:value.evolution,brightness:value.brightness,melody:value.melody,stereoWidth:value.stereoWidth??100,balance:value.balance??0,notePace:value.notePace??'normal',fadeOutSeconds:value.fadeOutSeconds??20,fadeInSeconds:value.fadeInSeconds??12,preserveMix:value.preserveMix??false,restSound:value.restSound??'sound'};
        };
        const normalizeLevels=value=>{
          requireValid(object(value)&&['master','noise','drone','notes'].every(key=>number(value[key],0,100)),'Volúmenes inválidos.');
          return Object.fromEntries(['master','noise','drone','notes'].map(key=>[key,value[key]]));
        };
        function normalizeData(data) {
          requireValid(object(data)&&Array.isArray(data.mixes)&&data.mixes.length<=50&&Array.isArray(data.ratings)&&data.ratings.length<=200&&object(data.history),'Contenido de la copia inválido o fuera de los límites.');
          const mixes=data.mixes.map(mix=>{
            requireValid(object(mix)&&typeof mix.name==='string'&&mix.name.trim().length>0&&mix.name.length<=60&&backupCycles.validDuration(mix.duration),'Mezcla inválida.');
            requireValid(mix.favorite===undefined||typeof mix.favorite==='boolean','Favorita inválida.');
            const cyclePlan=mix.cyclePlan===undefined?'single':mix.cyclePlan;
            requireValid(Object.prototype.hasOwnProperty.call(backupCycles.plans,cyclePlan)&&(cyclePlan==='single'?backupCycles.validDuration(mix.duration):backupCycles.plans[cyclePlan].focus===mix.duration),'Plan de mezcla inválido.');
            return {...normalizeStudio(mix),name:mix.name.trim(),duration:mix.duration,cyclePlan,favorite:mix.favorite===true,levels:normalizeLevels(mix.levels)};
          });
          const dates=Object.keys(data.history);
          requireValid(dates.length<=3660,'El historial supera el límite de 3660 días.');
          const history={};
          dates.forEach(date=>{
            requireValid(/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T00:00:00Z'))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date&&number(data.history[date],0,10080),'Entrada de historial inválida.');
            history[date]=data.history[date];
          });
          const ratings=data.ratings.map(record=>{
            requireValid(object(record)&&typeof record.date==='string'&&Number.isFinite(Date.parse(record.date))&&scenes.includes(record.scene)&&Number.isInteger(record.rating)&&number(record.rating,1,5)&&number(record.minutes,0.01,10080)&&['low','medium','high'].includes(record.distractions),'Valoración inválida.');
            const clean={date:new Date(record.date).toISOString(),scene:record.scene,rating:record.rating,minutes:record.minutes,distractions:record.distractions};
            if(record.evolution!==undefined) {
              requireValid(number(record.evolution,0,100)&&number(record.brightness,0,100)&&typeof record.melody==='boolean','Ajustes de valoración inválidos.');
              Object.assign(clean,{evolution:record.evolution,brightness:record.brightness,melody:record.melody});
            }
            return clean;
          });
          let session=null;
          if(data.session!==null&&data.session!==undefined) {
            requireValid(object(data.session)&&number(data.session.elapsed,0,7*86400000),'Sesión inválida.');
            const cycle=data.session.cycle===undefined?null:backupCycles.normalize(data.session.cycle);
            requireValid(data.session.cycle===undefined?backupCycles.validDuration(data.session.duration):cycle&&backupCycles.duration(cycle)===data.session.duration,'Plan de sesión inválido.');
            session={duration:data.session.duration,elapsed:data.session.elapsed};
            if(cycle)session.cycle=cycle;
          }
          return {mixes,history,ratings,settings:normalizeLevels(data.settings),studio:normalizeStudio(data.studio),session};
        }
        function collect() {
          const read=(key,fallback)=>{
            const raw=storage.getItem(key);
            if(raw===null)return fallback;
            try{return JSON.parse(raw);}catch(_){throw Error('Hay datos locales que no se pudieron leer.');}
          };
          return normalizeData({
            mixes:read(keys.mixes,[]),history:read(keys.history,{}),ratings:read(keys.ratings,[]),
            settings:read(keys.settings,{master:75,noise:70,drone:60,notes:55}),
            studio:read(keys.studio,{scene:'rain',evolution:35,brightness:50,melody:true}),
            session:read(keys.session,null)
          });
        }
        function exportBackup() {
          return {format:'focus-studio-backup',version:1,createdAt:new Date().toISOString(),data:collect()};
        }
        function validateBackup(file) {
          requireValid(object(file)&&file.format==='focus-studio-backup'&&file.version===1,'No es una copia de FOCUS compatible.');
          return normalizeData(file.data);
        }
        const mixIdentity=mix=>JSON.stringify([mix.name,mix.cyclePlan||'single',mix.scene,mix.evolution,mix.brightness,mix.melody,mix.stereoWidth??100,mix.balance??0,mix.notePace??'normal',mix.fadeOutSeconds??20,mix.fadeInSeconds??12,mix.preserveMix??false,mix.restSound??'sound',mix.duration,mix.levels.master,mix.levels.noise,mix.levels.drone,mix.levels.notes]);
        const ratingIdentity=record=>JSON.stringify([record.date,record.scene,record.rating,record.minutes,record.distractions]);
        function planImport(file,includeSettings=false) {
          const incoming=validateBackup(file),current=collect(),mixes=current.mixes.map(mix=>({...mix}));
          incoming.mixes.forEach(mix=>{
            const existing=mixes.find(item=>mixIdentity(item)===mixIdentity(mix));
            if(existing)existing.favorite=existing.favorite||mix.favorite;
            else mixes.push(mix);
          });
          requireValid(mixes.length<=50,'La combinación supera 50 mezclas. Eliminá algunas o importá una copia más pequeña.');
          const history={...current.history};
          Object.entries(incoming.history).forEach(([day,minutes])=>{history[day]=Math.max(history[day]||0,minutes);});
          requireValid(Object.keys(history).length<=3660,'La combinación supera 3660 días de historial.');
          const ratingsById=new Map(current.ratings.map(record=>[ratingIdentity(record),record]));
          const uniqueRatingsBefore=ratingsById.size;
          incoming.ratings.forEach(record=>{if(!ratingsById.has(ratingIdentity(record)))ratingsById.set(ratingIdentity(record),record);});
          const allRatings=[...ratingsById.values()].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
          const data={...current,mixes,history,ratings:allRatings.slice(-200)};
          if(includeSettings)Object.assign(data,{settings:incoming.settings,studio:incoming.studio,session:incoming.session});
          return {data,summary:{mixesAdded:mixes.length-current.mixes.length,ratingsAdded:allRatings.length-uniqueRatingsBefore,ratingsDiscarded:Math.max(0,allRatings.length-200),daysInFile:Object.keys(incoming.history).length,mixesInFile:incoming.mixes.length,ratingsInFile:incoming.ratings.length,includeSettings}};
        }
        function rawSnapshot() {
          return Object.fromEntries(Object.values(keys).map(key=>[key,storage.getItem(key)]));
        }
        function writeRaw(values) {
          const before=rawSnapshot();
          try {
            Object.entries(values).forEach(([key,value])=>{if(value===null)storage.removeItem(key);else storage.setItem(key,value);});
          } catch(error) {
            let rollbackFailed=false;
            Object.entries(before).forEach(([key,value])=>{try{if(value===null)storage.removeItem(key);else storage.setItem(key,value);}catch(_){rollbackFailed=true;}});
            if(rollbackFailed)throw Error('La restauración falló y no pudo revertirse por completo. Conservá tu archivo de copia para recuperar los datos.');
            throw Error('No se pudo guardar la restauración. Se conservaron los datos anteriores.');
          }
        }
        function applyImport(file,includeSettings=false) {
          const plan=planImport(file,includeSettings),before=rawSnapshot();
          const previousUndo=storage.getItem(undoKey);
          try {
            storage.setItem(undoKey,JSON.stringify({version:1,values:before}));
            writeRaw(Object.fromEntries(Object.entries(keys).map(([name,key])=>[key,JSON.stringify(plan.data[name])])));
          } catch(error) {
            try{if(previousUndo===null)storage.removeItem(undoKey);else storage.setItem(undoKey,previousUndo);}catch(_){}
            throw error;
          }
          return plan.summary;
        }
        function undoImport() {
          const raw=storage.getItem(undoKey);requireValid(raw!==null,'No hay una restauración para deshacer.');
          const saved=JSON.parse(raw);
          requireValid(saved.version===1&&object(saved.values)&&Object.keys(saved.values).length===Object.values(keys).length&&Object.values(keys).every(key=>saved.values[key]===null||typeof saved.values[key]==='string'),'La copia de recuperación no es válida.');
          writeRaw(Object.fromEntries(Object.values(keys).map(key=>[key,saved.values[key]])));
          storage.removeItem(undoKey);
        }
        return {exportBackup,validateBackup,planImport,applyImport,undoImport,canUndo:()=>storage.getItem(undoKey)!==null};
      }
export {createBackupTools};
