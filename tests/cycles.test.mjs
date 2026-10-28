import {readApplicationSource,extractFunctions} from './support/application-source.mjs';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const html=await readApplicationSource();
assert.ok(!html.includes('Object.hasOwn('),'Startup must support browsers without Object.hasOwn');
const tools=new Function(extractFunctions(html,["createCycleTools"])+'return createCycleTools();')();
let state=tools.initial('25-5',45);
assert.equal(tools.duration(state),25);
assert.deepEqual(tools.next(state),state,'An unfinished phase never advances');
const original=JSON.stringify(state);
state=tools.next({...state,completed:true});
assert.equal(state.phase,'rest');assert.equal(state.round,1);assert.equal(tools.duration(state),5);
state=tools.next({...state,completed:true});
assert.equal(state.phase,'focus');assert.equal(state.round,2);
state=tools.next({plan:'25-5',round:4,phase:'focus',completed:true,singleDuration:45});
assert.deepEqual(state,tools.initial('25-5',45),'Last focus repeats only through explicit next action');
let fifty=tools.initial('50-10');
assert.equal(tools.duration(fifty),50);
fifty=tools.next({...fifty,completed:true});assert.equal(tools.duration(fifty),10);
fifty=tools.next({...fifty,completed:true});assert.equal(fifty.round,2);
assert.equal(tools.normalize({plan:'25-5',round:4,phase:'rest',completed:false,singleDuration:0}),null);
assert.equal(tools.normalize({plan:'25-5',round:0,phase:'focus',completed:false,singleDuration:0}),null);
assert.equal(tools.normalize({plan:'unknown',round:1,phase:'focus',completed:false,singleDuration:0}),null);
assert.throws(()=>tools.initial('__proto__'));
assert.equal(tools.duration(tools.initial('single',45)),45);
assert.equal(JSON.stringify(tools.initial('25-5',45)),original);
console.log('PASS: cycle transitions, final round, manual progression and invalid state checks');

for(const minutes of [0,1,17,50,180]) {
 assert.equal(tools.validDuration(minutes),true);
 assert.equal(tools.duration(tools.initial('single',minutes)),minutes);
 assert.equal(tools.normalize(tools.initial('25-5',minutes)).singleDuration,minutes);
}
for(const minutes of [-1,181,1.5,NaN,Infinity,'17',null]) {
 assert.equal(tools.validDuration(minutes),false);
 assert.throws(()=>tools.initial('single',minutes));
}
console.log('PASS: custom duration bounds, integer validation and cycle preservation');
