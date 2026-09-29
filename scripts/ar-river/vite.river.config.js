// 取り込み用に渓流ページだけをビルドする（dist-river）。本番の vite.config.js とは別
//   npx vite build -c scripts/ar-river/vite.river.config.js
import {defineConfig} from 'vite';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..');
export default defineConfig({root,build:{outDir:resolve(root,'dist-river'),emptyOutDir:true,rollupOptions:{input:{river:resolve(root,'river.html')}}}});
