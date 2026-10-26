import {readApplicationSource,extractFunctions} from './support/application-source.mjs';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const html=await readApplicationSource();
const search=new Function(extractFunctions(html,["mixSearchIndices"])+'return mixSearchIndices;')();
const mixes=Object.freeze([
 Object.freeze({name:'Lluvia suave',favorite:false}),
 Object.freeze({name:'Café de lectura',favorite:true}),
 Object.freeze({name:'Trabajo de tarde',favorite:true}),
 Object.freeze({name:'Niño: concentración',favorite:false}),
 Object.freeze({name:'Cafe\u0301 nocturno',favorite:false})
]);
const before=JSON.stringify(mixes);
assert.deepEqual(search(mixes,''),[0,1,2,3,4]);
assert.deepEqual(search(mixes,'  '),[0,1,2,3,4]);
assert.deepEqual(search(mixes,'CAFE'),[1,4]);
assert.deepEqual(search(mixes,'lectura café'),[1]);
assert.deepEqual(search(mixes,'  TARDE   trabajo  '),[2]);
assert.deepEqual(search(mixes,'nino concentracion'),[3]);
assert.deepEqual(search(mixes,'café nocturno'),[4]);
assert.deepEqual(search(mixes,'zzzz'),[]);
assert.deepEqual(search(mixes,'[.*]'),[],'Search treats punctuation as text');
assert.deepEqual(search([null,{name:3},{name:'Lectura'}],'lec'),[2],'Matching preserves original indices');
assert.deepEqual(search(null,'lectura'),[]);
assert.deepEqual(search(mixes,null),[]);
assert.equal(JSON.stringify(mixes),before,'Searching never changes stored names or favorites');
console.log('PASS: mix search accents, case, word order, original indices, empty results, literal punctuation and immutability');
