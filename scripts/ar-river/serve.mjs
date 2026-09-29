// 取り込み・書き出し用の小さな静的サーバー（スクリプトの間だけ動かして閉じる）
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {join,extname,normalize} from 'node:path';
const TYPES={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.wasm':'application/wasm','.css':'text/css','.ogg':'audio/ogg','.mp3':'audio/mpeg','.m4a':'audio/mp4','.wav':'audio/wav','.usdz':'model/vnd.usdz+zip','.bin':'application/octet-stream'};
export function serve(root,port=0){
 return new Promise(res=>{
  const s=createServer(async(req,rsp)=>{
   const p=normalize(decodeURIComponent(new URL(req.url,'http://x').pathname)).replace(/^([/\\])+/,'');
   try{const b=await readFile(join(root,p||'index.html'));rsp.writeHead(200,{'content-type':TYPES[extname(p)]||'application/octet-stream'});rsp.end(b);}
   catch{rsp.writeHead(404);rsp.end('not found');}
  });
  s.listen(port,'127.0.0.1',()=>res({url:`http://127.0.0.1:${s.address().port}/`,close:()=>new Promise(r=>s.close(r))}));
 });
}
