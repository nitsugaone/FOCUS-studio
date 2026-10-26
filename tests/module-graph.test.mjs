import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),modules=new Map();
async function visit(url) {
 if(modules.has(url.href))return;
 const source=await readFile(url,'utf8');modules.set(url.href,source);
 for(const match of source.matchAll(/^import .*?from ['"]([^'"]+)['"];?$/gm)) {
  assert.ok(match[1].startsWith('.'),'Production modules use only local dependencies');
  const dependency=new URL(match[1],url);
  assert.ok(dependency.href.startsWith(new URL('src/',root).href),'Module dependency stays inside src');
  await visit(dependency);
 }
}
await visit(new URL('src/main.js',root));
const worker=await readFile(new URL('sw.js',root),'utf8');
assert.equal(worker,await readFile(new URL('public/sw.js',root),'utf8'),'Both workers stay synchronized');
for(const href of modules.keys()) {
 const relative=decodeURIComponent(href.slice(root.href.length));
 assert.ok(worker.includes("'./"+relative+"'"),'Offline precache includes '+relative);
}
assert.ok(worker.includes("'./audio/noise-processor.js'"),'Offline precache includes the worklet');
console.log('PASS: all '+modules.size+' production ES modules resolve and are precached offline');
