import {readFile,readdir} from 'node:fs/promises';

// Read production modules, never a copied implementation or a fixture.
export async function readApplicationSource() {
 const root=new URL('../../src/',import.meta.url);
 async function visit(dir) {
  const entries=await readdir(dir,{withFileTypes:true}),parts=[];
  for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))) {
   const url=new URL(entry.name+(entry.isDirectory()?'/':''),dir);
   if(entry.isDirectory())parts.push(await visit(url));
   else if(entry.name.endsWith('.js'))parts.push(await readFile(url,'utf8'));
  }
  return parts.join('\n');
 }
 return visit(root);
}
export function extractFunctions(source,names) {
 return names.map(name=>{
  const lines=source.split('\n'),start=lines.findIndex(line=>new RegExp('^      (?:async )?function '+name+'\\(').test(line));
  if(start<0)throw Error('Missing production function: '+name);
  if(lines[start].trimEnd().endsWith('}'))return lines[start]+'\n';
  const end=lines.findIndex((line,index)=>index>start&&line==='      }');
  if(end<0)throw Error('Unterminated production function: '+name);
  return lines.slice(start,end+1).join('\n')+'\n';
 }).join('\n');
}
