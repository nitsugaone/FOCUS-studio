import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('      function syncMixUndoUI()'),end=html.indexOf('      // Only crossing the breakpoint',start);
assert.ok(start>=0&&end>start);
function library(input) {
 return new Function('input',`
  let savedMixes=input,mixDeletionUndo=null,selection='',fail=false,writes=0,disk=JSON.stringify(input);
  const elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:false,disabled:false});return elements.get(id);};
  function selectedMixIndex(){return selection!==''&&savedMixes[Number(selection)]?Number(selection):-1;}
  function writeLocal(key,value){if(fail)return false;writes++;disk=JSON.stringify(value);return true;}
  function renderMixes(selected=''){selection=String(selected);syncMixUndoUI();}
  ${html.slice(start,end)}
  syncMixUndoUI();
  return {
   select(index){selection=index<0?'':String(index);},
   remove:deleteSelectedMix,undo:undoMixDeletion,commit:commitMixes,
   fail(value){fail=value;},query(value){$('mix-search').value=value;},
   state(){return {mixes:savedMixes,pending:mixDeletionUndo,selection,writes,disk,query:$('mix-search').value,button:$('undo-delete-mix'),name:$('preset-name').value};}
  };
 `)(input);
}
const records=Object.freeze(['Lluvia','Lectura','Trabajo'].map((name,index)=>Object.freeze({name,favorite:index===1,scene:'rain',duration:25,levels:Object.freeze({master:75,noise:70+index,drone:20,notes:10})})));
const app=library(records);
assert.equal(app.state().button.hidden,true);
app.select(1);app.remove();
assert.deepEqual(app.state().mixes.map(mix=>mix.name),['Lluvia','Trabajo']);
assert.equal(app.state().pending.index,1);assert.notEqual(app.state().pending.mix.levels,records[1].levels);
assert.equal(app.state().button.hidden,false);app.query('sin resultados');app.undo();
assert.deepEqual(app.state().mixes,records);assert.equal(app.state().selection,'1');assert.equal(app.state().name,'Lectura');
assert.equal(app.state().query,'');assert.equal(app.state().pending,null);assert.equal(app.state().button.hidden,true);
assert.deepEqual(JSON.parse(app.state().disk),records);
const writes=app.state().writes;app.undo();assert.equal(app.state().writes,writes,'Undo cannot restore twice');
app.select(0);app.remove();app.select(1);app.remove();app.undo();
assert.deepEqual(app.state().mixes.map(mix=>mix.name),['Lectura','Trabajo'],'Only the latest deletion is restored');
app.select(0);app.remove();const pending=app.state().pending,before=app.state().disk;
app.fail(true);app.undo();
assert.equal(app.state().pending,pending);assert.equal(app.state().disk,before,'Failed recovery keeps both data and undo record');
assert.equal(app.state().button.hidden,false);
assert.equal(app.commit([{...records[0],name:'Cambio'}]),false);assert.equal(app.state().pending,pending,'Failed edits preserve undo');
app.fail(false);app.undo();assert.equal(app.state().pending,null);
app.select(0);app.remove();app.commit([...app.state().mixes,{...records[0],name:'Nueva'}]);
assert.equal(app.state().pending,null);const after=app.state().disk;app.undo();assert.equal(app.state().disk,after,'Successful library edits clear old undo');
const full=library(Array.from({length:50},(_,index)=>({...records[0],name:String(index)})));
full.select(49);full.remove();full.undo();assert.equal(full.state().mixes.length,50);assert.equal(full.state().mixes[49].name,'49');
console.log('PASS: delete and undo data integrity, original position and favorite, latest deletion, repeated undo, mutation invalidation and failed storage recovery');
