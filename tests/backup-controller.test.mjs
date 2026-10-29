import assert from 'node:assert/strict';
import {createBackupController} from '../src/ui/BackupController.js';
import {StorageService} from '../src/storage/StorageService.js';

function portable(name) {
 const levels={master:75,noise:70,drone:60,notes:55},studio={scene:'rain',evolution:35,brightness:50,melody:true};
 return JSON.stringify({format:'focus-studio-backup',version:1,data:{
  mixes:[{...studio,name,duration:25,levels}],history:{},ratings:[],settings:levels,studio,session:null
 }});
}
function deferredFile() {
 let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
 return {file:{size:100,text:()=>promise},resolve,reject};
}
function fixture() {
 const memory=new Map(),elements=new Map(),state={playing:false,transitioning:false},reloads=[],faults={write:false};
 const adapter={getItem:key=>memory.get(key)??null,setItem(key,value){if(faults.write)throw Error('Storage blocked');memory.set(key,value);},removeItem:key=>memory.delete(key)};
 const storage=new StorageService(adapter);
 const $=id=>{if(!elements.has(id))elements.set(id,{hidden:true,disabled:false,checked:false,value:'',files:[],events:{},addEventListener(type,callback){this.events[type]=callback;}});return elements.get(id);};
 const controller=createBackupController({window:{},document:{},$,storage,URL:{},Blob:class {},getPlaybackState:()=>state,
  reloadAfterRestore(){reloads.push(storage.read('focus-mixes-v3',[]).map(mix=>mix.name));}
 });
 controller.initBackups();
 return {controller,storage,memory,state,reloads,faults,$,
  select(file){$('backup-file').files=file?[file]:[];return $('backup-file').events.change();},
  click(id){return $(id).events.click();}
 };
}
const readyFile=name=>({size:100,text:async()=>portable(name)});

const latest=fixture(),older=deferredFile();
const oldRead=latest.select(older.file);await latest.select(readyFile('Latest'));
assert.equal(latest.$('backup-preview').hidden,false);
assert.equal(latest.memory.size,0,'Preview never writes local data');
older.resolve(portable('Obsolete'));await oldRead;
latest.click('import-backup');
assert.deepEqual(latest.storage.read('focus-mixes-v3',[]).map(mix=>mix.name),['Latest']);
assert.deepEqual(latest.reloads,[['Latest']],'Reload happens after the selected copy is applied');

const cancelled=fixture(),delayed=deferredFile();
const pending=cancelled.select(delayed.file);cancelled.click('cancel-backup');
delayed.resolve(portable('Cancelled'));await pending;
assert.equal(cancelled.$('backup-preview').hidden,true);
assert.equal(cancelled.$('import-backup').disabled,true);
assert.equal(cancelled.$('backup-status').textContent,'Importación cancelada.');
cancelled.click('import-backup');
assert.equal(cancelled.memory.size,0);assert.deepEqual(cancelled.reloads,[]);

const staleError=fixture(),failing=deferredFile();
const failedRead=staleError.select(failing.file);await staleError.select(readyFile('Still selected'));
const status=staleError.$('backup-status').textContent;
failing.reject(Error('Old read failed'));await failedRead;
assert.equal(staleError.$('backup-status').textContent,status);
assert.equal(staleError.$('backup-preview').hidden,false);
staleError.click('import-backup');assert.deepEqual(staleError.reloads,[['Still selected']]);

const guarded=fixture();await guarded.select(readyFile('Guarded'));
guarded.state.playing=true;guarded.controller.syncBackupButtons();
assert.equal(guarded.$('import-backup').disabled,true);guarded.click('import-backup');
guarded.state.playing=false;guarded.state.transitioning=true;guarded.controller.syncBackupButtons();
guarded.click('import-backup');assert.equal(guarded.memory.size,0);assert.deepEqual(guarded.reloads,[]);
guarded.state.transitioning=false;guarded.controller.syncBackupButtons();
guarded.faults.write=true;guarded.click('import-backup');
assert.equal(guarded.memory.size,0);assert.deepEqual(guarded.reloads,[]);
assert.ok(guarded.$('backup-status').textContent.length>0);
guarded.faults.write=false;guarded.click('import-backup');
assert.deepEqual(guarded.reloads,[['Guarded']]);
guarded.controller.syncBackupButtons();assert.equal(guarded.$('undo-backup').hidden,false);
guarded.state.playing=true;guarded.click('undo-backup');assert.equal(guarded.reloads.length,1);
guarded.state.playing=false;guarded.state.transitioning=true;guarded.click('undo-backup');assert.equal(guarded.reloads.length,1);
guarded.state.transitioning=false;guarded.click('undo-backup');
assert.deepEqual(guarded.reloads,[['Guarded'],[]],'Undo restores data before reload');

const invalid=fixture();await invalid.select(readyFile('Previous'));
let reads=0;await invalid.select({size:1048577,text(){reads++;throw Error('Must not read');}});
assert.equal(reads,0);assert.equal(invalid.$('backup-preview').hidden,true);
assert.equal(invalid.$('import-backup').disabled,true);
assert.equal(invalid.$('backup-status').textContent,'El archivo supera el límite de 1 MB.');
await invalid.select({size:10,text:async()=>'{bad'});
assert.ok(invalid.$('backup-status').textContent.startsWith('No se pudo abrir la copia: '));
invalid.click('import-backup');assert.equal(invalid.memory.size,0);assert.deepEqual(invalid.reloads,[]);
await invalid.select();assert.equal(invalid.$('backup-preview').hidden,true);

console.log('PASS: real backup controller/storage, stale reads and errors, cancellation, paused restore/undo guards, failed writes and reload ordering');
