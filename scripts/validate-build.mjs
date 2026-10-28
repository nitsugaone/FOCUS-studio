import {readFile} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
import assert from 'node:assert/strict';

const root=resolve('dist'),base=new URL('https://focus.test/FOCUS-studio/');
async function emitted(url) {
 assert.equal(url.origin,base.origin,'Built assets stay on the application origin');
 assert.ok(url.pathname.startsWith(base.pathname),'Built asset stays inside the deployment subpath: '+url);
 const path=resolve(root,decodeURIComponent(url.pathname.slice(base.pathname.length))||'index.html');
 const within=relative(root,path);
 assert.ok(!within.startsWith('..'+sep)&&within!=='..','Built path stays inside dist');
 return readFile(path,'utf8');
}
const html=await emitted(base);
const scripts=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(match=>new URL(match[1],base));
assert.ok(scripts.length>0,'Vite emitted an application script');
assert.ok(scripts.every(url=>!url.pathname.includes('/src/')),'Built HTML uses the emitted bundle');
for(const url of scripts)await emitted(url);
for(const match of html.matchAll(/<link\b[^>]*\bhref="([^"]+)"/g))await emitted(new URL(match[1],base));

const manifestURL=new URL(html.match(/<link\b[^>]*rel="manifest"[^>]*href="([^"]+)"/)?.[1]??'manifest.json',base);
const manifest=JSON.parse(await emitted(manifestURL));
for(const item of [...(manifest.icons??[]),...(manifest.screenshots??[])])await emitted(new URL(item.src,manifestURL));

const worker=await emitted(new URL('sw.js',base)),events={};let assets;
new Function('self','caches',worker)({addEventListener:(type,fn)=>events[type]=fn},{open:async()=>({addAll:async paths=>{assets=paths;}})});
let installed;events.install({waitUntil:promise=>installed=promise});await installed;
assert.ok(Array.isArray(assets)&&assets.length>0,'Built worker installs a precache list');
for(const asset of assets)await emitted(new URL(asset,base));
assert.ok(assets.every(asset=>!asset.startsWith('./src/')),'Built worker never requests absent source modules');
for(const script of scripts)assert.ok(assets.some(asset=>new URL(asset,base).href===script.href),'Precache includes '+script.pathname);
assert.ok(assets.includes('./audio/noise-processor.js'),'Precache includes the audio worklet');
console.log('PASS: actual Vite output, deployment subpath, manifest assets and '+assets.length+' offline URLs');
