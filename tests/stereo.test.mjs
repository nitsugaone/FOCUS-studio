import {stereoCoefficients,createStereoField} from '../src/audio/dsp.js';
import assert from 'node:assert/strict';
import {FocusAudioEngine} from '../src/audio/FocusAudioEngine.js';
import {SCENES} from '../src/audio/scenes.js';

const tools={stereoCoefficients,createStereoField};

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

const oscillators=[],mergers=[];
function parameter() {
 return {value:0,target:null,cancelScheduledValues(){},
  setTargetAtTime(value){assert.ok(Number.isFinite(value));this.target=value;},
  setValueAtTime(value){this.value=value;this.target=null;},
  linearRampToValueAtTime(){},
 };
}
function audioNode(kind) {
 return {kind,connections:[],started:0,start(){this.started++;},
  connect(output,sourceChannel=0,inputChannel=0){this.connections.push({output,sourceChannel,inputChannel});},
  gain:parameter(),frequency:parameter(),detune:parameter(),pan:parameter(),Q:parameter(),
  threshold:parameter(),knee:parameter(),ratio:parameter(),attack:parameter(),release:parameter(),
 };
}
const destination=audioNode('destination'),streamDestination={...audioNode('stream'),stream:{}};
const contextMock={
 currentTime:0,sampleRate:8000,state:'running',destination,
 createGain:()=>audioNode('gain'),
 createChannelSplitter:()=>audioNode('splitter'),
 createChannelMerger(){const n=audioNode('merger');mergers.push(n);return n;},
 createOscillator(){const n=audioNode('oscillator');oscillators.push(n);return n;},
 createBiquadFilter:()=>audioNode('filter'),
 createDynamicsCompressor:()=>audioNode('compressor'),
 createStereoPanner:()=>audioNode('panner'),
 createMediaStreamDestination:()=>streamDestination,
 createConvolver:()=>audioNode('convolver'),
 createBuffer(channels,length){const data=Array.from({length:channels},()=>new Float32Array(length));return {getChannelData:index=>data[index]};},
 audioWorklet:{async addModule(){}},
};
const audio=new FocusAudioEngine({
 platform:{AudioContext:function(){return contextMock;},AudioWorkletNode:function(){return {...audioNode('worklet'),addEventListener(){}};},setTimeout(){return 1;}},
 clearTimeout(){},
});
const settings={scene:'rain',stereoWidth:100,balance:0,evolution:35,brightness:50,melody:false,fadeInSeconds:12,fadeOutSeconds:20};
const levels={master:75,noise:100,drone:40,notes:30};
const session={durationMinutes:25};
function configure(overrides={},sessionOverrides={}) {
 audio.configure({...settings,...overrides},levels,{...session,...sessionOverrides});
}
configure();
await audio.resume();
const tones=oscillators.filter(n=>[180,186].includes(n.frequency.value));
assert.deepEqual(tones.map(n=>[n.type,n.frequency.value,n.started]),[['sine',180,1],['sine',186,1]]);
const binauralMerger=tones[0].connections[0].output;
assert.deepEqual(tones.map(n=>n.connections),[
 [{output:binauralMerger,sourceChannel:0,inputChannel:0}],[{output:binauralMerger,sourceChannel:0,inputChannel:1}],
]);
assert.equal(binauralMerger.kind,'merger');
const nextNode=from=>from.connections[0].output;
const pairGain=nextNode(binauralMerger),master=nextNode(pairGain);
assert.equal(pairGain.kind,'gain');
const sceneMerger=mergers.find(n=>n!==binauralMerger&&nextNode(n)===master);
assert.ok(sceneMerger,'The scene stereo field joins the pair at master');
const entry=nextNode(master),closing=nextNode(entry),fade=nextNode(closing);
const balanceSplitter=nextNode(nextNode(fade));
assert.equal(balanceSplitter.kind,'splitter');
const compressor=nextNode(nextNode(balanceSplitter.connections[0].output));
assert.equal(compressor.kind,'compressor');
assert.deepEqual(compressor.connections.map(connection=>connection.output),[destination,streamDestination]);

const oscillatorCount=oscillators.length;
for(const [scene,preset] of Object.entries(SCENES)) {
 configure({scene});audio.applyScene();
 assert.ok(preset.binaural>0&&preset.binaural<=0.05,scene+' remains a quiet layer');
 assert.ok(Math.abs(pairGain.gain.target-preset.binaural*0.42)<1e-12,scene+' uses its gain at full texture and width');
}
assert.ok(Object.entries(SCENES).every(([scene,preset])=>scene==='fire'||SCENES.fire.binaural<preset.binaural));
configure({stereoWidth:50});audio.applyScene();
const halfWidthGain=SCENES.rain.binaural*0.42/2;
assert.ok(Math.abs(pairGain.gain.target-halfWidthGain)<1e-12);
audio.updateLevel('noise',50);
assert.ok(Math.abs(pairGain.gain.target-halfWidthGain/4)<1e-12,'Texture level follows the existing squared gain curve');
audio.updateLevel('noise',0);
assert.equal(pairGain.gain.target,0);
configure({stereoWidth:0});audio.applyScene();
assert.equal(pairGain.gain.target,0);
configure();audio.applyScene();audio.start();
assert.ok(entry.gain.value>0&&closing.gain.value>0);
assert.equal(fade.gain.target,1);
configure({}, {silent:true});audio.start();
assert.equal(entry.gain.value,0);
assert.equal(closing.gain.value,0);
configure();audio.start();
assert.ok(entry.gain.value>0&&closing.gain.value>0);
audio.pause();
assert.equal(fade.gain.target,0);
assert.equal(oscillators.length,oscillatorCount,'Scene, width, session and volume reuse oscillators');
assert.deepEqual(tones.map(n=>n.started),[1,1],'Both tones start once');
console.log('PASS: six binaural scenes, isolated channels, shared envelopes and live gain changes');
