import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

function verify(html) {
const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
const elems=new Map(), memory=new Map(), checks=[];
function element(id){if(!elems.has(id))elems.set(id,{hidden:html.includes('id="'+id+'" hidden'),value:({'vol-master':75,'vol-noise':70,'vol-drone':60,'vol-notes':55,evolution:35,brightness:50,'session-rating':3}[id]??''),checked:true,dataset:{},style:{setProperty(){}},classList:{toggle(){}},events:{},attributes:{},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.events[k]=fn},replaceChildren(){},add(){},play(){return Promise.resolve()},pause(){}});return elems.get(id);}
const sources=[];
function param(){return {value:0,cancelScheduledValues(){},setTargetAtTime(v){if(!Number.isFinite(v))throw Error('Nonfinite audio parameter');this.value=v},setValueAtTime(v){this.value=v},linearRampToValueAtTime(v){this.value=v},exponentialRampToValueAtTime(v){this.value=v}};}
function node(){return {gain:param(),frequency:param(),Q:param(),detune:param(),pan:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),connections:[],connect(target){this.connections.push(target)},disconnect(){},start(){sources.push(this)},stop(){},addEventListener(){}};}
const ctx={sampleRate:8000,currentTime:0,state:'running',destination:node(),createBuffer(ch,len){const d=Array.from({length:ch},()=>new Float32Array(len));return{getChannelData:i=>d[i]}},createGain:node,createOscillator:node,createBufferSource:node,createBiquadFilter:node,createStereoPanner:node,createConvolver:node,createDynamicsCompressor:node,createMediaStreamDestination(){return{...node(),stream:{}}},resume:async()=>{},suspend:async()=>{},close:async()=>{}};
const document={getElementById:element,querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){}};
const timers=[];
let observeVisibility;
let layoutChange;
const compactLayout={matches:true,addEventListener(type,callback){layoutChange=callback}};
const window={matchMedia:()=>compactLayout,IntersectionObserver:class {constructor(callback){observeVisibility=callback;} observe(){}},AudioContext:function(){return ctx},setInterval:fn=>{timers.push(fn);return timers.length},setTimeout:()=>1,addEventListener(){},location:{search:''}};
const localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
new Function('window','document','navigator','localStorage','Option','clearTimeout','clearInterval',script)(window,document,{},localStorage,function(){},()=>{},()=>{});
return (async()=>{
checks.push({check:'Feedback is initially hidden',pass:element('session-feedback').hidden===true});
checks.push({check:'Hidden feedback overrides its grid display',pass:/#session-feedback\[hidden\][^{]*\{display:none\}/.test(html)});
observeVisibility([{isIntersecting:true}]);
checks.push({check:'Dock hides while main control is visible',pass:element('mobile-player').hidden===true});
observeVisibility([{isIntersecting:false}]);
checks.push({check:'Dock appears after main control leaves view',pass:element('mobile-player').hidden===false});
await element('mobile-toggle').events.click();
checks.push({check:'Dock starts shared player',pass:element('play-label').textContent==='Iniciar' ? false : element('play-label').textContent==='Pausar'});
checks.push({check:'Dock announces playback state',pass:element('mobile-toggle').attributes['aria-pressed']==='true'});
checks.push({check:'Dock timer matches main timer',pass:element('mobile-timer').textContent===element('timer').textContent});
checks.push({check:'Audio startup: two noise sources, two LFOs, three drones and two note oscillators',pass:sources.length===9});
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
 roots.push(sources[4].frequency.value);
 checks.push({check:'Scene '+scene,pass:cfg.scene===scene && (scene!=='speech'||cfg.melody===false)});
}
checks.push({check:'Different drone tunings',pass:new Set(roots).size===3});
element('evolution').value='0';element('evolution').events.input();
checks.push({check:'Stable mode disables noise modulation',pass:sources[2].connections[0].gain.value===0 && sources[3].connections[0].gain.value===0});
element('preset-name').value='Lectura';element('save-mix').events.click();
checks.push({check:'Complete preset persistence',pass:JSON.parse(memory.get('focus-mixes-v3'))[0].levels.noise===82});
element('saved-mixes').value='0';element('load-mix').events.click();
checks.push({check:'Protect active session',pass:element('studio-status').textContent.includes('Pausá')});
element('toggle').events.click();
checks.push({check:'Main control pauses dock',pass:element('mobile-toggle').textContent==='Iniciar'&&element('mobile-toggle').attributes['aria-pressed']==='false'});
element('load-mix').events.click();
checks.push({check:'Restore paused preset',pass:element('studio-status').textContent==='Mezcla cargada.'});
checks.push({check:'History starts at zero',pass:Object.values(JSON.parse(memory.get('focus-daily-history-v1'))).every(v=>v===0)});
element('delete-mix').events.click();
checks.push({check:'Delete preset',pass:JSON.parse(memory.get('focus-mixes-v3')).length===0});
return checks;
})();
}
const checks = await verify(await readFile(new URL('../index.html', import.meta.url), 'utf8'));
for (const check of checks) { console.log(check.pass ? 'PASS' : 'FAIL', check.check); assert.ok(check.pass, check.check); }
