import {readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';

// Runs after Vite has written the public files and the hashed application bundle.
export async function buildOfflineWorker(outputDirectory,workerPath=new URL('../public/sw.js',import.meta.url)) {
 const directory=resolve(outputDirectory);
 async function collect(relative='') {
  const result=[];
  for(const entry of await readdir(join(directory,relative),{withFileTypes:true})) {
   const path=relative?relative+'/'+entry.name:entry.name;
   if(entry.isDirectory())result.push(...await collect(path));
   else if(entry.isFile()&&path!=='sw.js'&&!path.endsWith('.map'))result.push(path);
  }
  return result.sort();
 }
 const files=await collect();
 if(!files.includes('index.html'))throw Error('Offline build requires an emitted index.html');
 const template=await readFile(workerPath,'utf8'),digest=createHash('sha256').update(template);
 for(const file of files)digest.update(file).update(await readFile(join(directory,file)));
 const version=digest.digest('hex').slice(0,16);
 const assets=['./',...files.map(file=>'./'+file)];
 const source=template
  .replace(/const CACHE_NAME = '[^']+';/,"const CACHE_NAME = 'focus-audio-build-"+version+"';")
  .replace(/const ASSETS_TO_CACHE = \[[\s\S]*?\];/,'const ASSETS_TO_CACHE = '+JSON.stringify(assets,null,2)+';');
 if(source===template)throw Error('Offline worker template could not be updated');
 await writeFile(join(directory,'sw.js'),source);
 return assets;
}

export function focusOfflinePlugin() {
 return {
  name:'focus-offline-output',apply:'build',enforce:'post',
  async writeBundle(options) {
   if(!options.dir)throw Error('Offline build requires an output directory');
   await buildOfflineWorker(options.dir);
  }
 };
}
