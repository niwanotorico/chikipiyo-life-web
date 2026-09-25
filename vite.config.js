import {defineConfig} from 'vite';
import {resolve} from 'node:path';
import {places} from './src/nav/places.js';

// Multi-page build: one HTML per place in src/nav/places.js (house = index.html, river = river.html, ...).
export default defineConfig({
 build:{rollupOptions:{input:Object.fromEntries(places.map(p=>[p.id==='house'?'main':p.id,resolve(import.meta.dirname,p.page)]))}}
});
