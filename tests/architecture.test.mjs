import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {StorageService} from '../src/storage/StorageService.js';
import {SessionClock} from '../src/session/SessionClock.js';
import {FocusAudioEngine} from '../src/audio/FocusAudioEngine.js';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
assert.match(html,/<script type="module" src="\.\/src\/main\.js"><\/script>/);
assert.equal((html.match(/<script>/g)||[]).length,0,'No inline application scripts');
const engineSource=await readFile(new URL('../src/audio/FocusAudioEngine.js',import.meta.url),'utf8');
assert.doesNotMatch(engineSource,/document|localStorage|\$\(/,'Audio engine has no DOM or storage coupling');
const uiSource=await readFile(new URL('../src/ui/FocusController.js',import.meta.url),'utf8');
assert.doesNotMatch(uiSource,/\.create(?:Gain|Oscillator|BiquadFilter|Convolver|BufferSource)\(/,'UI cannot construct audio nodes');
const engine=new FocusAudioEngine({platform:{}});
engine.configure({scene:'rain'}, {master:75}, {elapsedMs:0,durationMinutes:0,silent:false});
assert.equal(engine.initialized(),false,'Construction and configuration do not start audio');
await assert.rejects(engine.resume(),/Web Audio API/);

const memory=new Map(),adapter={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)};
const service=new StorageService(adapter);
assert.equal(service.read('missing',42),42);
service.write('settings',{master:42});assert.deepEqual(service.read('settings',null),{master:42});
memory.set('broken','{');assert.equal(service.read('broken',42),42);
const failing=new StorageService({getItem(){throw Error('Blocked');},setItem(){throw Error('Quota');}});
assert.equal(failing.read('key',null),null);assert.equal(failing.write('key',{}),false);
assert.throws(()=>service.parseBackup('{'));
assert.throws(()=>service.parseBackup('{"version":999}'));

let now=1000,callback,cancelled=[],period;
const clock=new SessionClock({now:()=>now,setInterval:(fn,ms)=>{callback=fn;period=ms;return 7;},clearInterval:id=>cancelled.push(id)});
clock.durationMinutes=1;clock.elapsedMs=58000;
clock.start(()=>clock.advance());assert.equal(period,500);
now=301000;callback();assert.equal(clock.elapsedMs,60000,'Late ticks cap elapsed time');
clock.stop();assert.equal(clock.lastTimestamp,0);assert.equal(clock.timer,null);assert.ok(cancelled.includes(7));
now=900000;clock.advance();assert.equal(clock.elapsedMs,60000,'Stopped time does not advance');
clock.durationMinutes=0;clock.start(()=>clock.advance());now+=3000;callback();assert.equal(clock.elapsedMs,63000);
now-=1000;callback();assert.equal(clock.elapsedMs,63000,'Backward clock does not subtract time');
clock.stop();
console.log('PASS: ES module bootstrap, audio isolation, lazy initialization, storage failures and injected clock lifecycle');
