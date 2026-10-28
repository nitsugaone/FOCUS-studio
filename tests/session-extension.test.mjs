import {sessionExtension as extension} from '../src/session/cycles.js';
import {readApplicationSource,extractFunctions} from './support/application-source.mjs';
import assert from 'node:assert/strict';

const html=await readApplicationSource();

for(const duration of [1,17,60,175])assert.deepEqual(extension('single',duration,0),{duration:duration+5,added:5});
for(const duration of [176,177,178,179])assert.deepEqual(extension('single',duration,59000),{duration:180,added:180-duration});
for(const args of [['single',0,0],['single',180,0],['single',181,0],['single',1,60000],['single',1,60001],['single',1,-1],['single',1,NaN],['single',1.5,0],['single','17',0],['25-5',25,0],['50-10',50,0]])assert.equal(extension(...args),null);
function run(options={}) {
 return new Function('options','sessionExtension',`
  let cycleState={plan:options.plan??'single',round:1,phase:'focus',completed:false,singleDuration:options.duration??17};
  const clock={durationMinutes:options.duration??17,elapsedMs:options.elapsed??60000};
  let sessionRecordedMs=55000,playing=options.playing??true,transitioning=options.transitioning??false;
  const studio={fadeOutSeconds:20},ctx={currentTime:100},nodes={closingGain:{gain:{}}},modeLabelEl={},elements=new Map(),saved=[],closing=[];
  let clockReads=0,renders=0;
  const $=id=>{if(!elements.has(id))elements.set(id,{attributes:{},setAttribute(key,value){this.attributes[key]=value;}});return elements.get(id);};
  function advanceSessionClock(){clockReads++;if(options.advanceTo!==undefined)clock.elapsedMs=options.advanceTo;}
  function scheduleSessionClosing(...args){closing.push(args.slice(2));}
  function scheduleSessionEntry(){throw Error('Extension must not restart the entrance');}
  function scheduleAudioClosing(smooth){scheduleSessionClosing(ctx,nodes.closingGain.gain,clock.elapsedMs,clock.durationMinutes,studio.fadeOutSeconds,isSilentRest(),smooth);}
  function isSilentRest(){return false;} function applyScene(){} function renderTimer(){renders++;} function syncUI(){}
  function saveSession(force){saved.push({force,duration:clock.durationMinutes,elapsed:clock.elapsedMs,cycle:{...cycleState}});return true;}
  ${extractFunctions(html,['syncExtensionUI','extendSession'])}
  extendSession();
  return {duration:clock.durationMinutes,elapsed:clock.elapsedMs,recorded:sessionRecordedMs,cycle:cycleState,playing,saved,closing,clockReads,renders,status:$('extension-status').textContent};
 `)(options,extension);
}
const active=run();
assert.equal(active.duration,22);assert.equal(active.elapsed,60000);assert.equal(active.recorded,55000);assert.equal(active.playing,true);assert.equal(active.cycle.singleDuration,22);
assert.deepEqual(active.closing,[[60000,22,20,false,true]]);
assert.equal(active.saved[0].force,true);assert.equal(active.saved[0].elapsed,60000);
assert.ok(active.status.includes('5 minutos')&&active.status.includes('22 minutos'));
const paused=run({playing:false});assert.equal(paused.duration,22);assert.equal(paused.playing,false);assert.deepEqual(paused.closing,[]);
const busy=run({transitioning:true});assert.equal(busy.duration,17);assert.equal(busy.clockReads,0);assert.equal(busy.saved.length,0);
const ended=run({duration:1,elapsed:59000,advanceTo:60000});assert.equal(ended.duration,1);assert.equal(ended.saved.length,0);assert.deepEqual(ended.closing,[]);
for(const options of [{plan:'25-5',duration:25},{duration:0},{duration:180}])assert.equal(run(options).saved.length,0);
assert.equal(run({duration:179,elapsed:0}).duration,180);
console.log('PASS: extend active and paused sessions, preserve progress and history, cap duration, reject cycles and expired or busy sessions');
