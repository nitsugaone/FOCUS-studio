import {scheduleSessionClosing as schedule} from '../src/audio/dsp.js';
import {SessionClock} from '../src/session/SessionClock.js';
import {createPlaybackPauseController} from '../src/ui/PlaybackPauseController.js';
import assert from 'node:assert/strict';

function commands(elapsed,duration,fade,silent=false,smooth=false) {
 const events=[],param={value:.2,cancelScheduledValues(time){events.push(['cancel',time]);},setValueAtTime(value,time){events.push(['set',value,time]);},linearRampToValueAtTime(value,time){events.push(['linear',value,time]);}};
 schedule({currentTime:100},param,elapsed,duration,fade,silent,smooth);return events;
}
assert.deepEqual(commands(0,3,60),[['cancel',100],['set',1,100],['set',1,220],['linear',0,280]]);
assert.deepEqual(commands(150000,3,60),[['cancel',100],['set',.5,100],['linear',0,130]],'Resume within closing uses only remaining time');
assert.deepEqual(commands(0,1,60),[['cancel',100],['set',1,100],['set',1,130],['linear',0,160]],'Short phase limits closing to half its length');
assert.deepEqual(commands(999999,0,5),[['cancel',100],['set',1,100]],'Free mode cancels any old deadline');
assert.deepEqual(commands(60000,1,20),[['cancel',100],['set',0,100]]);
assert.deepEqual(commands(70000,1,20),[['cancel',100],['set',0,100]]);
assert.deepEqual(commands(0,25,20,true),[['cancel',100],['set',0,100]],'Silent rest never opens its gate');
for(const fade of [5,20,60])for(const duration of [1,5,25,180]) {
 const events=commands(0,duration,fade);
 assert.equal(events.at(-1)[2],100+duration*60);
 assert.equal(events.at(-1)[1],0);
 assert.equal(events[2][2],100+duration*60-Math.min(fade,duration*30));
}
assert.deepEqual(commands(0,1,20,false,true),[['cancel',100],['set',.2,100],['linear',1,100.06],['set',1,140],['linear',0,160]],'Active reset replaces its deadline with a short smooth transition');
assert.deepEqual(commands(0,0,20,false,true),[['cancel',100],['set',.2,100],['linear',1,100.06]],'Switch to free mode clears the finite deadline');
assert.throws(()=>commands(-1,1,20));
const advance=(state,now)=>{
 const clock=new SessionClock({now:()=>now});
 clock.elapsedMs=state.accumulatedMs;clock.durationMinutes=state.targetDurationMinutes;clock.lastTimestamp=state.lastTickTimestamp;
 clock.advance(state.playing);
 return {...state,accumulatedMs:clock.elapsedMs,lastTickTimestamp:clock.lastTimestamp};
};
const state={playing:true,lastTickTimestamp:1000,accumulatedMs:58000,targetDurationMinutes:1};
assert.equal(advance(state,301000).accumulatedMs,60000,'Late callbacks never count beyond the completed session');
assert.equal(advance({...state,targetDurationMinutes:0},301000).accumulatedMs,358000,'Free mode retains elapsed time');
assert.equal(advance({...state,playing:false},301000).accumulatedMs,58000,'Paused time is excluded');
assert.equal(advance(state,500).accumulatedMs,58000,'A backwards wall clock cannot subtract time');
console.log('PASS: audio deadline, resume, short sessions, free mode, silent rests and capped background time');

