import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

function verify(html, workletMode='none') {
const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
const elems=new Map(), memory=new Map(), checks=[];
function element(id){if(!elems.has(id))elems.set(id,{hidden:html.includes('id="'+id+'" hidden'),value:({'vol-master':75,'vol-noise':70,'vol-drone':60,'vol-notes':55,evolution:35,brightness:50,'session-rating':3}[id]??''),checked:true,dataset:{},style:{setProperty(){}},classList:{toggle(){}},events:{},attributes:{},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.events[k]=fn},replaceChildren(){this.children=[]},append(child){(this.children??=[]).push(child)},add(){},click(){if(!this.disabled)return this.events.click?.()},remove(){},play(){return Promise.resolve()},pause(){}});return elems.get(id);}
const sources=[];let workletNode=null,moduleLoads=0;
const continuous=workletMode==='success',offset=continuous?2:0;
function param(){return {value:0,cancelScheduledValues(){},setTargetAtTime(v){if(!Number.isFinite(v))throw Error('Nonfinite audio parameter');this.value=v},setValueAtTime(v){this.value=v},linearRampToValueAtTime(v){this.value=v},exponentialRampToValueAtTime(v){this.value=v}};}
function node(){return {gain:param(),frequency:param(),Q:param(),detune:param(),pan:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),connections:[],connect(target){this.connections.push(target)},disconnect(){},start(){sources.push(this)},stop(){},events:{},addEventListener(type,fn){this.events[type]=fn}};}
const ctx={sampleRate:8000,currentTime:0,state:'running',destination:node(),createBuffer(ch,len){const d=Array.from({length:ch},()=>new Float32Array(len));return{getChannelData:i=>d[i]}},createGain:node,createOscillator:node,createBufferSource:node,createBiquadFilter:node,createStereoPanner:node,createConvolver:node,createDynamicsCompressor:node,createMediaStreamDestination(){return{...node(),stream:{}}},resume:async()=>{},suspend:async()=>{},close:async()=>{}};
let generated=0;
if(workletMode!=='none')ctx.audioWorklet={addModule:async()=>{moduleLoads++;if(workletMode==='failure')throw Error('Module blocked')}};
const document={body:element('body'),createElement:()=>element('generated-'+generated++),getElementById:element,querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){}};
const timers=[];
let observeVisibility;
let layoutChange;
const compactLayout={matches:true,addEventListener(type,callback){layoutChange=callback}};
const windowEvents={};
let updateMessages=0,reloads=0;
const worker={postMessage(message){if(message.type==='SKIP_WAITING')updateMessages++}};
const serviceWorker={ready:Promise.resolve(),addEventListener(){},register:async()=>({waiting:worker,addEventListener(){}})};
const window={matchMedia:()=>compactLayout,IntersectionObserver:class {constructor(callback){observeVisibility=callback;} observe(){}},AudioContext:function(){return ctx},setInterval:fn=>{timers.push(fn);return timers.length},setTimeout:()=>1,addEventListener(type,fn){windowEvents[type]=fn},location:{search:'',reload(){reloads++;windowEvents.pagehide?.()}}};
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
new Function('window','document','navigator','localStorage','Option','clearTimeout','clearInterval','URL','Blob',script)(window,document,{serviceWorker,onLine:true},localStorage,function(){},()=>{},()=>{},downloadURL,DownloadBlob);
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
await windowEvents.load();
checks.push({check:'Waiting update is announced',pass:element('apply-update').hidden===false});
checks.push({check:'Feedback is initially hidden',pass:element('session-feedback').hidden===true});
checks.push({check:'Hidden feedback overrides its grid display',pass:/#session-feedback\[hidden\][^{]*\{display:none\}/.test(html)});
observeVisibility([{isIntersecting:true}]);
checks.push({check:'Dock hides while main control is visible',pass:element('mobile-player').hidden===true});
observeVisibility([{isIntersecting:false}]);
checks.push({check:'Dock appears after main control leaves view',pass:element('mobile-player').hidden===false});
await element('mobile-toggle').events.click();
checks.push({check:'Dock starts shared player',pass:element('play-label').textContent==='Iniciar' ? false : element('play-label').textContent==='Pausar'});
element('apply-update').events.click();
checks.push({check:'Updating is blocked during playback',pass:element('apply-update').disabled===true&&updateMessages===0});
checks.push({check:'Dock announces playback state',pass:element('mobile-toggle').attributes['aria-pressed']==='true'});
checks.push({check:'Dock timer matches main timer',pass:element('mobile-timer').textContent===element('timer').textContent});
checks.push({check:'Audio startup: two noise sources, two LFOs, three drones and two note oscillators',pass:sources.length===(continuous?7:9)});
checks.push({check:'Mobile panels start collapsed',pass:['sound-settings','mix-settings','history-card'].every(id=>element(id).open===false)});
const activeSources=sources.length;
compactLayout.matches=false;layoutChange();
checks.push({check:'Desktop panels open when the window becomes wide',pass:['sound-settings','mix-settings','history-card'].every(id=>element(id).open===true)});
checks.push({check:'Resize preserves playback and audio graph',pass:element('play-label').textContent==='Pausar'&&sources.length===activeSources});
compactLayout.matches=true;layoutChange();
checks.push({check:'Return to mobile collapses panels',pass:['sound-settings','mix-settings','history-card'].every(id=>element(id).open===false)});
const roots=[];
for(const scene of ['rain','ocean','space','speech']){
 element('soundscape').value=scene; element('soundscape').events.input();
 const cfg=JSON.parse(memory.get('focus-studio-v3'));
 roots.push(sources[4-offset].frequency.value);
 checks.push({check:'Scene '+scene,pass:cfg.scene===scene && (scene!=='speech'||cfg.melody===false)});
}
checks.push({check:'Different drone tunings',pass:new Set(roots).size===3});
element('evolution').value='0';element('evolution').events.input();
checks.push({check:'Stable mode disables noise modulation',pass:sources[2-offset].connections[0].gain.value===0 && sources[3-offset].connections[0].gain.value===0});
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
 checks.push({check:'Continuous noise connects both outputs',pass:workletNode.connections.length===2});
 const previous=sources.length;
 workletNode.events.processorerror();
 checks.push({check:'Processor failure restores buffered noise',pass:sources.length===previous+2});
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
