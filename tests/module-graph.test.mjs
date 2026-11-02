import {readFile,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),modules=new Map(),visiting=new Set();
const sourceRoot=new URL('src/',root);
const layer=url=>decodeURIComponent(url.href.slice(sourceRoot.href.length)).split('/')[0];
async function visit(url) {
 assert.ok(!visiting.has(url.href),'No production import cycles: '+url.href);
 if(modules.has(url.href))return;
 visiting.add(url.href);
 const source=await readFile(url,'utf8');modules.set(url.href,source);
 for(const match of source.matchAll(/^import .*?from ['"]([^'"]+)['"];?$/gm)) {
  assert.ok(match[1].startsWith('.'),'Production modules use only local dependencies');
  const dependency=new URL(match[1],url);
  assert.ok(dependency.href.startsWith(new URL('src/',root).href),'Module dependency stays inside src');
  const owner=layer(url),target=layer(dependency);
  if(['audio','storage','session'].includes(owner)) {
   assert.ok(['audio','storage','session'].includes(target),'Domain modules cannot depend on UI/bootstrap: '+url.href);
  }
  if(owner==='audio')assert.equal(target,'audio','Audio depends only on its own domain: '+url.href);
  await visit(dependency);
 }
 visiting.delete(url.href);
}
await visit(new URL('src/main.js',root));
async function verifySourceInventory(directory) {
 for(const entry of await readdir(directory,{withFileTypes:true})) {
  const url=new URL(entry.name+(entry.isDirectory()?'/':''),directory);
  if(entry.isDirectory())await verifySourceInventory(url);
  else if(entry.isFile()&&entry.name.endsWith('.js')) {
   assert.ok(modules.has(url.href),'Every src JavaScript module is reachable from main: '+url.href);
  }
 }
}
await verifySourceInventory(sourceRoot);
for(const [href,source] of modules) {
 const url=new URL(href),owner=layer(url);
 if(['audio','storage','session'].includes(owner)) {
  assert.doesNotMatch(source,/\bdocument\b|\blocalStorage\b|\$\(/,'Domain modules use injected adapters, without DOM/browser storage: '+href);
 }
 if(owner!=='audio') {
  assert.doesNotMatch(source,/\b(?:AudioContext|webkitAudioContext|AudioWorkletNode)\b|\.create(?:Gain|Oscillator|BiquadFilter|Convolver|BufferSource|Buffer|StereoPanner|ChannelSplitter|ChannelMerger|DynamicsCompressor|MediaStreamDestination)\s*\(/,'Only the audio domain constructs Web Audio resources: '+href);
 }
}
console.log('PASS: acyclic production imports, domain boundaries, browser-independent domain and audio-node ownership');

const worker=await readFile(new URL('sw.js',root),'utf8');
assert.equal(worker,await readFile(new URL('public/sw.js',root),'utf8'),'Both workers stay synchronized');
const workerEvents={},cachedAssets=[];
new Function('self','caches',worker)({
 addEventListener:(type,handler)=>{workerEvents[type]=handler;}
},{
 open:async()=>({addAll:async assets=>{cachedAssets.push(...assets);}})
});
let installation;
workerEvents.install({waitUntil:promise=>{installation=promise;}});
assert.ok(installation&&typeof installation.then==='function','Worker installation waits for precache');
await installation;
assert.ok(cachedAssets.length>0&&cachedAssets.every(asset=>typeof asset==='string'),'Installation precaches explicit asset paths');
for(const asset of cachedAssets) {
 const url=new URL(asset,root);
 assert.ok(url.href.startsWith(root.href),'Precached asset stays inside the application: '+asset);
 await readFile(url.href===root.href?new URL('index.html',root):url);
}
for(const href of modules.keys()) {
 const relative=decodeURIComponent(href.slice(root.href.length));
 assert.ok(worker.includes("'./"+relative+"'"),'Offline precache includes '+relative);
 assert.ok(cachedAssets.includes('./'+relative),'Worker installation actually precaches '+relative);
}
assert.ok(worker.includes("'./audio/noise-processor.js'"),'Offline precache includes the worklet');
assert.ok(cachedAssets.includes('./audio/noise-processor.js'),'Worker installation actually precaches the worklet');
console.log('PASS: complete src inventory, real worker install handler and '+cachedAssets.length+' existing precache paths');
console.log('PASS: all '+modules.size+' production ES modules resolve and are precached offline');
