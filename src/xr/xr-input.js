import * as T from 'three';

// Quest コントローラー（左右）の共通入力。
//  - hand.ray  … ターゲットレイ空間（指し示す向き。UI や「合わせ」のレイキャスト用）
//  - hand.grip … グリップ空間（握った手の位置・向き。将来ここに釣り竿を持たせる）
//  - hand.stick() / pressed(i) / pulse() … スティック・ボタン・振動
// xr-standard のボタン番号：0 トリガー / 1 グリップ / 3 スティック押し込み / 4 A・X / 5 B・Y
export const BUTTON={trigger:0,squeeze:1,stick:3,a:4,b:5};

export function createXRInput(renderer,rig,{models=true,rayLength=.45}={}){
 const hands={left:null,right:null},listeners={};
 const on=(type,fn)=>{(listeners[type]||(listeners[type]=[])).push(fn);return ()=>{listeners[type]=listeners[type].filter(f=>f!==fn);};};
 const emit=(type,hand,ev)=>{for(const f of listeners[type]||[])f(hand,ev);};
 let factory=null;
 if(models)import('three/addons/webxr/XRControllerModelFactory.js').then(m=>{factory=new m.XRControllerModelFactory();for(const s of slots)if(s.connected)attachModel(s);}).catch(e=>console.warn('[xr] controller models',e));
 function attachModel(s){if(!factory||s.model)return;try{s.model=factory.createControllerModel(s.grip);s.grip.add(s.model);}catch(e){console.warn('[xr] model',e);}}

 const rayGeo=new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3(0,0,-1)]);
 rayGeo.setAttribute('color',new T.Float32BufferAttribute([1,1,1,.9,.97,1],3));
 const rayMat=new T.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.55,depthWrite:false});

 const slots=[0,1].map(i=>{
  const ray=renderer.xr.getController(i),grip=renderer.xr.getControllerGrip(i);rig.add(ray,grip);
  const line=new T.Line(rayGeo,rayMat);line.scale.z=rayLength;line.visible=false;line.name='xr-ray';ray.add(line);
  const s={index:i,ray,grip,line,source:null,handedness:null,connected:false,model:null,prev:[]};
  ray.addEventListener('connected',e=>{
   s.source=e.data;s.handedness=e.data.handedness;s.connected=true;s.prev=[];
   line.visible=e.data.targetRayMode==='tracked-pointer';attachModel(s);
   if(s.handedness==='left'||s.handedness==='right'){hands[s.handedness]=handApi(s);emit('connected',hands[s.handedness]);}
  });
  ray.addEventListener('disconnected',()=>{
   if(s.handedness&&hands[s.handedness]&&hands[s.handedness].slot===s){emit('disconnected',hands[s.handedness]);hands[s.handedness]=null;}
   s.connected=false;s.source=null;line.visible=false;
  });
  for(const t of ['selectstart','selectend','squeezestart','squeezeend'])ray.addEventListener(t,e=>{const h=s.handedness&&hands[s.handedness];if(h&&h.slot===s)emit(t,h,e);});
  return s;
 });

 function handApi(s){
  const tmpQ=new T.Quaternion();
  return {
   slot:s,handedness:s.handedness,ray:s.ray,grip:s.grip,
   get gamepad(){return s.source&&s.source.gamepad||null;},
   stick(){const g=this.gamepad;if(!g)return {x:0,y:0};const a=g.axes;return a.length>=4?{x:a[2],y:a[3]}:{x:a[0]||0,y:a[1]||0};},
   pressed(i){const g=this.gamepad;return !!(g&&g.buttons[i]&&g.buttons[i].pressed);},
   value(i){const g=this.gamepad;return g&&g.buttons[i]?g.buttons[i].value:0;},
   pulse(intensity=.5,ms=60){const g=this.gamepad;const h=g&&g.hapticActuators&&g.hapticActuators[0];
    if(h&&h.pulse){h.pulse(intensity,ms);return true;}
    if(g&&g.vibrationActuator&&g.vibrationActuator.playEffect){g.vibrationActuator.playEffect('dual-rumble',{duration:ms,strongMagnitude:intensity,weakMagnitude:intensity});return true;}
    return false;},
   // ワールド座標でのレイ原点と向き
   rayWorld(origin,dir){s.ray.getWorldPosition(origin);s.ray.getWorldQuaternion(tmpQ);dir.set(0,0,-1).applyQuaternion(tmpQ);return {origin,dir};},
  };
 }

 // 毎フレーム：ボタンの押した/離した瞬間を 'buttondown' / 'buttonup' で通知
 function update(){
  for(const s of slots){const h=s.handedness&&hands[s.handedness];const g=s.source&&s.source.gamepad;if(!h||!g)continue;
   g.buttons.forEach((b,i)=>{const was=!!s.prev[i];if(b.pressed!==was){emit(b.pressed?'buttondown':'buttonup',h,{button:i});s.prev[i]=b.pressed;}});}
 }
 return {hands,on,update,slots};
}
