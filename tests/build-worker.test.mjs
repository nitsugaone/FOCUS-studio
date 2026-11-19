import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {buildOfflineWorker,focusOfflinePlugin} from '../scripts/build-offline-worker.mjs';
const fixture=await mkdtemp(join(tmpdir(),'focus-offline-build-'));
const directory=join(fixture,'dist');
try {
 await mkdir(directory);
 await mkdir(join(directory,'assets'));
 await mkdir(join(directory,'audio'));
 await writeFile(join(directory,'index.html'),'<script type="module" src="./assets/app-123.js"></script>');
 await writeFile(join(directory,'assets/app-123.js'),'console.log("bundled app");');
 await writeFile(join(directory,'assets/app-123.js.map'),'{}');
 await writeFile(join(directory,'audio/noise-processor.js'),'// worklet');
 await writeFile(join(directory,'sw.js'),'// public template copy');
 const plugin=focusOfflinePlugin();
 assert.equal(plugin.apply,'build');
 assert.equal(plugin.transformIndexHtml.handler('<link rel="manifest" href="/FOCUS-studio/assets/manifest-abc.json">'),'<link rel="manifest" href="./manifest.json">');
 await plugin.writeBundle({dir:directory});
 const source=await readFile(join(directory,'sw.js'),'utf8');
 const events={};let cached=[];
 new Function('self','caches',source)({addEventListener:(type,fn)=>events[type]=fn},{open:async()=>({addAll:async assets=>{cached=assets;}})});
 let installation;events.install({waitUntil:promise=>installation=promise});await installation;
 assert.deepEqual(cached,['./','./assets/app-123.js','./audio/noise-processor.js','./index.html']);
 assert.ok(cached.every(asset=>!asset.includes('/src/')),'Bundled worker never precaches absent source modules');
 for(const asset of cached.filter(asset=>asset!=='./'))await readFile(join(directory,asset));
 await buildOfflineWorker(directory);assert.equal(await readFile(join(directory,'sw.js'),'utf8'),source,'Repeated build is deterministic');
 await writeFile(join(directory,'assets/app-123.js'),'console.log("changed");');
 await buildOfflineWorker(directory);assert.notEqual(await readFile(join(directory,'sw.js'),'utf8'),source,'Built cache version follows emitted content');
 const workerPath=join(directory,'sw.js');
 const emitted=await readFile(workerPath);
 const invalidTemplate=join(fixture,'template.js');
 const cache="const CACHE_NAME = 'focus-audio-test';\n";
 const precache="const ASSETS_TO_CACHE = ['./'];\n";
 for(const [marker,count,invalid] of [
  ['CACHE_NAME',0,precache],
  ['CACHE_NAME',2,cache.repeat(2)+precache],
  ['ASSETS_TO_CACHE',0,cache],
  ['ASSETS_TO_CACHE',2,cache+precache.repeat(2)]
 ]) {
  await writeFile(invalidTemplate,invalid);
  await assert.rejects(buildOfflineWorker(directory,invalidTemplate),{
   message:'Offline worker template requires exactly one '+marker+' declaration (found '+count+')'
  });
  assert.deepEqual(await readFile(workerPath),emitted,'Invalid template preserves the emitted worker: '+marker+' × '+count);
 }
 console.log('PASS: Vite output hook precaches emitted bundle and worklet, excludes source paths/maps, versions the build and rejects invalid templates');
} finally {await rm(fixture,{recursive:true,force:true});}
