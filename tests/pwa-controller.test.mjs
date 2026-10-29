import assert from 'node:assert/strict';
import {createPwaController} from '../src/ui/PwaController.js';

function events() {
 const listeners=new Map();
 return {addEventListener(type,callback){const list=listeners.get(type)??[];list.push(callback);listeners.set(type,list);},
  emit(type,event){return Promise.all((listeners.get(type)??[]).map(callback=>callback(event)));}
 };
}
function fixture(options={}) {
 const calls=[],messages=[],elements=new Map(),state={playing:false,transitioning:false},faults={register:false};
 let reloads=0;
 const $=id=>{if(!elements.has(id))elements.set(id,{...events(),hidden:true,disabled:false,textContent:''});return elements.get(id);};
 const worker={postMessage(message){assert.equal(this,worker);calls.push('activate');messages.push(message);}};
 const registration={...events(),waiting:options.waiting===false?null:worker,installing:null};
 const serviceWorker={...events(),ready:options.ready??Promise.resolve(),async register(path){
  assert.equal(this,serviceWorker);assert.equal(path,'./sw.js');calls.push('register');
  if(faults.register)throw Error('Registration blocked');return registration;
 }};
 const window={...events(),location:{reload(){reloads++;calls.push('reload');}}};
 const navigator={onLine:options.onLine??true};if(!options.unsupported)navigator.serviceWorker=serviceWorker;
 const controller=createPwaController({window,navigator,$,getPlaybackState:()=>state,saveSession(force){calls.push('save:'+force);}});
 controller.setupInstallAndUpdates();controller.syncUpdateButton();
 return {controller,window,navigator,serviceWorker,registration,worker,$,state,calls,messages,faults,reloads:()=>reloads};
}

const update=fixture();
assert.deepEqual(update.calls,[],'Registration keeps the existing load/online triggers');
await update.$('apply-update').emit('click');assert.deepEqual(update.messages,[]);
await update.window.emit('load');
assert.equal(update.$('apply-update').hidden,false);
assert.equal(update.$('apply-update').disabled,false);
assert.equal(update.$('update-status').textContent,'Nueva versión disponible. Tus mezclas se conservan.');
await update.serviceWorker.emit('controllerchange');
assert.equal(update.reloads(),0,'Discovering a waiting worker never requests reload automatically');
update.state.playing=true;update.controller.syncUpdateButton();
assert.equal(update.$('apply-update').disabled,true);
assert.equal(update.$('update-status').textContent,'Hay una versión nueva. Pausá para actualizar.');
await update.$('apply-update').emit('click');assert.deepEqual(update.messages,[]);
update.state.playing=false;update.state.transitioning=true;update.controller.syncUpdateButton();
assert.equal(update.$('apply-update').disabled,true);
await update.$('apply-update').emit('click');assert.deepEqual(update.messages,[]);
update.state.transitioning=false;update.controller.syncUpdateButton();
assert.equal(update.$('apply-update').disabled,false);
await update.$('apply-update').emit('click');
assert.deepEqual(update.calls.slice(-2),['save:true','activate'],'Save occurs before activation');
assert.deepEqual(update.messages,[{type:'SKIP_WAITING'}]);
assert.equal(update.$('apply-update').disabled,true);
await update.serviceWorker.emit('controllerchange');assert.equal(update.reloads(),1);

const found=fixture({waiting:false});await found.window.emit('load');
assert.equal(found.$('apply-update').hidden,true);
await found.registration.emit('updatefound');
const installing={...events(),state:'installing'};found.registration.installing=installing;
await found.registration.emit('updatefound');await installing.emit('statechange');
assert.equal(found.$('apply-update').hidden,true);
found.registration.waiting=found.worker;installing.state='installed';await installing.emit('statechange');
assert.equal(found.$('apply-update').hidden,false);
await found.serviceWorker.emit('controllerchange');
assert.deepEqual(found.messages,[]);assert.equal(found.reloads(),0);

const install=fixture({unsupported:true});let prompts=0,prevented=0,finishPrompt;
const gate=new Promise(resolve=>{finishPrompt=resolve;});
await install.window.emit('beforeinstallprompt',{preventDefault(){prevented++;},prompt(){prompts++;return gate;},userChoice:Promise.resolve({outcome:'dismissed'})});
assert.equal(prevented,1);assert.equal(install.$('install-app').hidden,false);
const pending=install.$('install-app').emit('click');
assert.equal(prompts,1);assert.equal(install.$('install-app').hidden,true);
await install.$('install-app').emit('click');assert.equal(prompts,1,'A pending prompt is consumed once');
finishPrompt();await pending;
await install.window.emit('beforeinstallprompt',{preventDefault(){},prompt(){prompts++;},userChoice:Promise.resolve()});
await install.window.emit('appinstalled');
assert.equal(install.$('install-app').hidden,true);
await install.$('install-app').emit('click');assert.equal(prompts,1);
await install.window.emit('beforeinstallprompt',{preventDefault(){},async prompt(){throw Error('Prompt blocked');}});
await install.$('install-app').emit('click');
assert.equal(install.$('update-status').textContent,'Usá el menú del navegador para instalar FOCUS.');
assert.equal(install.$('offline-status').textContent,'Este navegador no ofrece instalación sin conexión.');
await install.window.emit('load');assert.deepEqual(install.calls,[]);

let markReady;const ready=new Promise(resolve=>{markReady=resolve;});
const offline=fixture({onLine:false,ready});
assert.equal(offline.$('offline-status').textContent,'Sin conexión. La instalación guardada puede seguir funcionando.');
const loading=offline.window.emit('load');await Promise.resolve();
assert.equal(offline.$('offline-status').textContent,'Sin conexión. La instalación guardada puede seguir funcionando.','Availability waits for serviceWorker.ready');
markReady();await loading;
assert.equal(offline.$('offline-status').textContent,'Sin conexión · FOCUS disponible en este dispositivo.');
await offline.window.emit('offline');
assert.equal(offline.$('offline-status').textContent,'Sin conexión · si ya instalaste FOCUS, podés seguir escuchando.');
offline.navigator.onLine=true;await offline.window.emit('online');
assert.equal(offline.$('offline-status').textContent,'FOCUS está disponible sin conexión en este dispositivo.');
offline.faults.register=true;await assert.doesNotReject(()=>offline.window.emit('online'));
assert.equal(offline.$('offline-status').textContent,'No se pudo preparar el modo sin conexión. Volvé a abrir con internet.');
offline.faults.register=false;await offline.window.emit('online');
assert.equal(offline.$('offline-status').textContent,'FOCUS está disponible sin conexión en este dispositivo.');

console.log('PASS: explicit paused PWA updates, save-before-activation, waiting worker discovery, install prompt lifecycle, connectivity and optional support');
