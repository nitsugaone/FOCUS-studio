import {startFocusApp} from '../src/ui/FocusController.js';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

function verify(html, workletMode='none') {

const elems=new Map(), memory=new Map(), checks=[];
function element(id){if(!elems.has(id))elems.set(id,{hidden:html.includes('id="'+id+'" hidden'),value:({'vol-master':75,'vol-noise':70,'vol-drone':60,'vol-notes':55,evolution:35,brightness:50,'session-rating':3}[id]??''),checked:true,dataset:{},style:{setProperty(){}},classList:{toggle(){}},events:{},attributes:{},focus(){this.focused=true},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.events[k]=fn},replaceChildren(){this.children=[]},append(child){(this.children??=[]).push(child)},add(){},click(){if(!this.disabled)return this.events.click?.()},remove(){},play(){return Promise.resolve()},pause(){}});return elems.get(id);}
const sources=[];let workletNode=null,moduleLoads=0;
const continuous=workletMode==='success',offset=continuous?3:0;
function param(){return {value:0,cancelScheduledValues(){},setTargetAtTime(v){if(!Number.isFinite(v))throw Error('Nonfinite audio parameter');this.value=v},setValueAtTime(v){this.value=v},linearRampToValueAtTime(v){this.value=v},exponentialRampToValueAtTime(v){this.value=v}};}
function node(){return {gain:param(),frequency:param(),Q:param(),detune:param(),pan:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),connections:[],connect(target){this.connections.push(target)},disconnect(){},start(){sources.push(this)},stop(){},events:{},addEventListener(type,fn){this.events[type]=fn}};}
const ctx={sampleRate:8000,currentTime:0,state:'running',destination:node(),createBuffer(ch,len){const d=Array.from({length:ch},()=>new Float32Array(len));return{getChannelData:i=>d[i]}},createChannelSplitter:node,createChannelMerger:node,createGain:node,createOscillator:node,createBufferSource:node,createBiquadFilter:node,createStereoPanner:node,createConvolver:node,createDynamicsCompressor:node,createMediaStreamDestination(){return{...node(),stream:{}}},resume:async()=>{},suspend:async()=>{},close:async()=>{}};
let generated=0;
if(workletMode!=='none')ctx.audioWorklet={addModule:async()=>{moduleLoads++;if(workletMode==='failure')throw Error('Module blocked')}};
const document={body:element('body'),createElement:()=>element('generated-'+generated++),getElementById:element,querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){}};
const timers=[],scheduledTimeouts=new Map();let timeoutId=0;
let observeVisibility;
let layoutChange;
const compactLayout={matches:true,addEventListener(type,callback){layoutChange=callback}};
const windowEvents={};
let updateMessages=0,reloads=0;
const worker={postMessage(message){if(message.type==='SKIP_WAITING')updateMessages++}};
const serviceWorker={ready:Promise.resolve(),addEventListener(){},register:async()=>({waiting:worker,addEventListener(){}})};
const window={matchMedia:()=>compactLayout,IntersectionObserver:class {constructor(callback){observeVisibility=callback;} observe(){}},AudioContext:function(){return ctx},setInterval:fn=>{timers.push(fn);return timers.length},setTimeout:(fn,delay)=>{const id=++timeoutId;scheduledTimeouts.set(id,{fn,delay});return id;},addEventListener(type,fn){windowEvents[type]=fn},location:{origin:'https://focus.test',pathname:'/FOCUS-studio/',hash:'',search:'',reload(){reloads++;windowEvents.pagehide?.()}}};
if(workletMode!=='none')window.AudioWorkletNode=function(){workletNode=node();return workletNode;};
let downloadContent='';
const downloadURL={createObjectURL:()=> 'blob:focus-test',revokeObjectURL(){}};
class DownloadBlob {constructor(parts){downloadContent=parts.join('');}}
const localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
const sampleDate=new Date(Date.now()-1000).toISOString();
memory.set('focus-feedback-v3',JSON.stringify([
 ...Array.from({length:3},()=>({scene:'rain',rating:5,date:sampleDate,minutes:25,distractions:'low'})),
 ...Array.from({length:3},()=>({scene:'ocean',rating:4,date:sampleDate,minutes:25,distractions:'medium'})),
 {scene:'space',rating:2,date:new Date(Date.now()-40*86400000).toISOString(),minutes:25,distractions:'high'}
]));
memory.set('focus-session-v1',JSON.stringify({duration:25,elapsed:60000}));
startFocusApp({window,document,navigator:{serviceWorker,onLine:true},localStorage,Option:function(){},clearTimeout:id=>scheduledTimeouts.delete(id),clearInterval:()=>{},URL:downloadURL,Blob:DownloadBlob});
return (async()=>{
checks.push({check:'Insights render saved ratings for the default period',pass:element('insights-summary').textContent.startsWith('6 valoraciones')});
checks.push({check:'Insights show group and recent rows',pass:element('insights-rows').children.length===2&&element('insights-recent').children.length===6});
const ratingsBefore=memory.get('focus-feedback-v3');
element('insights-period').value='0';element('insights-period').events.change();
checks.push({check:'All-time filter includes older feedback',pass:element('insights-summary').textContent.startsWith('7 valoraciones')});
element('insights-scene').value='ocean';element('insights-scene').events.change();
checks.push({check:'Scene filter updates only selected ratings',pass:element('insights-summary').textContent.startsWith('3 valoraciones')&&element('insights-rows').children.length===1});
checks.push({check:'Filtering leaves stored ratings untouched',pass:memory.get('focus-feedback-v3')===ratingsBefore});
checks.push({check:'Restore previous elapsed time without autoplay',pass:element('timer').textContent==='00:24:00'&&sources.length===0});
checks.push({check:'Recovered session offers explicit start',pass:element('resume-status').textContent.includes('Sesión recuperada')});

const originalTimer=element('timer').textContent,originalSession=memory.get('focus-session-v1');
for(const value of ['', '0', '181', '1.5']) {
 element('custom-minutes').value=value;element('apply-duration').events.click();
 checks.push({check:'Reject custom duration '+value,pass:element('timer').textContent===originalTimer&&memory.get('focus-session-v1')===originalSession&&element('custom-minutes').attributes['aria-invalid']==='true'});
}
element('custom-minutes').value='17';element('apply-duration').events.click();
checks.push({check:'Apply custom duration without autoplay',pass:element('timer').textContent==='00:17:00'&&sources.length===0&&JSON.parse(memory.get('focus-session-v1')).duration===17});
element('custom-minutes').value='25';element('apply-duration').events.click();

const beforeShare=JSON.stringify([...memory]);
element('create-share-link').events.click();
const sharedPayload=JSON.parse(decodeURIComponent(element('share-link').value.split('#mix=')[1]));
checks.push({check:'Sharing exports only settings and custom duration',pass:sharedPayload.duration===25&&!Object.hasOwn(sharedPayload,'history')&&!Object.hasOwn(sharedPayload,'name')&&!Object.hasOwn(sharedPayload,'elapsed')});
checks.push({check:'Creating a shared link does not write local data or start sound',pass:JSON.stringify([...memory])===beforeShare&&sources.length===0});
window.location.hash='#mix=%';windowEvents.hashchange();
checks.push({check:'Malformed shared link leaves settings and audio unchanged',pass:JSON.stringify([...memory])===beforeShare&&sources.length===0&&element('shared-mix-preview').hidden===true});
window.location.hash='';windowEvents.hashchange();

const entryTimerBefore=element('timer').textContent;
checks.push({check:'Old settings use the original entrance',pass:element('fade-in').value==='12'&&element('fade-in').disabled===false});
element('fade-in').value='30';element('fade-in').events.input();
checks.push({check:'Entrance choice persists without starting sound or resetting progress',pass:JSON.parse(memory.get('focus-studio-v3')).fadeInSeconds===30&&element('timer').textContent===entryTimerBefore&&sources.length===0});
element('fade-in').value='5';element('fade-in').events.input();
checks.push({check:'Unsupported entrance keeps the valid setting',pass:JSON.parse(memory.get('focus-studio-v3')).fadeInSeconds===30&&element('fade-in').value==='30'});
element('fade-in').value='12';element('fade-in').events.input();
const fadeTimerBefore=element('timer').textContent;
checks.push({check:'Older settings use original 20-second closing',pass:element('fade-out').value==='20'&&element('fade-out').disabled===false});
element('fade-out').value='60';element('fade-out').events.input();
checks.push({check:'Paused closing choice persists without resetting time',pass:JSON.parse(memory.get('focus-studio-v3')).fadeOutSeconds===60&&element('timer').textContent===fadeTimerBefore&&sources.length===0});
element('fade-out').value='99';element('fade-out').events.input();
checks.push({check:'Invalid closing choice does not replace settings',pass:JSON.parse(memory.get('focus-studio-v3')).fadeOutSeconds===60&&element('fade-out').value==='60'});
element('fade-out').value='20';element('fade-out').events.input();
await windowEvents.load();
checks.push({check:'Waiting update is announced',pass:element('apply-update').hidden===false});
checks.push({check:'Feedback is initially hidden',pass:element('session-feedback').hidden===true});
checks.push({check:'Hidden feedback overrides its grid display',pass:/#session-feedback\[hidden\][^{]*\{display:none\}/.test(html)});
observeVisibility([{isIntersecting:true}]);
checks.push({check:'Dock hides while main control is visible',pass:element('mobile-player').hidden===true});
observeVisibility([{isIntersecting:false}]);
checks.push({check:'Dock appears after main control leaves view',pass:element('mobile-player').hidden===false});

element('fade-out').value='5';element('fade-out').events.input();
element('preset-name').value='Arranque';element('save-mix').events.click();element('saved-mixes').value='0';
element('fade-out').value='20';element('fade-out').events.input();
const startupPlayback=element('mobile-toggle').events.click();
element('load-mix').events.click();
checks.push({check:'Mix loading cannot change closing settings during startup',pass:element('toggle').disabled===true&&element('studio-status').textContent.includes('inicio del audio')&&JSON.parse(memory.get('focus-studio-v3')).fadeOutSeconds===20});
await startupPlayback;
element('saved-mixes').value='0';element('delete-mix').events.click();

checks.push({check:'Dock starts shared player',pass:element('play-label').textContent==='Iniciar' ? false : element('play-label').textContent==='Pausar'});
const activeSession=memory.get('focus-session-v1');
element('custom-minutes').value='9';element('apply-duration').events.click();
checks.push({check:'Custom duration cannot reset active audio',pass:element('apply-duration').disabled===true&&memory.get('focus-session-v1')===activeSession});
element('apply-update').events.click();
checks.push({check:'Updating is blocked during playback',pass:element('apply-update').disabled===true&&updateMessages===0});
checks.push({check:'Dock announces playback state',pass:element('mobile-toggle').attributes['aria-pressed']==='true'});
checks.push({check:'Dock timer matches main timer',pass:element('mobile-timer').textContent===element('timer').textContent});
checks.push({check:'Audio startup: two noise sources, two LFOs, three drones, crackles, two wind LFOs and two note oscillators',pass:sources.length===(continuous?9:12)});
checks.push({check:'Mobile panels start collapsed',pass:['sound-settings','mix-settings','history-card'].every(id=>element(id).open===false)});
const activeSources=sources.length;
const beforeSearch=JSON.stringify([...memory]),searchTimer=element('timer').textContent;
element('mix-search').value='no coincide';element('mix-search').events.input();
checks.push({check:'Searching an empty library leaves audio and data unchanged',pass:JSON.stringify([...memory])===beforeSearch&&sources.length===activeSources&&element('timer').textContent===searchTimer&&element('saved-mixes').disabled===true});
element('clear-mix-search').events.click();
checks.push({check:'Clear search restores the empty query and input focus',pass:element('mix-search').value===''&&element('clear-mix-search').hidden===true&&element('mix-search').focused===true});
element('fade-in').value='0';element('fade-in').events.input();
checks.push({check:'Entrance changes are blocked during playback',pass:element('fade-in').disabled===true&&element('fade-in').value==='12'&&JSON.parse(memory.get('focus-studio-v3')).fadeInSeconds===12});
element('fade-out').value='5';element('fade-out').events.input();
checks.push({check:'Closing choice is guarded during audio',pass:element('fade-out').disabled===true&&element('fade-out').value==='20'&&JSON.parse(memory.get('focus-studio-v3')).fadeOutSeconds===20});

const rhythmTimer=element('timer').textContent;
element('note-pace').value='sparse';element('note-pace').events.input();
checks.push({check:'Sparse notes reschedule without sound burst or timer reset',pass:sources.length===activeSources&&element('timer').textContent===rhythmTimer&&scheduledTimeouts.size===1&&[...scheduledTimeouts.values()][0].delay>=24000&&[...scheduledTimeouts.values()][0].delay<=32400});
element('note-pace').value='frequent';element('note-pace').events.input();
checks.push({check:'Frequent notes replace the pending timer',pass:scheduledTimeouts.size===1&&[...scheduledTimeouts.values()][0].delay>=9000&&[...scheduledTimeouts.values()][0].delay<=12150});
element('melody').checked=false;element('melody').events.input();
checks.push({check:'Melody off cancels pending notes and disables pace selector',pass:scheduledTimeouts.size===0&&element('note-pace').disabled===true});
element('melody').checked=true;element('melody').events.input();
checks.push({check:'Melody on schedules once without an immediate new note',pass:scheduledTimeouts.size===1&&sources.length===activeSources&&element('note-pace').disabled===false});
element('note-pace').value='normal';element('note-pace').events.input();

const beforeBalanceTimer=element('timer').textContent;
const balanceVolumes=JSON.stringify(['master','noise','drone','notes'].map(key=>element('vol-'+key).value));
checks.push({check:'Old studio uses centered balance',pass:element('channel-balance').value===0&&element('channel-balance').attributes['aria-valuetext']==='Centro'});
element('channel-balance').value='-40';element('channel-balance').events.input();
checks.push({check:'Balance changes persist without restarting or changing levels',pass:JSON.parse(memory.get('focus-studio-v3')).balance===-40&&element('channel-balance-value').textContent==='40% izquierda'&&element('timer').textContent===beforeBalanceTimer&&sources.length===activeSources&&JSON.stringify(['master','noise','drone','notes'].map(key=>element('vol-'+key).value))===balanceVolumes});
element('channel-balance').value='101';element('channel-balance').events.input();
checks.push({check:'Invalid balance cannot replace saved settings',pass:JSON.parse(memory.get('focus-studio-v3')).balance===-40&&element('channel-balance').value===-40});
element('center-balance').events.click();
checks.push({check:'Center balance restores both channels without resetting the timer',pass:JSON.parse(memory.get('focus-studio-v3')).balance===0&&element('channel-balance-value').textContent==='Centro'&&element('timer').textContent===beforeBalanceTimer&&sources.length===activeSources});
const beforeWidthTimer=element('timer').textContent;
element('stereo-width').value='0';element('stereo-width').events.input();
checks.push({check:'Stereo width updates while playing without new sources or timer reset',pass:sources.length===activeSources&&element('timer').textContent===beforeWidthTimer&&JSON.parse(memory.get('focus-studio-v3')).stereoWidth===0});
element('stereo-width').value='100';element('stereo-width').events.input();

compactLayout.matches=false;layoutChange();
checks.push({check:'Desktop panels open when the window becomes wide',pass:['sound-settings','mix-settings','history-card'].every(id=>element(id).open===true)});
checks.push({check:'Resize preserves playback and audio graph',pass:element('play-label').textContent==='Pausar'&&sources.length===activeSources});
compactLayout.matches=true;layoutChange();
checks.push({check:'Return to mobile collapses panels',pass:['sound-settings','mix-settings','history-card'].every(id=>element(id).open===false)});
const windSources=sources.length;
const windHighpass=continuous?workletNode.connections[3]:sources[0].connections[1];
const windGust=windHighpass.connections[0].connections[0];
const windGain=windGust.connections[0];
checks.push({check:'Wind is muted in existing scenes',pass:windGain.gain.value===0});
element('soundscape').value='wind';element('soundscape').events.input();
checks.push({check:'Wind uses its filtered branch without adding sources',pass:windGain.gain.value>0&&windGain.gain.value<1&&sources.length===windSources&&element('melody').checked===false&&element('vol-noise').value===70&&element('vol-drone').value===0});
element('evolution').value='0';element('evolution').events.input();
checks.push({check:'Stable wind uses its fixed gain',pass:windGain.gain.value===0.85&&windGust.gain.value===0.52&&sources[8-offset].connections[0].gain.value===0&&sources[9-offset].connections[0].gain.value===0});
element('evolution').value='35';element('evolution').events.input();
element('preserve-mix').checked=true;element('preserve-mix').events.input();
element('vol-noise').value='41';element('vol-noise').events.input?.();
element('soundscape').value='rain';element('soundscape').events.input();
element('soundscape').value='wind';element('soundscape').events.input();
checks.push({check:'Wind respects preserved levels and melody',pass:Number(element('vol-noise').value)===41&&element('melody').checked===false});
element('preserve-mix').checked=false;element('preserve-mix').events.input();
const fireSources=sources.length;
const crackleFilter=continuous?workletNode.connections[2]:sources[2].connections[0];
const crackleGain=crackleFilter.connections[0];
checks.push({check:'Other scenes mute the fire output',pass:crackleGain.gain.value===0});
element('soundscape').value='fire';element('soundscape').events.input();
checks.push({check:'Fire scene has no melody, keeps graph, and enables its texture',pass:JSON.parse(memory.get('focus-studio-v3')).scene==='fire'&&element('melody').checked===false&&element('vol-drone').value===0&&element('vol-noise').value===68&&sources.length===fireSources&&crackleGain.gain.value===0.55});
checks.push({check:'Leaving wind mutes its branch',pass:windGain.gain.value===0});
element('preset-name').value='Fogón';element('save-mix').events.click();
element('create-share-link').events.click();
checks.push({check:'Fire exports through mix and shared link',pass:JSON.parse(memory.get('focus-mixes-v3'))[0].scene==='fire'&&JSON.parse(decodeURIComponent(element('share-link').value.split('#mix=')[1])).scene==='fire'});
element('saved-mixes').value='0';element('delete-mix').events.click();
const roots=[];
for(const scene of ['rain','ocean','space','speech']){
 element('soundscape').value=scene; element('soundscape').events.input();
 const cfg=JSON.parse(memory.get('focus-studio-v3'));
 roots.push(sources[5-offset].frequency.value);
 checks.push({check:'Scene '+scene,pass:cfg.scene===scene && (scene!=='speech'||cfg.melody===false)});
}
checks.push({check:'Leaving fire fades its texture out',pass:crackleGain.gain.value===0});
checks.push({check:'Different drone tunings',pass:new Set(roots).size===3});
const preservedLevels=JSON.stringify(['master','noise','drone','notes'].map(key=>element('vol-'+key).value));
const preservedClock=element('timer').textContent,preservedSourceCount=sources.length;
element('preserve-mix').checked=true;element('preserve-mix').events.input();
for(const scene of ['rain','ocean','space','speech']){
 element('soundscape').value=scene;element('soundscape').events.input();
 checks.push({check:'Preserved mix keeps levels and disabled melody in '+scene,pass:JSON.stringify(['master','noise','drone','notes'].map(key=>element('vol-'+key).value))===preservedLevels&&element('melody').checked===false&&element('timer').textContent===preservedClock&&sources.length===preservedSourceCount});
}
element('preserve-mix').checked=false;element('preserve-mix').events.input();
checks.push({check:'Turning preservation off does not immediately change levels',pass:JSON.stringify(['master','noise','drone','notes'].map(key=>element('vol-'+key).value))===preservedLevels});
element('soundscape').value='rain';element('soundscape').events.input();
checks.push({check:'Next scene restores default levels and melody when preservation is off',pass:element('vol-noise').value===75&&element('vol-drone').value===22&&element('vol-notes').value===18&&element('melody').checked===true});
element('soundscape').value='speech';element('soundscape').events.input();

element('evolution').value='0';element('evolution').events.input();
checks.push({check:'Stable mode disables noise modulation',pass:sources[4-offset].connections[0].gain.value===0 && sources[3-offset].connections[0].gain.value===0});
element('preset-name').value='Lectura';element('save-mix').events.click();
checks.push({check:'Complete preset persistence',pass:JSON.parse(memory.get('focus-mixes-v3'))[0].levels.noise===82});
element('saved-mixes').value='0';element('load-mix').events.click();
checks.push({check:'Protect active session',pass:element('studio-status').textContent.includes('Pausá')});
element('toggle').events.click();
checks.push({check:'Main control pauses dock',pass:element('mobile-toggle').textContent==='Iniciar'&&element('mobile-toggle').attributes['aria-pressed']==='false'});
element('apply-update').events.click();
checks.push({check:'Update is requested only after pause',pass:updateMessages===1});
element('load-mix').events.click();
checks.push({check:'Restore paused preset',pass:element('studio-status').textContent==='Mezcla cargada.'});
checks.push({check:'History starts at zero',pass:Object.values(JSON.parse(memory.get('focus-daily-history-v1'))).every(v=>v===0)});

element('saved-mixes').value='0';
element('preset-name').value='Lectura diaria';element('rename-mix').events.click();
checks.push({check:'Rename preserves mix settings',pass:JSON.parse(memory.get('focus-mixes-v3'))[0].name==='Lectura diaria'&&JSON.parse(memory.get('focus-mixes-v3'))[0].levels.noise===82});
element('favorite-mix').events.click();
checks.push({check:'Favorite persists',pass:JSON.parse(memory.get('focus-mixes-v3'))[0].favorite===true});
element('saved-mixes').value='';element('saved-mixes').events.change();
element('favorite-mixes').children[0].click();
checks.push({check:'Favorite shortcut loads even with no previous selection',pass:element('studio-status').textContent==='Mezcla cargada.'&&element('saved-mixes').value==='0'});
element('vol-noise').value=61;element('update-mix').events.click();
checks.push({check:'Update replaces settings and preserves favorite/name',pass:JSON.parse(memory.get('focus-mixes-v3'))[0].levels.noise===61&&JSON.parse(memory.get('focus-mixes-v3'))[0].favorite===true&&JSON.parse(memory.get('focus-mixes-v3'))[0].name==='Lectura diaria'});
checks.push({check:'Pause saves session snapshot',pass:Number.isFinite(JSON.parse(memory.get('focus-session-v1')).elapsed)});
element('delete-mix').events.click();
checks.push({check:'Delete preset',pass:JSON.parse(memory.get('focus-mixes-v3')).length===0});
checks.push({check:'Optional module load path',pass:moduleLoads===(workletMode==='none'?0:1)});
if(continuous) {
 checks.push({check:'Continuous noise connects both outputs',pass:workletNode.connections.length===4});
 const previous=sources.length;
 workletNode.events.processorerror();
 checks.push({check:'Processor failure restores buffered noise',pass:sources.length===previous+3});
}

const portable={format:'focus-studio-backup',version:1,data:{
 mixes:[{scene:'rain',evolution:35,brightness:50,melody:true,name:'Portable',favorite:false,duration:25,levels:{master:40,noise:60,drone:20,notes:10}}],
 history:{'2026-10-22':15},ratings:[],settings:{master:40,noise:60,drone:20,notes:10},studio:{scene:'rain',evolution:35,brightness:50,melody:true},session:{duration:5,elapsed:60000,cycle:{plan:'25-5',round:1,phase:'rest',completed:false,singleDuration:0}}
}};
element('backup-settings').checked=false;
const mixesBeforeImport=memory.get('focus-mixes-v3');
let sessionBeforeImport=memory.get('focus-session-v1');
element('backup-file').files=[{size:10,text:async()=>'{bad'}];
await element('backup-file').events.change();
checks.push({check:'Invalid backup file never writes data',pass:memory.get('focus-mixes-v3')===mixesBeforeImport&&element('backup-preview').hidden===true});
element('backup-file').files=[{size:2000,text:async()=>JSON.stringify(portable)}];
await element('backup-file').events.change();
checks.push({check:'Valid backup shows preview without importing',pass:element('backup-preview').hidden===false&&memory.get('focus-mixes-v3')===mixesBeforeImport});
element('cancel-backup').events.click();
checks.push({check:'Backup cancel discards preview',pass:element('backup-preview').hidden===true&&element('import-backup').disabled===true});
await element('backup-file').events.change();
await element('mobile-toggle').events.click();
const reloadsBeforeImport=reloads;
element('import-backup').events.click();
checks.push({check:'Restoration is blocked while audio plays',pass:element('import-backup').disabled===true&&reloads===reloadsBeforeImport&&memory.get('focus-mixes-v3')===mixesBeforeImport});
element('mobile-toggle').events.click();
sessionBeforeImport=memory.get('focus-session-v1');
element('backup-settings').checked=true;
element('import-backup').events.click();
checks.push({check:'Restored progress survives the pagehide event',pass:JSON.parse(memory.get('focus-session-v1')).duration===5&&JSON.parse(memory.get('focus-session-v1')).cycle.phase==='rest'});
checks.push({check:'Paused restore imports and requests reload',pass:reloads===reloadsBeforeImport+1&&JSON.parse(memory.get('focus-mixes-v3'))[0].name==='Portable'});
element('undo-backup').events.click();
checks.push({check:'Undo restores previous stored mixes and session',pass:memory.get('focus-mixes-v3')===mixesBeforeImport&&memory.get('focus-session-v1')===sessionBeforeImport&&reloads===reloadsBeforeImport+2});


const beforeDownload=JSON.stringify([...memory]);
element('export-backup').events.click();
checks.push({check:'Download builds a portable JSON backup',pass:JSON.parse(downloadContent).format==='focus-studio-backup'&&document.body.children.at(-1).download.endsWith('.json')});
checks.push({check:'Export leaves stored data unchanged',pass:JSON.stringify([...memory])===beforeDownload});
return checks;
})();
}
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
for(const mode of ['none','failure','success']) {
 const checks=await verify(html,mode);
 for(const check of checks){console.log(check.pass?'PASS':'FAIL',mode,check.check);assert.ok(check.pass,mode+': '+check.check);}
}

const workerEvents={};let forced=0,installation;
const workerSource=await readFile(new URL('../sw.js',import.meta.url),'utf8');
new Function('self','caches','fetch',workerSource)({
 addEventListener:(type,fn)=>workerEvents[type]=fn,
 skipWaiting:()=>{forced++;return Promise.resolve()},clients:{claim:async()=>{}}
},{open:async()=>({addAll:async()=>{}})},()=>{});
workerEvents.install({waitUntil:p=>installation=p});await installation;
assert.equal(forced,0,'Worker install must not force activation');
workerEvents.message({data:{type:'SKIP_WAITING'},waitUntil:p=>installation=p});await installation;
assert.equal(forced,1,'Worker activates after explicit request');
console.log('PASS', 'Worker activation lifecycle (2 checks)');
