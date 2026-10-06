// 本だなのマンガ：元PNG → 配信用 WebP。元PNGは そのまま残す（読むだけ）。
//   node scripts/build-manga.mjs [--src <元PNGのフォルダ>] [--quality 85] [--max-width 1200] [--only mc-01,daily-02]
// 元PNGの置き場所（既定：../piyodrill/manga）。シリーズのフォルダは catalog.js の folder
//   <src>/01_minecraft/ちきんとぴよこたち_マイクラ自動化の沼.png   （名前に話のタイトルが入っていればよい。下の findEpisode）
// 出力：public/manga/<シリーズID>/<NN>/pNN.webp と src/manga/pages.js（話ID → ページ一覧）
// 変換には ffmpeg（libwebp 入り）を使う。GitHub Actions では動かさない（出力を そのまま公開する）。
import {existsSync,mkdirSync,readdirSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {SERIES} from '../src/manga/catalog.js';
import {MANGA_PAGES} from '../src/manga/pages.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const opt=(name,def)=>{const i=args.indexOf(`--${name}`);return i>=0?args[i+1]:def;};
const src=resolve(opt('src',join(root,'..','piyodrill','manga')));
const quality=Number(opt('quality',85));
const maxWidth=Number(opt('max-width',1200));
const only=opt('only','')?new Set(opt('only').split(',')):null;
const outRoot=join(root,'public','manga');

if(!existsSync(src)){console.error(`元PNGのフォルダが ありません: ${src}`);process.exit(1);}
const byName=(a,b)=>a.localeCompare(b,'ja',{numeric:true});
const kb=n=>`${(n/1024).toFixed(0)} KB`;

function size(file){
 const out=execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','csv=p=0',file],{encoding:'utf8'}).trim();
 const [w,h]=out.split(',').map(Number);return {w,h};
}
// 文字と細い線を守るため：縮小は lanczos、WebP は picture（イラスト向け）プリセット。quality 85 は q70/q85/PNG を2倍拡大で見くらべて決めた
function toWebp(input,output){
 execFileSync('ffmpeg',['-v','error','-y','-i',input,'-vf',`scale='min(${maxWidth},iw)':-2:flags=lanczos`,'-c:v','libwebp','-preset','picture','-quality',String(quality),'-compression_level','6',output]);
}

// <src>/<フォルダ>/ の中から、名前に話のタイトルが入っているものをさがす
//   ちきんとぴよこたち_マイクラ自動化の沼.png        → 1ページの話
//   ちきんとぴよこたち_自動化の沼_01.png, _02.png …   → ページは名前順
//   自動化の沼/01.png, 02.png …                       → フォルダでもよい
function findEpisode(seriesDir,title){
 if(!existsSync(seriesDir))return null;
 const hits=readdirSync(seriesDir).filter(name=>name.normalize('NFC').includes(title.normalize('NFC'))).sort(byName);
 const dir=hits.find(name=>statSync(join(seriesDir,name)).isDirectory());
 if(dir)return readdirSync(join(seriesDir,dir)).filter(f=>/\.png$/i.test(f)).sort(byName).map(f=>join(seriesDir,dir,f));
 const files=hits.filter(name=>/\.png$/i.test(name)).map(name=>join(seriesDir,name));
 return files.length?files:null;
}

const pages={...MANGA_PAGES};
const report=[];
for(const s of SERIES){
 for(const ep of s.episodes){
  if(only&&!only.has(ep.id))continue;
  const files=findEpisode(join(src,s.folder),ep.title);
  if(!files){report.push({id:ep.id,title:ep.title,note:'元PNGなし（スキップ）'});continue;}
  const nn=String(ep.no).padStart(2,'0');
  const dir=join(outRoot,s.id,nn);
  rmSync(dir,{recursive:true,force:true});mkdirSync(dir,{recursive:true});
  pages[ep.id]=files.map((file,i)=>{
   const name=`p${String(i+1).padStart(2,'0')}.webp`,out=join(dir,name);
   toWebp(file,out);
   const before=statSync(file).size,after=statSync(out).size,{w,h}=size(out),orig=size(file);
   report.push({id:ep.id,title:ep.title,page:i+1,orig:`${orig.w}x${orig.h}`,out:`${w}x${h}`,png:kb(before),webp:kb(after),ratio:`${Math.round(after/before*100)}%`});
   return {src:`manga/${s.id}/${nn}/${name}`,w,h};
  });
 }
}
const ordered=Object.fromEntries(SERIES.flatMap(s=>s.episodes).filter(e=>pages[e.id]).map(e=>[e.id,pages[e.id]]));
writeFileSync(join(root,'src','manga','pages.js'),
`// scripts/build-manga.mjs が書き出すファイル（手で直さない）。
// 話ID → ページ [{src:'manga/<シリーズ>/<話>/pNN.webp', w, h}]
export const MANGA_PAGES={
${Object.entries(ordered).map(([id,list])=>` '${id}':${JSON.stringify(list)},`).join('\n')}
};
`);
console.table(report);
console.log(`WebP quality ${quality}・最大幅 ${maxWidth}px → public/manga/、src/manga/pages.js を更新しました`);
