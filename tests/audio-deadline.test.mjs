import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('      function sessionEnvelope('),end=html.indexOf('      function syncFadeUI()',start);
const schedule=new Function(html.slice(start,end)+'return scheduleSessionClosing;')();
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
const a=html.indexOf('      function advanceSessionClock()'),b=html.indexOf('      function startSessionClock()',a);
const advance=new Function('state','now',`
 let {playing,lastTickTimestamp,accumulatedMs,targetDurationMinutes}=state;
 const Date={now:()=>now};
 ${html.slice(a,b)}
 advanceSessionClock();
 return {playing,lastTickTimestamp,accumulatedMs,targetDurationMinutes};
`);
const state={playing:true,lastTickTimestamp:1000,accumulatedMs:58000,targetDurationMinutes:1};
assert.equal(advance(state,301000).accumulatedMs,60000,'Late callbacks never count beyond the completed session');
assert.equal(advance({...state,targetDurationMinutes:0},301000).accumulatedMs,358000,'Free mode retains elapsed time');
assert.equal(advance({...state,playing:false},301000).accumulatedMs,58000,'Paused time is excluded');
assert.equal(advance(state,500).accumulatedMs,58000,'A backwards wall clock cannot subtract time');
console.log('PASS: audio deadline, resume, short sessions, free mode, silent rests and capped background time');
