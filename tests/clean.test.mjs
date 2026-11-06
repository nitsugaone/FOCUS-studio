import {mkdtemp,mkdir,writeFile,readFile,rm,symlink,lstat,unlink,realpath} from 'node:fs/promises';
import {join,dirname,basename,relative} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

const fixture=await mkdtemp(join(tmpdir(),'focus-clean-'));
const project=join(fixture,'project with spaces'),outside=join(fixture,'unrelated cwd');
const output=join(project,'dist'),script=join(project,'scripts','clean.mjs');
const exists=path=>lstat(path).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
const run=()=>spawnSync(process.execPath,[script],{cwd:outside,encoding:'utf8'});
try {
 await mkdir(join(project,'scripts'),{recursive:true});
 await mkdir(join(project,'src'));
 await mkdir(join(outside,'dist'),{recursive:true});
 await writeFile(script,await readFile(new URL('../scripts/clean.mjs',import.meta.url),'utf8'));
 await writeFile(join(project,'server.js'),'preserve custom server');
 await writeFile(join(project,'src','keep.js'),'preserve source');
 await writeFile(join(outside,'dist','keep.txt'),'preserve unrelated output');
 await mkdir(join(output,'nested'),{recursive:true});
 await writeFile(join(output,'nested','bundle.js'),'generated bundle');
 await symlink(outside,join(output,'external-link'),process.platform==='win32'?'junction':'dir');

 const cleaned=run();
 assert.equal(cleaned.status,0,cleaned.stderr);
 assert.equal(await exists(output),null,'Only this checkout build output is removed');
 assert.equal(await readFile(join(outside,'dist','keep.txt'),'utf8'),'preserve unrelated output','Cleanup does not follow nested links or target the caller cwd');
 assert.equal(await readFile(join(project,'server.js'),'utf8'),'preserve custom server','Custom server files are preserved');
 assert.equal(await readFile(join(project,'src','keep.js'),'utf8'),'preserve source','Source files are preserved');
 const repeated=run();
 assert.equal(repeated.status,0,repeated.stderr);

 await writeFile(output,'preserve a regular file');
 const file=run();
 assert.notEqual(file.status,0,'A file named dist is not treated as build output');
 assert.equal(await readFile(output,'utf8'),'preserve a regular file');
 await unlink(output);

 await symlink(outside,output,process.platform==='win32'?'junction':'dir');
 const linked=run();
 assert.notEqual(linked.status,0,'A linked output directory is rejected');
 assert.equal((await lstat(output)).isSymbolicLink(),true,'The linked output is preserved on rejection');
 assert.equal(await readFile(join(outside,'dist','keep.txt'),'utf8'),'preserve unrelated output','External data remains intact');
 console.log('PASS: portable cleanup, caller-independent paths, repeated runs, source preservation and link/file guards');
} finally {
 // Verify the absolute disposable fixture before recursive cleanup on every platform.
 const actualFixture=await realpath(fixture),actualTemp=await realpath(tmpdir());
 assert.equal(dirname(actualFixture),actualTemp);
 assert.equal(relative(fixture,actualFixture),'');
 assert.ok(basename(actualFixture).startsWith('focus-clean-'));
 const outputEntry=await exists(output);
 if(outputEntry?.isSymbolicLink())await unlink(output);
 await rm(actualFixture,{recursive:true,force:true});
}
