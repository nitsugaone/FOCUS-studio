import {readFile} from 'node:fs/promises';
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
for(const href of modules.keys()) {
 const relative=decodeURIComponent(href.slice(root.href.length));
 assert.ok(worker.includes("'./"+relative+"'"),'Offline precache includes '+relative);
}
assert.ok(worker.includes("'./audio/noise-processor.js'"),'Offline precache includes the worklet');
console.log('PASS: all '+modules.size+' production ES modules resolve and are precached offline');
