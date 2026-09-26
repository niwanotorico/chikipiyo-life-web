import manifest from '../../assets/room/human-room-manifest.json' with {type:'json'};

// Blender world bounds converted by the exporter to Three.js (X, Z, -Y).
// Pick contact points on the measured surfaces, not on the old Web layout.
const bounds=(names)=>{
 const rows=manifest.meshes.filter(m=>names.includes(m.name));
 if(rows.length!==names.length)throw new Error(`Missing Blender objects: ${names}`);
 const min=[0,1,2].map(i=>Math.min(...rows.map(m=>m.min[i])));
 const max=[0,1,2].map(i=>Math.max(...rows.map(m=>m.max[i])));
 return {min,max,position:[(min[0]+max[0])/2,0,(min[2]+max[2])/2],footprint:[max[0]-min[0],max[2]-min[2]]};
};
const bed=bounds(['bed']),sofa=bounds(['Plane.006']),table=bounds(['table_part_01']),vr=bounds(['vr_part_01']),desk=bounds(['Plane.090']),laptop=bounds(['Plane.145']),printer=bounds(['desk_part_09']),vacuum=bounds(['13 Vacuum | Cube.081']);
const diningChair=bounds(['Cube.004']),print=bounds(['edp_house']);
// キーボードは演奏中だけ出す小物（music-keyboard.glb）。通行の障害物は書き出し時の外形から取る。
// 演奏位置と向きは読み込み後に action-props.js の keyboardPlayPose が鍵盤の向きから決め直す。
const piano=(()=>{
 const rows=manifest.actionProps['music-keyboard'],min=[0,1,2].map(i=>Math.min(...rows.map(r=>r.min[i]))),max=[0,1,2].map(i=>Math.max(...rows.map(r=>r.max[i])));
 // actionProps は Blender 座標（X, Y, Z-up）のまま。Three.js では (X, Z, -Y)。
 return {position:[(min[0]+max[0])/2,0,-(min[1]+max[1])/2],footprint:[max[0]-min[0],max[1]-min[1]]};
})();
export const roomFurniture=[
 // sleepHeight はリグ原点＝頭の中心が乗る高さ。マットレス天面 .792 / 枕天面 .872。
 // 背中をマットレスへ沈めて、おなかが布団から浮かないところまで下げる。
 {id:'bed',name:'ベッド',icon:'☾',action:'sleep',label:'寝る',...bed,spot:[bed.max[0]+.5,0,bed.position[2]],face:-Math.PI/2,sleepAnchor:[bed.min[0]+.64,0,bed.position[2]],sleepYaw:Math.PI/2,sleepHeight:.99,sleepSink:.05,sleepLift:.08,blanketLift:.18,blanketDrop:.20,blanketDropChicken:.06},
 {id:'sofa',name:'ソファ',icon:'▱',action:'relax',label:'くつろぐ',...sofa,spot:[sofa.min[0]-.5,0,sofa.position[2]],face:0,seatAnchor:[sofa.position[0]-.45,.20,sofa.position[2]+.1]},
 {id:'table',name:'テーブル',icon:'◷',action:'eat',label:'食べる',...table,spot:[diningChair.max[0]+.52,0,diningChair.position[2]],face:-Math.PI/2,seatAnchor:[diningChair.position[0],.43,diningChair.position[2]],puddingAnchor:[-2.6353131532669067,-.5302828773856163]},
 {id:'vr',name:'VRヘッドセット',icon:'∞',action:'vr',label:'VRで遊ぶ',...vr,spot:[vr.max[0]+.6,0,vr.position[2]],face:0},
 // 掃除機の本体には背を向けて立ち、ノズルを開いた床側へ押し出す。
 {id:'vacuum',name:'掃除機',icon:'✧',action:'clean',label:'掃除する',...vacuum,spot:[vacuum.min[0]-.65,0,vacuum.position[2]],face:-Math.PI/2},
 {id:'desk',name:'ノートPC',icon:'⌨',action:'model',label:'モデリングする',...desk,spot:[laptop.position[0],0,desk.max[2]+.55],face:Math.PI,modelChairName:'Cube001',modelLaptopName:'立方体002',activityLabel:'PCでモデリング中'},
 {id:'piano',name:'キーボード',icon:'♫',action:'piano',label:'ピアノをひく',...piano,spot:[piano.position[0],0,piano.position[2]-piano.footprint[1]/2-.55],face:0,activityLabel:'キーボードを演奏中'},
 {id:'printer',name:'3Dプリンター',icon:'⌘',action:'print',label:'プリントする',...printer,spot:[printer.min[0]-.55,0,printer.max[2]+.65],face:Math.PI,printBottom:print.min[1],printTop:print.max[1]},
];
roomFurniture.find(f=>f.id==='sofa').seats={
 chiki:{spot:[sofa.min[0]-.52,0,sofa.position[2]],seatAnchor:[sofa.position[0],.22,sofa.position[2]-.12],face:0},
 piyo:{spot:[sofa.min[0]-.52,0,sofa.max[2]-.1],seatAnchor:[sofa.position[0]-.83,.32,sofa.position[2]-.12],face:0},
 piyomi:{spot:[sofa.max[0]+.52,0,sofa.position[2]],seatAnchor:[sofa.position[0]+.83,.32,sofa.position[2]-.12],face:0},
};
const backChair=bounds(['Cube.003']);
roomFurniture.find(f=>f.id==='table').seats={
 chiki:{spot:[table.min[0]-.52,0,-.65],face:Math.PI/2,seatAnchor:null,activityLabel:'コーヒーをひとくち',label:'コーヒーを飲む'},
 piyo:{spot:[diningChair.max[0]+.52,0,diningChair.position[2]],seatAnchor:[diningChair.position[0],.53,diningChair.position[2]],face:-Math.PI/2,activityLabel:'プリンをもぐもぐ',label:'プリンを食べる'},
 // 椅子の背もたれ越しではなく、横（通路側）からぴょんと座面へ乗る。
 piyomi:{spot:[backChair.max[0]+.34,0,backChair.position[2]-.17],seatAnchor:[backChair.position[0],.53,backChair.position[2]],face:0,activityLabel:'ハンバーガーをもぐもぐ',label:'ハンバーガーを食べる'},
};
// 3Dプリンター：ぴよきち・ぴよみは赤い椅子（Cube.002）の上に立って造形物を覗き込み、
// ちきんは椅子に届かないので横から見守る。全員ビルドプレートの方を向く。
// 座面の天面は実測 y=.61、座面は x 4.07..4.73 / z -2.09..-1.39。
const printChair=bounds(['Cube.002']),chairSeatTop=.58;
const plate=[(print.min[0]+print.max[0])/2,print.min[1],(print.min[2]+print.max[2])/2];
const facePlate=(x,z)=>Math.atan2(plate[0]-x,plate[2]-z);
{
 const printer=roomFurniture.find(f=>f.id==='printer');
 const watch=(x,z)=>({face:facePlate(x,z)});
 const stand=(ax,az)=>({standAnchor:[ax,chairSeatTop,az],face:facePlate(ax,az)});
 printer.seats={
  chiki:{spot:printer.spot,...watch(printer.spot[0],printer.spot[2]),headTilt:-.26,
   label:'プリントを見る',activityLabel:'プリントを横から見守る'},
  piyo:{spot:[printChair.position[0]-.26,0,printChair.max[2]+.60],...stand(4.24,-1.76),headTilt:-.21,
   label:'プリントを覗く',activityLabel:'造形物をのぞきこみ中'},
  // Piyomi's wide feet need the middle of the seat, clear of the rear rim.
  // 二人とも、前かがみでのぞいたときにくちばしがビルドプレートの手前の縁（z=-2.27）に届かない位置まで下げる。
  piyomi:{spot:[printChair.position[0]+.30,0,printChair.max[2]+.60],standAnchor:[4.40,.61,-1.70],face:facePlate(4.40,-1.70),headTilt:-.21,
   label:'プリントを覗く',activityLabel:'造形物をのぞきこみ中'},
 };
}
// Static props also block walking, despite having no action buttons.
// キーボードは演奏中しか出さず、斜めに置くと外形の箱が演奏位置まで覆ってしまうので通行の障害物にしない。
export const roomObstacles=[...roomFurniture.filter(f=>!['vacuum','piano'].includes(f.id)),...[
 ['fridge_part_01'],['07 Stove | Cube.009'],['Kitchen storage'],['Plane.086'],
 ['Circle.002'],['Cube.002'],['Cube.003'],['Cube.004'],
].map(bounds)];
