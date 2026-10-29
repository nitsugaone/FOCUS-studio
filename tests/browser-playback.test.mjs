import assert from 'node:assert/strict';
import {createBrowserPlaybackServices} from '../src/ui/BrowserPlaybackServices.js';

function wakeFixture() {
 let playing=false,requestError=false,releaseError=false,requests=0,releases=0;
 const tokens=[],wakeLock={async request(type){
  assert.equal(this,wakeLock);assert.equal(type,'screen');requests++;
  if(requestError)throw Error('Wake Lock denied');
  const listeners=new Map(),token={
   addEventListener(type,callback){assert.equal(this,token);listeners.set(type,callback);},
   async release(){assert.equal(this,token);releases++;if(releaseError)throw Error('Release denied');},
   externallyReleased(){listeners.get('release')();}
  };
  tokens.push(token);return token;
 }};
 const service=createBrowserPlaybackServices({navigator:{wakeLock},isPlaying:()=>playing,play(){},pause(){}});
 return {service,tokens,setPlaying(value){playing=value;},setRequestError(value){requestError=value;},setReleaseError(value){releaseError=value;},counts:()=>({requests,releases})};
}

const wake=wakeFixture();
await wake.service.requestWakeLock();
assert.deepEqual(wake.counts(),{requests:0,releases:0},'Paused playback never requests a screen lock');
wake.setPlaying(true);await wake.service.requestWakeLock();await wake.service.requestWakeLock();
assert.deepEqual(wake.counts(),{requests:1,releases:0},'An acquired token is reused');
wake.tokens[0].externallyReleased();await wake.service.requestWakeLock();
assert.deepEqual(wake.counts(),{requests:2,releases:0},'A browser release allows reacquisition');
await wake.service.releaseWakeLock();await wake.service.releaseWakeLock();
assert.deepEqual(wake.counts(),{requests:2,releases:1},'Explicit release clears the current token');
wake.setPlaying(false);await wake.service.requestWakeLock();
assert.deepEqual(wake.counts(),{requests:2,releases:1});

const denied=wakeFixture();denied.setPlaying(true);denied.setRequestError(true);
await assert.doesNotReject(()=>denied.service.requestWakeLock());
assert.deepEqual(denied.counts(),{requests:1,releases:0});
denied.setRequestError(false);await denied.service.requestWakeLock();
assert.equal(denied.counts().requests,2,'A denied request leaves the service available');
denied.setReleaseError(true);await assert.doesNotReject(()=>denied.service.releaseWakeLock());
denied.setReleaseError(false);await denied.service.requestWakeLock();
assert.deepEqual(denied.counts(),{requests:3,releases:1},'A failed release still clears the local token');

let metadataReads=0,plays=0,pauses=0;
const handlers=new Map(),mediaSession={setActionHandler(action,handler){assert.equal(this,mediaSession);handlers.set(action,handler);}};
class Metadata {constructor(value){this.value=value;}}
const media=createBrowserPlaybackServices({navigator:{mediaSession},isPlaying:()=>true,
 play(){plays++;},pause(){pauses++;},getMediaMetadata(){metadataReads++;return Metadata;}
});
assert.equal(metadataReads,0,'Construction does not initialize Media Session');
media.setupMediaSession();
assert.equal(metadataReads,1);
assert.ok(mediaSession.metadata instanceof Metadata);
assert.deepEqual(mediaSession.metadata.value,{
 title:'Focus — Paisaje Sonoro',artist:'Síntesis Binaural',album:'Motor Procedural',
 artwork:[{src:'./icons/icon-192.png',sizes:'192x192',type:'image/png'},{src:'./icons/icon-512.png',sizes:'512x512',type:'image/png'}]
});
assert.deepEqual([...handlers.keys()],['play','pause','stop']);
handlers.get('play')();handlers.get('pause')();handlers.get('stop')();
assert.deepEqual({plays,pauses},{plays:1,pauses:2},'Stop keeps the existing pause action');

const unsupported=createBrowserPlaybackServices({navigator:{},isPlaying:()=>true,play(){},pause(){},
 getMediaMetadata(){throw Error('Metadata must not be read without Media Session');}
});
assert.doesNotThrow(()=>unsupported.setupMediaSession());
await assert.doesNotReject(()=>unsupported.requestWakeLock());
await assert.doesNotReject(()=>unsupported.releaseWakeLock());
for(const getMediaMetadata of [()=>undefined,()=>class {constructor(){throw Error('Metadata blocked');}}]) {
 let registrations=0;
 const service=createBrowserPlaybackServices({navigator:{mediaSession:{setActionHandler(){registrations++;}}},
  isPlaying:()=>true,play(){},pause(){},getMediaMetadata
 });
 assert.doesNotThrow(()=>service.setupMediaSession());
 assert.equal(registrations,0,'Metadata failures retain the existing optional-API behavior');
}
const blockedHandler=createBrowserPlaybackServices({navigator:{mediaSession:{setActionHandler(){throw Error('Action unavailable');}}},
 isPlaying:()=>true,play(){},pause(){},getMediaMetadata:()=>Metadata
});
assert.doesNotThrow(()=>blockedHandler.setupMediaSession());

console.log('PASS: browser playback services, native receivers, Wake Lock lifecycle/failures, media metadata/actions and optional API support');
