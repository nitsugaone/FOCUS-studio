import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const mount='/FOCUS-studio/';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
 try {
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  if(pathname==='/'){res.writeHead(302,{location:mount});res.end();return;}
  if(!pathname.startsWith(mount)){res.writeHead(404);res.end();return;}
  const relative=pathname.slice(mount.length)||'index.html';
  const allowed=['index.html','sw.js','manifest.json'].includes(relative)||['src/','audio/','icons/','screenshots/'].some(prefix=>relative.startsWith(prefix));
  const target=path.resolve(root,relative);
  if(!allowed||path.relative(root,target).startsWith('..')){res.writeHead(404);res.end();return;}
  const body=await readFile(target);
  res.writeHead(200,{'content-type':types[path.extname(target)]||'application/octet-stream','cache-control':'no-store'});
  res.end(req.method==='HEAD'?undefined:body);
 } catch(error) {res.writeHead(error.code==='ENOENT'?404:400);res.end();}
});
server.listen(4173,'127.0.0.1',()=>console.log('FOCUS test server: http://127.0.0.1:4173/FOCUS-studio/'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
