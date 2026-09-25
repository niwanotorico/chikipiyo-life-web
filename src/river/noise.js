// Small deterministic noise helpers shared by terrain, rocks and placement.
function hash2(ix,iy){let h=(Math.imul(ix,374761393)+Math.imul(iy,668265263))|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return (h>>>0)/4294967296;}
function hash3(ix,iy,iz){let h=(Math.imul(ix,374761393)+Math.imul(iy,668265263)+Math.imul(iz,2147483647))|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return (h>>>0)/4294967296;}
const fade=t=>t*t*(3-2*t);
export function noise(x,y){
 const ix=Math.floor(x),iy=Math.floor(y),u=fade(x-ix),v=fade(y-iy);
 const a=hash2(ix,iy),b=hash2(ix+1,iy),c=hash2(ix,iy+1),d=hash2(ix+1,iy+1);
 return (a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v)*2-1;
}
export function fbm(x,y,oct=4){let s=0,a=.5,f=1;for(let i=0;i<oct;i++){s+=a*noise(x*f+i*17.3,y*f-i*9.1);f*=2.03;a*=.5;}return s;}
export function noise3(x,y,z){
 const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),u=fade(x-ix),v=fade(y-iy),w=fade(z-iz);
 const l=(a,b,t)=>a+(b-a)*t;
 const n=(i,j,k)=>hash3(ix+i,iy+j,iz+k);
 return l(l(l(n(0,0,0),n(1,0,0),u),l(n(0,1,0),n(1,1,0),u),v),l(l(n(0,0,1),n(1,0,1),u),l(n(0,1,1),n(1,1,1),u),v),w)*2-1;
}
export function fbm3(x,y,z,oct=4){let s=0,a=.5,f=1;for(let i=0;i<oct;i++){s+=a*noise3(x*f,y*f,z*f);f*=2.07;a*=.5;}return s;}
export function rng(seed=1){let s=seed>>>0||1;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};}
export const smooth=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
