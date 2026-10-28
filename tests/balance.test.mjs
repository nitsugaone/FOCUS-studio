import {balanceCoefficients,balanceLabel,createChannelBalance} from '../src/audio/dsp.js';
import assert from 'node:assert/strict';

const tools={balanceCoefficients,balanceLabel,createChannelBalance};

assert.deepEqual(tools.balanceCoefficients(-100),{left:1,right:0});
assert.deepEqual(tools.balanceCoefficients(0),{left:1,right:1});
assert.deepEqual(tools.balanceCoefficients(100),{left:0,right:1});
for(let balance=-100;balance<=100;balance++){
 const {left,right}=tools.balanceCoefficients(balance);
 assert.ok(left>=0&&left<=1&&right>=0&&right<=1);
 for(const [a,b] of [[1,-1],[-.3,.8],[0,1],[.7,.7]]) {
  assert.ok(Math.abs(left*a)<=Math.abs(a)+1e-12);
  assert.ok(Math.abs(right*b)<=Math.abs(b)+1e-12);
 }
}
for(const value of [-101,101,NaN,Infinity,'50',null,0.5])assert.throws(()=>tools.balanceCoefficients(value));
assert.equal(tools.balanceLabel(0),'Centro');
assert.equal(tools.balanceLabel(-35),'35% izquierda');
assert.equal(tools.balanceLabel(60),'60% derecha');
const nodes=[],calls=[];
function node(){const n={connections:[],gain:{value:0,cancelScheduledValues(){},setTargetAtTime(value,time,smooth){this.value=value;calls.push({value,time,smooth});}},connect(...args){this.connections.push(args);}};nodes.push(n);return n;}
const input=node(),output=node(),context={currentTime:2,createGain:node,createChannelSplitter:node,createChannelMerger:node};
const field=tools.createChannelBalance(context,input,output,0),count=nodes.length;
field.setBalance(-100);assert.equal(nodes.length,count);
assert.equal(calls.length,2);assert.equal(calls[0].value,1);assert.equal(calls[1].value,0);
assert.ok(calls.every(call=>call.smooth===.08));
field.setBalance(-100);assert.equal(calls.length,2,'No repeated ramps for an unchanged balance');
field.setBalance(0);assert.equal(calls.length,4);
assert.throws(()=>field.setBalance(101));
console.log('PASS: balance bounds, channel identity, attenuation, smooth changes, centered reset and graph reuse');
