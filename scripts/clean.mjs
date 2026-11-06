import {lstat,realpath,rm} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';

// Anchor cleanup to this checkout, never to the caller's working directory.
const projectRoot=await realpath(fileURLToPath(new URL('../',import.meta.url)));
const outputDirectory=resolve(projectRoot,'dist');
if(relative(projectRoot,outputDirectory)!=='dist')throw Error('Build output must stay inside the project.');

const entry=await lstat(outputDirectory).catch(error=>{
  if(error.code==='ENOENT')return null;
  throw error;
});
if(entry) {
  if(entry.isSymbolicLink()||!entry.isDirectory())throw Error('Refusing to clean dist: expected a real build directory.');
  const actualDirectory=await realpath(outputDirectory);
  if(relative(outputDirectory,actualDirectory)!=='')throw Error('Refusing to clean dist outside the project.');
  await rm(outputDirectory,{recursive:true,force:true});
}
