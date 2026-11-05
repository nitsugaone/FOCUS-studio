import assert from 'node:assert/strict';
import {createSessionTimerController} from '../src/ui/SessionTimerController.js';
import {createPlaybackController} from '../src/ui/PlaybackController.js';
import {SessionClock} from '../src/session/SessionClock.js';
import {ListeningProgress} from '../src/session/ListeningProgress.js';
import {SessionPersistence} from '../src/session/SessionPersistence.js';
import {createCycleTools,isSilentRestState} from '../src/session/cycles.js';
import {StorageService} from '../src/storage/StorageService.js';

function fixture(options={}) {
 let now=10000,playing=options.playing??false,transitioning=false,tick,scheduled=0,writes=0;
 const cycleTools=createCycleTools(),listeningProgress=new ListeningProgress();
 let cycle=options.cycle??cycleTools.initial('single',17);
 const calls=[],audio=[],envelopes=[],saves=[],memory=new Map(),elements=new Map();
 if(options.saved)memory.set('focus-session-v1',JSON.stringify(options.saved));
 const storage=new StorageService({
  getItem:key=>memory.get(key)??null,
  setItem(key,value){if(options.failWrite)throw Error('Quota');writes++;memory.set(key,value);},
  removeItem:key=>memory.delete(key)
 });
 const clock=new SessionClock({
  now:()=>now,setInterval:fn=>{tick=fn;return ++scheduled;},clearInterval(){}
 });
 clock.durationMinutes=cycleTools.duration(cycle);
 clock.elapsedMs=options.elapsed??0;
 listeningProgress.checkpoint(options.recorded??clock.elapsedMs);
 const persistence=new SessionPersistence({storage,cycleTools,currentTime:()=>now});
 let listened=0,controller;
 function element(id) {
  if(!elements.has(id)) {
   let value='';
   elements.set(id,{
    get value(){return value;},set value(next){value=String(next);},
    textContent:'',hidden:true,dataset:{},attributes:{},events:new Map(),
    setAttribute(key,next){this.attributes[key]=String(next);},
    addEventListener(type,handler){this.events.set(type,handler);},
    pause(){calls.push('background-pause');}
   });
  }
  return elements.get(id);
 }
 const chips=[0,5,17,25,45].map(minutes=>{const chip=element('chip-'+minutes);chip.dataset.minutes=String(minutes);return chip;});
 const document={querySelectorAll(selector){assert.equal(selector,'.mode-chip');return chips;}};
 const window={location:{search:options.search??''}};
 const silent=()=>isSilentRestState(cycle,options.restSound??'sound');
 function history(flush=false) {
  listened+=listeningProgress.advance(clock.elapsedMs,{silent:silent(),flush});
  calls.push('history');
 }
 function saveSession(force=false) {
  const result=persistence.save({duration:clock.durationMinutes,elapsed:clock.elapsedMs,cycle},force);
  saves.push({force,result});return result;
 }
 const playback=createPlaybackController({
  clock,cycleTools,listeningProgress,getPlaybackState:()=>({playing,transitioning}),
  setPlaying:value=>{playing=value;},setTransitioning:value=>{transitioning=value;},
  getCycleState:()=>cycle,setCycleState:value=>{cycle=value;},
  getStudio:()=>({scene:'rain'}),setFeedbackSession(){},$:element,navigator:{},
  engine:{pause(slow){audio.push({slow,completed:cycle.completed,elapsed:clock.elapsedMs});}},
  stopSessionClock:()=>controller.stopSessionClock(),saveSession,
  releaseWakeLock:()=>calls.push('wake-release'),syncUI:()=>calls.push('ui')
 });
 controller=createSessionTimerController({
  window,document,$:element,clock,cycleTools,isPlaying:()=>playing,
  getCycleState:()=>cycle,setCycleState:value=>{cycle=value;},pause:playback.pause,
  syncExtensionUI:()=>calls.push('extension'),applyScene:()=>calls.push('scene'),
  syncFocusHistoryProgress:history,saveSession,listeningProgress,modeLabelEl:element('mode'),
  syncCycleUI:()=>calls.push('cycle'),syncUI:()=>calls.push('ui'),
  scheduleAudioClosing:smooth=>envelopes.push({kind:'closing',smooth,elapsed:clock.elapsedMs,timestamp:clock.lastTimestamp}),
  scheduleAudioEntry:smooth=>envelopes.push({kind:'entry',smooth,elapsed:clock.elapsedMs,timestamp:clock.lastTimestamp})
 });
 return {
  controller,clock,cycleTools,listeningProgress,persistence,element,calls,audio,envelopes,saves,window,
  advance:milliseconds=>{now+=milliseconds;},tick:()=>tick(),history,
  setPlaying:value=>{playing=value;},setCycle:value=>{cycle=value;},
  get cycle(){return cycle;},get playing(){return playing;},get listened(){return listened;},
  get scheduled(){return scheduled;},get writes(){return writes;},
  stored:()=>storage.read('focus-session-v1',null)
 };
}

