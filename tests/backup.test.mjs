import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('      function createBackupTools(storage)'),end=html.indexOf('      const backupTools=createBackupTools',start);
assert.ok(start>=0 && end>start);
const cycleStart=html.indexOf('      function createCycleTools()'),cycleEnd=html.indexOf('      const cycleTools=createCycleTools()',cycleStart);
const createTools=new Function(html.slice(cycleStart,cycleEnd)+html.slice(start,end)+'return createBackupTools;')();
class MemoryStorage {
 constructor(){this.values=new Map();this.failKey=null;}
 getItem(key){return this.values.get(key)??null;}
 setItem(key,value){if(this.failKey===key){this.failKey=null;throw Error('Quota exceeded');}this.values.set(key,value);}
 removeItem(key){this.values.delete(key);}
}
const storage=new MemoryStorage(),tools=createTools(storage);
storage.setItem('focus-audio-settings-v2',JSON.stringify({master:30,noise:70,drone:60,notes:55}));
const empty=tools.exportBackup();
assert.equal(empty.format,'focus-studio-backup');
assert.equal(tools.validateBackup(empty).mixes.length,0);
const scene={scene:'rain',evolution:35,brightness:50,melody:true};
const mix={...scene,name:'Lectura',duration:25,favorite:true,levels:{master:90,noise:75,drone:20,notes:15}};
const rating={scene:'rain',rating:5,date:'2026-10-22T12:00:00Z',minutes:25,distractions:'low'};
const file={...empty,data:{...empty.data,mixes:[mix],history:{'2026-10-22':40},ratings:[rating],settings:mix.levels,studio:scene,session:{duration:25,elapsed:60000}}};
const rawBefore=JSON.stringify([...storage.values]);
const plan=tools.planImport(file);
assert.equal(plan.summary.mixesAdded,1);
assert.equal(JSON.stringify([...storage.values]),rawBefore,'Preview must not write');
tools.applyImport(file);
assert.equal(JSON.parse(storage.getItem('focus-audio-settings-v2')).master,30,'Current volume is preserved by default');
assert.equal(JSON.parse(storage.getItem('focus-mixes-v3')).length,1);
assert.equal(JSON.parse(storage.getItem('focus-daily-history-v1'))['2026-10-22'],40);
tools.applyImport(file);
assert.equal(JSON.parse(storage.getItem('focus-mixes-v3')).length,1,'Repeated import is idempotent');
assert.equal(JSON.parse(storage.getItem('focus-feedback-v3')).length,1);
assert.equal(JSON.parse(storage.getItem('focus-daily-history-v1'))['2026-10-22'],40,'Daily time is not added twice');
tools.applyImport({...file,data:{...file.data,history:{'2026-10-22':20}}});
assert.equal(JSON.parse(storage.getItem('focus-daily-history-v1'))['2026-10-22'],40,'Daily merge keeps maximum');
tools.applyImport(file,true);
assert.equal(JSON.parse(storage.getItem('focus-audio-settings-v2')).master,90);
assert.equal(JSON.parse(storage.getItem('focus-session-v1')).elapsed,60000);
assert.equal(tools.canUndo(),true);
tools.undoImport();
assert.equal(JSON.parse(storage.getItem('focus-audio-settings-v2')).master,30);
assert.equal(tools.canUndo(),false);
const clone=value=>JSON.parse(JSON.stringify(value));
const badVersion=clone(file);badVersion.version=2;
assert.throws(()=>tools.validateBackup(badVersion));
const invalid=clone(file);invalid.data.history={'2026-02-30':10};
assert.throws(()=>tools.validateBackup(invalid));
const hostile=clone(file);hostile.data.history=JSON.parse('{"__proto__":1}');
assert.throws(()=>tools.validateBackup(hostile));
const invalidMix=clone(file);invalidMix.data.mixes[0].name='';
assert.throws(()=>tools.validateBackup(invalidMix));
const invalidRating=clone(file);invalidRating.data.ratings[0].rating=6;
assert.throws(()=>tools.validateBackup(invalidRating));
storage.setItem('focus-mixes-v3',JSON.stringify(Array.from({length:50},(_,i)=>({...mix,name:'Mix '+i}))));
assert.throws(()=>tools.planImport(file),'Import cannot silently exceed mix limit');
storage.setItem('focus-mixes-v3',JSON.stringify([mix]));
const snapshot=JSON.stringify([...storage.values]);
storage.failKey='focus-feedback-v3';
assert.throws(()=>tools.applyImport({...file,data:{...file.data,history:{'2026-10-23':60}}}));
assert.equal(JSON.stringify([...storage.values]),snapshot,'Failed write restores data and previous undo');
console.log('PASS: backup validation, preview, idempotency, merge, optional settings, undo and storage rollback');

const cycleCopy=clone(file);
cycleCopy.data.mixes[0].duration=50;cycleCopy.data.mixes[0].cyclePlan='50-10';
cycleCopy.data.session={duration:10,elapsed:120000,cycle:{plan:'50-10',round:1,phase:'rest',completed:false,singleDuration:0}};
assert.equal(tools.validateBackup(cycleCopy).mixes[0].cyclePlan,'50-10');
assert.equal(tools.validateBackup(cycleCopy).session.cycle.phase,'rest');
const invalidCycleCopy=clone(cycleCopy);invalidCycleCopy.data.session.duration=5;
assert.throws(()=>tools.validateBackup(invalidCycleCopy),'Cycle and phase duration must agree');
const invalidPlan=clone(cycleCopy);invalidPlan.data.mixes[0].cyclePlan='unknown';
assert.throws(()=>tools.validateBackup(invalidPlan));
console.log('PASS: cycle plans and paused cycle sessions survive portable backups');

