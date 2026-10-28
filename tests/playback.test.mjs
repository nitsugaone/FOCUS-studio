import assert from 'node:assert/strict';
import {createPlaybackController} from '../src/ui/PlaybackController.js';
import {ListeningProgress} from '../src/session/ListeningProgress.js';
import {createCycleTools} from '../src/session/cycles.js';

function fixture(options={}) {
 const calls=[],errors=[],elements=new Map(),state={playing:options.playing??false,transitioning:options.transitioning??false};
 const clock={durationMinutes:options.duration??17,elapsedMs:options.elapsed??61000};
 const listeningProgress=new ListeningProgress();listeningProgress.checkpoint(clock.elapsedMs);
 const cycleTools=createCycleTools();
 let cycle=options.cycle??cycleTools.initial('single',clock.durationMinutes),initialized=options.initialized??false;
 const stream={},previousStream={};
 const $=id=>{
  if(options.noBackground&&id==='bg-audio')return null;
  if(!elements.has(id))elements.set(id,{textContent:'previous',hidden:false,srcObject:previousStream,
   play(){calls.push('background');return options.rejectBackground?Promise.reject(Error('Auxiliary blocked')):Promise.resolve();},
   pause(){calls.push('background-pause');}
  });
  return elements.get(id);
 };
 const navigator=options.noMedia?{}:{mediaSession:{playbackState:'paused'}};
 const engine={
  initialized(){calls.push('initialized');return initialized;},
  async resume(){calls.push('resume');if(options.resumeGate)await options.resumeGate;if('resumeError' in options)throw options.resumeError;initialized=true;},
  stream(){calls.push('stream');return stream;},
  start(){calls.push('start');if(options.startError)throw options.startError;},
  pause(slow){calls.push('pause:'+slow);}
 };
 const controller=createPlaybackController({
  clock,cycleTools,listeningProgress,getPlaybackState:()=>state,
  setPlaying:value=>{state.playing=value;calls.push('playing:'+value);},
  setTransitioning:value=>{state.transitioning=value;calls.push('transition:'+value);},
  getCycleState:()=>cycle,setCycleState:value=>{cycle=value;},getStudio:()=>({scene:'rain'}),setFeedbackSession(){},$,engine,navigator,
  configureAudio(){calls.push('configure');},applyScene(smooth){calls.push('scene:'+smooth);},renderTimer(){calls.push('render');},
  saveSession(force){calls.push('save:'+force);},setupMediaSession(){calls.push('media-setup');},
  startSessionClock(){calls.push('clock-start');},stopSessionClock(){calls.push('clock-stop');},
  requestWakeLock(){calls.push('wake');},releaseWakeLock(){calls.push('release');},
  hideError(){calls.push('hide-error');},showError(message){errors.push(message);calls.push('error');},syncUI(){calls.push('ui');}
 });
 return {controller,state,clock,listeningProgress,calls,errors,$,navigator,stream,previousStream,getCycle:()=>cycle};
}

const fresh=fixture();
await fresh.controller.play();
assert.deepEqual(fresh.state,{playing:true,transitioning:false});
assert.deepEqual(fresh.calls,['transition:true','hide-error','ui','initialized','configure','resume','stream','media-setup','playing:true','scene:0.05','start','clock-start','background','wake','transition:false','ui']);
assert.equal(fresh.$('bg-audio').srcObject,fresh.stream);
assert.equal(fresh.navigator.mediaSession.playbackState,'playing');
for(const id of ['resume-status','feedback-status'])assert.equal(fresh.$(id).textContent,'');
assert.equal(fresh.$('session-feedback').hidden,true);
assert.equal(fresh.clock.elapsedMs,61000);
assert.equal(fresh.listeningProgress.recordedMs,61000);
const afterStart=[...fresh.calls];await fresh.controller.play();
assert.deepEqual(fresh.calls,afterStart,'Playing twice must not start another graph or clock');

const resumed=fixture({initialized:true});await resumed.controller.play();
assert.ok(!resumed.calls.includes('stream')&&!resumed.calls.includes('media-setup'));
assert.equal(resumed.$('bg-audio').srcObject,resumed.previousStream);
assert.equal(resumed.clock.elapsedMs,61000);
assert.equal(resumed.listeningProgress.recordedMs,61000);
for(const options of [{playing:true},{transitioning:true}]){
 const blocked=fixture(options);await blocked.controller.play();assert.deepEqual(blocked.calls,[]);
}

let releaseResume;
const pending=fixture({resumeGate:new Promise(resolve=>{releaseResume=resolve;})});
const first=pending.controller.play();
assert.deepEqual(pending.state,{playing:false,transitioning:true});
const whilePending=[...pending.calls];
await pending.controller.play();pending.controller.pause();
assert.deepEqual(pending.calls,whilePending,'Pending resume excludes repeated play and pause effects');
releaseResume();await first;
assert.deepEqual(pending.state,{playing:true,transitioning:false});
assert.equal(pending.calls.filter(value=>value==='resume').length,1);

const cycleTools=createCycleTools();
const next=fixture({cycle:{...cycleTools.initial('25-5',17),completed:true},duration:25,elapsed:1500000});
await next.controller.play();
assert.equal(next.getCycle().phase,'rest');assert.equal(next.getCycle().completed,false);
assert.equal(next.clock.durationMinutes,5);assert.equal(next.clock.elapsedMs,0);
assert.equal(next.listeningProgress.recordedMs,0);
assert.deepEqual(next.calls.slice(0,3),['render','save:true','transition:true']);
const expired=fixture({duration:1,elapsed:61000});await expired.controller.play();
assert.equal(expired.clock.elapsedMs,0);assert.equal(expired.listeningProgress.recordedMs,0);
assert.equal(expired.$('extension-status').textContent,'');
const free=fixture({duration:0,elapsed:400000});await free.controller.play();
assert.equal(free.clock.elapsedMs,400000);assert.equal(free.listeningProgress.recordedMs,400000);

for(const options of [{resumeError:Error('Resume blocked')},{resumeError:null},{startError:Error('Start blocked')}]){
 const failed=fixture(options);await failed.controller.play();
 assert.deepEqual(failed.state,{playing:false,transitioning:false});
 assert.ok(failed.calls.includes('clock-stop'));
 assert.ok(!failed.calls.includes('wake')&&!failed.calls.includes('background'));
 assert.equal(failed.errors[0],options.resumeError?.message??options.startError?.message??'No se pudo iniciar el audio.');
 assert.deepEqual(failed.calls.slice(-5),['playing:false','clock-stop','error','transition:false','ui']);
}
const optional=fixture({noMedia:true,noBackground:true});await optional.controller.play();
assert.deepEqual(optional.state,{playing:true,transitioning:false});
assert.ok(optional.calls.includes('wake')&&!optional.calls.includes('background'));
const auxiliary=fixture({rejectBackground:true});await auxiliary.controller.play();
assert.deepEqual(auxiliary.state,{playing:true,transitioning:false});assert.deepEqual(auxiliary.errors,[]);

console.log('PASS: playback lifecycle, resume serialization, cycle advancement, progress, optional media and startup failure cleanup');
