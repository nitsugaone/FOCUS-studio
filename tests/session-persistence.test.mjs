import assert from 'node:assert/strict';
import {SessionPersistence} from '../src/session/SessionPersistence.js';
import {StorageService} from '../src/storage/StorageService.js';
import {createCycleTools} from '../src/session/cycles.js';

const KEY='focus-session-v1',cycles=createCycleTools();
function fixture() {
 const memory=new Map(),faults={read:false,write:false},receivers=[];let now=10000;
 const storage=new StorageService({getItem(key){if(faults.read)throw Error('Read blocked');return memory.get(key)??null;},
  setItem(key,value){if(faults.write)throw Error('Write blocked');memory.set(key,value);},removeItem:key=>memory.delete(key)});
 const persistence=new SessionPersistence({storage,cycleTools:cycles,currentTime:function(){receivers.push(this);return now;}});
 return {persistence,memory,faults,receivers,setTime(value){now=value;},saved:()=>JSON.parse(memory.get(KEY))};
}
const snapshot=elapsed=>({duration:25,elapsed,cycle:cycles.initial('single',25)});
const cadence=fixture(),original=snapshot(1234);
cadence.memory.set('focus-mixes-v3','unchanged');
assert.equal(cadence.persistence.save(original),true);
original.elapsed=9999;assert.equal(cadence.saved().elapsed,1234,'Saved JSON is a snapshot');
cadence.setTime(14999);assert.equal(cadence.persistence.save(snapshot(4567)),undefined);
assert.equal(cadence.saved().elapsed,1234);
cadence.setTime(15000);assert.equal(cadence.persistence.save(snapshot(4567)),true);
cadence.setTime(15001);assert.equal(cadence.persistence.save(snapshot(4568),true),true);
cadence.faults.write=true;cadence.setTime(15002);
assert.equal(cadence.persistence.save(snapshot(4569),true),false);
assert.equal(cadence.saved().elapsed,4568);
cadence.faults.write=false;cadence.setTime(20001);
assert.equal(cadence.persistence.save(snapshot(5000)),undefined,'A failed write retains the existing save-attempt cadence');
cadence.setTime(20002);assert.equal(cadence.persistence.save(snapshot(5000)),true);
cadence.setTime(1000);assert.equal(cadence.persistence.save(snapshot(6000)),undefined);
assert.equal(cadence.persistence.save(snapshot(6000),true),true,'Forced saves remain available after a backwards time change');
assert.equal(cadence.memory.get('focus-mixes-v3'),'unchanged');
assert.ok(cadence.receivers.every(receiver=>receiver===undefined),'Injected time is called without a foreign receiver');
const zero=fixture();zero.setTime(0);
assert.equal(zero.persistence.save(snapshot(0)),undefined);
assert.equal(zero.persistence.save(snapshot(0),true),true);

const restored=fixture();
assert.equal(restored.persistence.restore(),null);
for(const raw of ['{','null','false','{}','[]',JSON.stringify({duration:25,elapsed:-1}),
 JSON.stringify({duration:25,elapsed:7*86400000+1}),JSON.stringify({duration:25,elapsed:'1000'}),
 JSON.stringify({duration:181,elapsed:0}),JSON.stringify({duration:'25',elapsed:1000}),
 JSON.stringify({duration:25,elapsed:0,cycle:{plan:'unknown'}}),
 JSON.stringify({duration:10,elapsed:0,cycle:cycles.initial('25-5',17)})]){
 restored.memory.set(KEY,raw);assert.equal(restored.persistence.restore(),null);
 assert.equal(restored.memory.get(KEY),raw,'Invalid restoration does not rewrite stored data');
}
restored.memory.set(KEY,JSON.stringify({duration:17,elapsed:1234.5}));
assert.deepEqual(restored.persistence.restore(),{duration:17,elapsed:1234.5,cycle:cycles.initial('single',17)});
restored.memory.set(KEY,JSON.stringify({duration:17,elapsed:1000,cycle:null}));
assert.deepEqual(restored.persistence.restore(),{duration:17,elapsed:1000,cycle:cycles.initial('single',17)});
restored.memory.set(KEY,JSON.stringify({duration:1,elapsed:90000}));
assert.deepEqual(restored.persistence.restore(),{duration:1,elapsed:60000,cycle:cycles.initial('single',1)});
restored.memory.set(KEY,JSON.stringify({duration:0,elapsed:7*86400000}));
assert.deepEqual(restored.persistence.restore(),{duration:0,elapsed:7*86400000,cycle:cycles.initial('single',0)});

for(const phase of ['focus','rest']) {
 const cycle={...cycles.initial('25-5',17),phase},duration=phase==='focus'?25:5;
 const stored={duration,elapsed:duration*60000+1000,cycle};
 restored.memory.set(KEY,JSON.stringify(stored));
 assert.deepEqual(restored.persistence.restore(),{duration,elapsed:duration*60000,cycle:{...cycle,completed:true}},'Completed phases stay on the same round and phase');
 assert.deepEqual(JSON.parse(restored.memory.get(KEY)),stored,'Restore completion is applied in memory');
}
const pausedCycle={...cycles.initial('50-10',12),phase:'rest'};
restored.memory.set(KEY,JSON.stringify({duration:10,elapsed:5000,cycle:pausedCycle}));
assert.deepEqual(restored.persistence.restore(),{duration:10,elapsed:5000,cycle:pausedCycle});
restored.faults.read=true;assert.equal(restored.persistence.restore(),null);

console.log('PASS: real session persistence, cadence/forced/failed saves, legacy data, invalid snapshots, free sessions and capped cycle restoration');
