import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('      function stereoCoefficients('),end=html.indexOf('      async function initAudio()',start);
const tools=new Function(html.slice(start,end)+'return {stereoCoefficients,createStereoField};')();
assert.deepEqual(tools.stereoCoefficients(100),{direct:1,cross:0});
assert.deepEqual(tools.stereoCoefficients(0),{direct:.5,cross:.5});
assert.deepEqual(tools.stereoCoefficients(50),{direct:.75,cross:.25});
for(const value of [-1,101,NaN,Infinity,'50',null])assert.throws(()=>tools.stereoCoefficients(value));
for(let width=0;width<=100;width++){
 const {direct,cross}=tools.stereoCoefficients(width);
 assert.equal(direct+cross,1);
 for(const [left,right] of [[1,-1],[-.3,.8],[0,1],[.7,.7]]){
  assert.ok(Math.abs(direct*left+cross*right)<=Math.max(Math.abs(left),Math.abs(right))+1e-12);
 }
}
const nodes=[],calls=[];
function node(){const n={connections:[],gain:{value:0,cancelScheduledValues(){},setTargetAtTime(value,time,smooth){this.value=value;calls.push({value,time,smooth});}},connect(...args){this.connections.push(args);}};nodes.push(n);return n;}
const input=node(),output=node(),context={currentTime:2,createGain:node,createChannelSplitter:node,createChannelMerger:node};
const field=tools.createStereoField(context,input,output,100),count=nodes.length;
field.setWidth(0);
assert.equal(nodes.length,count,'Width updates reuse the graph');
assert.equal(calls.length,4);assert.ok(calls.every(call=>call.value===.5&&call.smooth===.08));
field.setWidth(0);assert.equal(calls.length,4,'Unchanged values do not reschedule ramps');
assert.throws(()=>field.setWidth(101));
console.log('PASS: width coefficients, peak bounds, smooth updates and graph reuse');