// A running reset keeps the active timer, accounts for pending listening once,
// and uses the injected clock even when its timestamps differ from Date.now().
const active=fixture({playing:true,elapsed:60000,recorded:55000});
assert.deepEqual(active.calls,[]);assert.equal(active.scheduled,0);assert.equal(active.writes,0);
active.controller.startSessionClock();
const interval=active.clock.timer;
active.advance(2000);
assert.equal(active.controller.resetCycle('single',25),true);
assert.equal(active.listened,7);assert.equal(active.listeningProgress.recordedMs,0);
assert.equal(active.clock.elapsedMs,0);assert.equal(active.clock.durationMinutes,25);
assert.equal(active.clock.lastTimestamp,12000);assert.equal(active.clock.timer,interval);assert.equal(active.scheduled,1);
assert.deepEqual(active.envelopes,[
 {kind:'closing',smooth:true,elapsed:0,timestamp:12000},
 {kind:'entry',smooth:true,elapsed:0,timestamp:12000}
]);
assert.deepEqual(active.stored(),{duration:25,elapsed:0,cycle:active.cycleTools.initial('single',25)});
active.advance(1000);active.tick();
assert.equal(active.clock.elapsedMs,1000,'Reset is followed by one second, regardless of the system wall clock');
assert.equal(active.listened,7,'Previously registered listening is not added again');
assert.equal(active.element('timer').textContent,'00:24:59');
assert.equal(active.element('mobile-timer').textContent,active.element('timer').textContent);

// The current cycle is read at action time; a failed save keeps the in-memory
// reset and returns the failure rather than claiming persistence succeeded.
const paused=fixture({failWrite:true});
paused.setCycle(paused.cycleTools.initial('50-10',45));
assert.equal(paused.controller.resetCycle('single'),false);
assert.equal(paused.clock.durationMinutes,45);assert.equal(paused.cycle.singleDuration,45);
assert.equal(paused.clock.lastTimestamp,0);assert.equal(paused.scheduled,0);
assert.deepEqual(paused.envelopes,[]);assert.equal(paused.stored(),null);
assert.equal(paused.playing,false);

// Resetting a paused break preserves its phase/round and only clears completion.
const breakState={plan:'25-5',phase:'rest',round:2,completed:true,singleDuration:17};
const resetBreak=fixture({cycle:breakState,elapsed:120000,recorded:118000});
resetBreak.controller.initResetControl();
resetBreak.element('reset-timer').events.get('click')();
assert.deepEqual(resetBreak.cycle,{...breakState,completed:false});
assert.equal(resetBreak.clock.durationMinutes,5);assert.equal(resetBreak.clock.elapsedMs,0);
assert.equal(resetBreak.listened,2);assert.equal(resetBreak.listeningProgress.recordedMs,0);
assert.deepEqual(resetBreak.envelopes,[]);assert.equal(resetBreak.scheduled,0);
assert.deepEqual(resetBreak.stored(),{duration:5,elapsed:0,cycle:resetBreak.cycle});

