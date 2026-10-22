import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('      function createBackupTools(storage)'),end=html.indexOf('      const backupTools=createBackupTools',start);
assert.ok(start>=0 && end>start);
const createTools=new Function(html.slice(start,end)+'return createBackupTools;')();
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
