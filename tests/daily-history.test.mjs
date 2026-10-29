import assert from 'node:assert/strict';
import {createDailyHistory} from '../src/storage/DailyHistory.js';
import {StorageService} from '../src/storage/StorageService.js';

const KEY='focus-daily-history-v1';
function fixture({raw,date=new Date(2026,0,1,12),failRead=false,failWrite=false}={}) {
 const memory=new Map(),faults={read:failRead,write:failWrite};
 if(raw!==undefined)memory.set(KEY,raw);
 let current=new Date(date);
 const adapter={
  getItem(key){if(faults.read)throw Error('Read blocked');return memory.get(key)??null;},
  setItem(key,value){if(faults.write)throw Error('Write blocked');memory.set(key,value);},
  removeItem(key){memory.delete(key);}
 };
 const history=createDailyHistory({storage:new StorageService(adapter),currentDate:()=>new Date(current)});
 history.loadHistory();
 return {history,memory,faults,setDate(value){current=new Date(value);},saved(){return JSON.parse(memory.get(KEY));}};
}

for(const raw of [undefined,'{','null','42','false','"invalid"']) {
 const f=fixture({raw});
 assert.deepEqual(f.saved(),{'2026-01-01':0});
 assert.equal(f.history.getLast7DaysData().at(-1).minutes,0);
}
const rounded=fixture();
rounded.history.addFocusSecondsToToday(15);
assert.equal(rounded.saved()['2026-01-01'],0.3);
rounded.history.addFocusSecondsToToday(15);
assert.equal(rounded.saved()['2026-01-01'],0.6,'Each update keeps the existing tenth-minute rounding');
rounded.history.addFocusSecondsToToday(60);
assert.equal(rounded.saved()['2026-01-01'],1.6);
assert.equal(rounded.history.getLast7DaysData().at(-1).minutes,2,'The view rounds to whole minutes');
const savedBefore=rounded.memory.get(KEY);
for(const value of [0,-1])rounded.history.addFocusSecondsToToday(value);
assert.equal(rounded.memory.get(KEY),savedBefore);

const days=rounded.history.getLast7DaysData();
assert.deepEqual(days.map(d=>d.dateKey),['2025-12-26','2025-12-27','2025-12-28','2025-12-29','2025-12-30','2025-12-31','2026-01-01']);
assert.deepEqual(days.map(d=>d.dayLabel),['Vie','Sáb','Dom','Lun','Mar','Mié','Hoy']);
assert.deepEqual(days.map(d=>d.dayNum),['26/12','27/12','28/12','29/12','30/12','31/12','1/1']);
assert.deepEqual(days.map(d=>d.isToday),[false,false,false,false,false,false,true]);
rounded.setDate(new Date(2026,0,2,0,1));
rounded.history.addFocusSecondsToToday(120);
assert.deepEqual(rounded.saved(),{'2026-01-01':1.6,'2026-01-02':2});
assert.equal(rounded.history.getLast7DaysData().at(-1).dateKey,'2026-01-02');
assert.equal(rounded.history.getLast7DaysData().at(-1).minutes,2);
const leap=fixture({date:new Date(2024,2,1,12)});
assert.deepEqual(leap.history.getLast7DaysData().map(d=>d.dateKey),['2024-02-24','2024-02-25','2024-02-26','2024-02-27','2024-02-28','2024-02-29','2024-03-01']);

const seeded=fixture({raw:JSON.stringify({'2025-12-28':9,'2025-12-29':0,'2025-12-30':2,'2025-12-31':'2.6','2026-01-01':'old'})});
assert.equal(seeded.saved()['2026-01-01'],0,'A nonnumeric current-day value keeps the existing reset behavior');
assert.equal(seeded.history.getLast7DaysData().at(-2).minutes,3,'Past numeric values retain their display conversion');
assert.equal(seeded.history.calculateStreak(seeded.history.getLast7DaysData()),2,'An empty today allows the previous streak');
seeded.history.addFocusSecondsToToday(60);
assert.equal(seeded.history.calculateStreak(seeded.history.getLast7DaysData()),3);
seeded.memory.set('focus-mixes-v3','unchanged');
seeded.history.resetHistory();
assert.deepEqual(seeded.saved(),{'2026-01-01':0});
assert.equal(seeded.history.calculateStreak(seeded.history.getLast7DaysData()),0);
assert.equal(seeded.memory.get('focus-mixes-v3'),'unchanged');

const blocked=fixture({failRead:true,failWrite:true});
assert.doesNotThrow(()=>blocked.history.addFocusSecondsToToday(120));
assert.equal(blocked.history.getLast7DaysData().at(-1).minutes,2,'Failed writes keep history in memory');
assert.equal(blocked.memory.has(KEY),false);
blocked.faults.read=false;blocked.faults.write=false;
blocked.history.addFocusSecondsToToday(60);
assert.deepEqual(blocked.saved(),{'2026-01-01':3});
blocked.faults.write=true;
assert.doesNotThrow(()=>blocked.history.resetHistory());
assert.equal(blocked.history.getLast7DaysData().at(-1).minutes,0);
assert.deepEqual(blocked.saved(),{'2026-01-01':3},'A failed reset preserves the persisted snapshot');

console.log('PASS: daily history persistence, existing rounding, local dates, year/leap boundaries, streaks, reset and storage failures');
