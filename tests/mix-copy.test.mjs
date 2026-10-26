import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('      function createMixCopy('),end=html.indexOf('      function commitMixes(',start);
assert.ok(start>=0&&end>start);
const copy=new Function(html.slice(start,end)+'return createMixCopy;')();
const source=Object.freeze({name:'Lectura',favorite:true,scene:'ocean',evolution:35,brightness:50,melody:false,stereoWidth:65,balance:-20,notePace:'sparse',fadeOutSeconds:60,fadeInSeconds:30,preserveMix:true,restSound:'silent',cyclePlan:'single',duration:37,levels:Object.freeze({master:40,noise:75,drone:20,notes:0})});
const mixes=Object.freeze([source]),before=JSON.stringify(mixes),first=copy(mixes,0);
assert.equal(first.name,'Lectura (copia)');assert.equal(first.favorite,false);
const {name:oldName,favorite:oldFavorite,...oldSettings}=source,{name:newName,favorite:newFavorite,...newSettings}=first;
assert.deepEqual(newSettings,oldSettings);
assert.notEqual(first.levels,source.levels);
first.levels.noise=12;assert.equal(source.levels.noise,75);
assert.equal(JSON.stringify(mixes),before,'Original settings and favorite stay unchanged');
const second=copy([source,{...first,levels:{...source.levels}}],0);assert.equal(second.name,'Lectura (copia 2)');
const third=copy([source,first,second],0);assert.equal(third.name,'Lectura (copia 3)');
const accent=copy([{...source,name:'Cafe\u0301'},{...source,name:'CAFÉ (copia)'}],0);
assert.equal(accent.name.normalize('NFC'),'Café (copia 2)');
for(const name of ['x'.repeat(60),'x'.repeat(51)+'🌧️'+'z'.repeat(6)]){
 const value=copy([{...source,name}],0).name;assert.ok(value.length<=60);
 assert.ok(Array.from(value).every(char=>char.length!==1||char.charCodeAt(0)<0xd800||char.charCodeAt(0)>0xdfff),'Truncation does not split surrogate pairs');
}
const other=copy([source,{...source,name:'Trabajo',scene:'space'}],1);
assert.equal(other.name,'Trabajo (copia)');assert.equal(other.scene,'space');
const almost=Array.from({length:49},(_,index)=>({...source,name:'Mezcla '+index}));
assert.ok(copy(almost,0).name.endsWith('(copia)'));
assert.throws(()=>copy([...almost,source],0),/50 mezclas/);
for(const [library,index] of [[[],0],[[source],-1],[[source],1],[[source],.5],[[source],'0'],[[null],0],[[{name:'Error',levels:null}],0],[null,0]])assert.throws(()=>copy(library,index));
console.log('PASS: independent copy settings, preserved original, unique bounded Unicode names, favorite defaults and library limit');