// Recovery composes the real persistence/clock/progress modules without
// writing, scheduling playback, or recounting time from the prior visit.
const recovered=fixture({saved:{duration:25,elapsed:60000}});
recovered.controller.restoreSession(recovered.persistence.restore());
recovered.controller.renderTimer();recovered.history(true);
assert.equal(recovered.clock.elapsedMs,60000);assert.equal(recovered.clock.durationMinutes,25);
assert.equal(recovered.listened,0);assert.equal(recovered.listeningProgress.recordedMs,60000);
assert.equal(recovered.writes,0);assert.equal(recovered.scheduled,0);assert.equal(recovered.playing,false);
assert.ok(recovered.element('resume-status').textContent.includes('Sesión recuperada'));
assert.equal(recovered.element('timer').textContent,'00:24:00');
recovered.setPlaying(true);recovered.controller.startSessionClock();
recovered.advance(3000);recovered.controller.stopSessionClock();
assert.equal(recovered.listened,3);assert.equal(recovered.stored().elapsed,63000);

// A late tick completes and pauses a break through the production playback
// controller. It neither advances to another phase nor counts silent listening.
for(const restSound of ['sound','silent']) {
 const cycle={plan:'25-5',phase:'rest',round:1,completed:false,singleDuration:17};
 const late=fixture({playing:true,cycle,elapsed:299000,restSound});
 late.controller.startSessionClock();late.advance(30*60000);late.tick();
 assert.equal(late.clock.elapsedMs,300000);assert.equal(late.clock.timer,null);
 assert.equal(late.playing,false);assert.deepEqual(late.cycle,{...cycle,completed:true});
 assert.deepEqual(late.audio,[{slow:true,completed:true,elapsed:300000}]);
 assert.equal(late.listened,restSound==='silent'?0:1);
 assert.equal(late.listeningProgress.recordedMs,300000);
 assert.deepEqual(late.stored(),{duration:5,elapsed:300000,cycle:late.cycle});
 assert.equal(late.element('timer').textContent,'00:00:00');
 assert.equal(late.element('mobile-timer').textContent,'00:00:00');
 const writes=late.writes,calls=late.calls.length;late.tick();
 assert.equal(late.writes,writes);assert.equal(late.calls.length,calls,'Queued ticks after pause are inert');
}

// Invalid shortcut values preserve recovered progress; valid aliases retain
// precedence and save the replacement simple session without autoplay.
const shortcut=fixture({saved:{duration:25,elapsed:60000}});
shortcut.controller.restoreSession(shortcut.persistence.restore());
for(const query of ['', '?duration=0&mode=17','?duration=bad&mode=17','?duration=181','?duration=1.5']) {
 shortcut.window.location.search=query;shortcut.controller.applyShortcut();
 assert.equal(shortcut.clock.durationMinutes,25);assert.equal(shortcut.clock.elapsedMs,60000);
 assert.equal(shortcut.listeningProgress.recordedMs,60000);assert.equal(shortcut.writes,0);
}
shortcut.window.location.search='?duration=&mode=17';shortcut.controller.applyShortcut();
assert.equal(shortcut.clock.durationMinutes,17);assert.equal(shortcut.clock.elapsedMs,0);
assert.equal(shortcut.listeningProgress.recordedMs,0);
assert.deepEqual(shortcut.stored(),{duration:17,elapsed:0,cycle:shortcut.cycleTools.initial('single',17)});
shortcut.window.location.search='?duration=45&mode=17';shortcut.controller.applyShortcut();
assert.equal(shortcut.clock.durationMinutes,45);
assert.equal(shortcut.scheduled,0);assert.equal(shortcut.playing,false);assert.deepEqual(shortcut.audio,[]);
console.log('PASS: real timer/clock/persistence/playback integration, injected resets, restoration, late breaks, silent history and PWA shortcuts');