function pauseScenario(options={}) {
 let playing=options.playing??true,transitioning=options.transitioning??false,feedbackSession=null;
 const clock={durationMinutes:options.duration??5,elapsedMs:options.elapsed??300000};
 let cycleState={plan:options.plan??'25-5',phase:options.phase??'rest',completed:false},saved=false;
 const studio={scene:'rain',fadeOutSeconds:20},calls=[],elements=new Map();
 const $=id=>{
  if(options.noBackground&&id==='bg-audio')return null;
  if(!elements.has(id))elements.set(id,{hidden:true,pause(){calls.push('background');}});
  return elements.get(id);
 };
 const navigator=options.noMedia?{}:{mediaSession:{playbackState:'playing'}};
 const controller=createPlaybackPauseController({
  clock,getPlaybackState:()=>({playing,transitioning}),setPlaying:value=>{playing=value;calls.push('playing:'+value);},
  getCycleState:()=>cycleState,setCycleState:value=>{cycleState=value;},
  completeCycle:state=>{calls.push('complete');return {...state,completed:true};},
  getStudio:()=>studio,setFeedbackSession:value=>{feedbackSession=value;},$,navigator,
  engine:{pause(slowFade){calls.push('audio:'+slowFade);}},
  stopSessionClock(){calls.push('clock');if(options.stopAt!==undefined)clock.elapsedMs=options.stopAt;},
  saveSession(force){calls.push('save:'+force);saved=cycleState.completed;},
  releaseWakeLock(){calls.push('wake');},syncUI(){calls.push('ui');}
 });
 controller.pause(options.slowFade??false);
 const firstCalls=[...calls];
 if(options.repeat)controller.pause();
 return {result:{completed:cycleState.completed,saved,playing},calls,firstCalls,feedbackSession,elements,navigator,studio};
}
const paused=pauseScenario().result;
assert.deepEqual(paused,{completed:true,saved:true,playing:false},'A late multimedia pause preserves cycle completion');

assert.deepEqual(commands(59000,6,5,false,true),[['cancel',100],['set',.2,100],['linear',1,100.06],['set',1,396],['linear',0,401]],'Extension replaces a nearly elapsed cutoff with a smooth recovery and a new deadline');
assert.deepEqual(commands(55000,1,5,false,true),[['cancel',100],['set',1,100],['linear',0,105]],'Smoothing never crosses the start of an existing closing ramp');
console.log('PASS: extended audio deadline restores smoothly without interfering with close ramps');

// Pause advances/stops the clock before checking completion and saves the completed cycle.
const late=pauseScenario({elapsed:299000,stopAt:300000,repeat:true});
assert.deepEqual(late.result,{completed:true,saved:true,playing:false});
assert.deepEqual(late.calls,['clock','complete','save:true','playing:false','audio:false','background','wake','ui']);
assert.deepEqual(late.calls,late.firstCalls,'Repeated pauses are inert');
assert.equal(late.navigator.mediaSession.playbackState,'paused');
assert.equal(late.feedbackSession,null,'A completed rest does not request focus feedback');
for(const options of [{playing:false},{transitioning:true}])assert.deepEqual(pauseScenario(options).calls,[]);

// Focus completion snapshots current settings; manual pauses preserve the feedback behavior.
const focus=pauseScenario({plan:'single',phase:'focus'});
assert.equal(focus.result.completed,false);
assert.equal(focus.feedbackSession.scene,'rain');
assert.equal(focus.feedbackSession.minutes,5);
assert.ok(Number.isFinite(Date.parse(focus.feedbackSession.date)));
assert.equal(focus.elements.get('session-feedback').hidden,false);
focus.studio.scene='ocean';
assert.equal(focus.feedbackSession.scene,'rain','Feedback keeps a settings snapshot');
const manual=pauseScenario({phase:'focus',elapsed:60000});
assert.equal(manual.feedbackSession,null);
assert.equal(manual.result.completed,false);
const faded=pauseScenario({phase:'focus',elapsed:60000,slowFade:true});
assert.equal(faded.feedbackSession.minutes,1);
assert.ok(faded.calls.includes('audio:true'));
const free=pauseScenario({duration:0,phase:'focus'});
assert.equal(free.feedbackSession,null);
assert.equal(free.result.completed,false);
const minimal=pauseScenario({noBackground:true,noMedia:true});
assert.equal(minimal.result.playing,false);
assert.deepEqual(minimal.calls,['clock','complete','save:true','playing:false','audio:false','wake','ui']);