for(const minutes of [1,17,180]) {
 const custom=clone(file);
 custom.data.mixes[0].duration=minutes;
 custom.data.session={duration:minutes,elapsed:30000,cycle:{plan:'single',round:1,phase:'focus',completed:false,singleDuration:minutes}};
 const validated=tools.validateBackup(custom);
 assert.equal(validated.mixes[0].duration,minutes);
 assert.equal(validated.session.cycle.singleDuration,minutes);
 tools.applyImport(custom,true);
 assert.equal(tools.validateBackup(tools.exportBackup()).session.duration,minutes);
}
for(const minutes of [-1,181,1.5,'17']) {
 const invalid=clone(file);invalid.data.mixes[0].duration=minutes;
 assert.throws(()=>tools.validateBackup(invalid));
 const badSession=clone(file);badSession.data.session.duration=minutes;
 assert.throws(()=>tools.validateBackup(badSession));
}
const customCycle=clone(cycleCopy);customCycle.data.session.cycle.singleDuration=17;
assert.equal(tools.validateBackup(customCycle).session.cycle.singleDuration,17);
const wrongCycleMix=clone(cycleCopy);wrongCycleMix.data.mixes[0].duration=17;
assert.throws(()=>tools.validateBackup(wrongCycleMix),'Custom timers do not change fixed cycle lengths');
console.log('PASS: custom durations round-trip through backup and fixed cycles remain validated');

const oldStereo=tools.validateBackup(file);
assert.equal(oldStereo.studio.stereoWidth,100);
assert.equal(oldStereo.mixes[0].stereoWidth,100);
const widthCopy=clone(file);widthCopy.data.studio.stereoWidth=0;widthCopy.data.mixes[0].stereoWidth=37;
tools.applyImport(widthCopy,true);
const widthExport=tools.validateBackup(tools.exportBackup());
assert.equal(widthExport.studio.stereoWidth,0);
assert.ok(widthExport.mixes.some(mix=>mix.stereoWidth===37));
for(const stereoWidth of [-1,101,'50',null]){
 const invalid=clone(file);invalid.data.studio.stereoWidth=stereoWidth;
 assert.throws(()=>tools.validateBackup(invalid));
}
console.log('PASS: stereo settings survive backups and old copies preserve original width');

assert.equal(tools.validateBackup(file).studio.notePace,'normal');
assert.equal(tools.validateBackup(file).mixes[0].notePace,'normal');
const paceCopy=clone(file);paceCopy.data.studio.notePace='sparse';paceCopy.data.mixes[0].notePace='frequent';
tools.applyImport(paceCopy,true);
const paceExport=tools.validateBackup(tools.exportBackup());
assert.equal(paceExport.studio.notePace,'sparse');
assert.ok(paceExport.mixes.some(mix=>mix.notePace==='frequent'));
for(const notePace of ['unknown','__proto__',1,null]){
 const invalid=clone(file);invalid.data.studio.notePace=notePace;
 assert.throws(()=>tools.validateBackup(invalid));
}
console.log('PASS: note pace backups and old copies default to original timing');

assert.equal(tools.validateBackup(file).studio.fadeOutSeconds,20);
assert.equal(tools.validateBackup(file).mixes[0].fadeOutSeconds,20);
const fadeCopy=clone(file);fadeCopy.data.studio.fadeOutSeconds=60;fadeCopy.data.mixes[0].fadeOutSeconds=5;
tools.applyImport(fadeCopy,true);
const fadeExport=tools.validateBackup(tools.exportBackup());
assert.equal(fadeExport.studio.fadeOutSeconds,60);
assert.ok(fadeExport.mixes.some(mix=>mix.fadeOutSeconds===5));
for(const fadeOutSeconds of [0,10,61,'20',null]){
 const invalid=clone(file);invalid.data.studio.fadeOutSeconds=fadeOutSeconds;
 assert.throws(()=>tools.validateBackup(invalid));
}
console.log('PASS: closing preferences in backups and older data defaults');

assert.equal(tools.validateBackup(file).studio.preserveMix,false);
assert.equal(tools.validateBackup(file).mixes[0].preserveMix,false);
const preserveCopy=clone(file);preserveCopy.data.studio.preserveMix=true;preserveCopy.data.mixes[0].preserveMix=true;
tools.applyImport(preserveCopy,true);
const preserveExport=tools.validateBackup(tools.exportBackup());
assert.equal(preserveExport.studio.preserveMix,true);
assert.ok(preserveExport.mixes.some(mix=>mix.preserveMix===true));
for(const preserveMix of [0,1,'true',null]){
 const invalid=clone(file);invalid.data.studio.preserveMix=preserveMix;
 assert.throws(()=>tools.validateBackup(invalid));
}
console.log('PASS: preserving scene levels in backups and old data defaults');

assert.equal(tools.validateBackup(file).studio.restSound,'sound');
assert.equal(tools.validateBackup(file).mixes[0].restSound,'sound');
const restCopy=clone(file);restCopy.data.studio.restSound='silent';restCopy.data.mixes[0].restSound='silent';
tools.applyImport(restCopy,true);
const restExport=tools.validateBackup(tools.exportBackup());
assert.equal(restExport.studio.restSound,'silent');
assert.ok(restExport.mixes.some(mix=>mix.restSound==='silent'));
for(const restSound of ['unknown',true,1,null]){
 const invalid=clone(file);invalid.data.studio.restSound=restSound;assert.throws(()=>tools.validateBackup(invalid));
}
console.log('PASS: silent rest in backups and old data keeps audible rests');
