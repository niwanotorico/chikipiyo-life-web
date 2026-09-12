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
const bed=bounds(['bed']),sofa=bounds(['Plane.006']),table=bounds(['table_part_01']),vr=bounds(['vr_part_01']),desk=bounds(['Plane.090']),printer=bounds(['desk_part_09']),vacuum=bounds(['13 Vacuum | Cube.081']);
const diningChair=bounds(['Cube.004']),print=bounds(['edp_house']);
export const roomFurniture=[
 // sleepHeight はリグ原点＝頭の中心が乗る高さ。マットレス天面 .792 / 枕天面 .872。
 // 背中をマットレスへ沈めて、おなかが布団から浮かないところまで下げる。
 {id:'bed',name:'ベッド',icon:'☾',action:'sleep',label:'寝る',...bed,spot:[bed.max[0]+.5,0,bed.position[2]],face:-Math.PI/2,sleepAnchor:[bed.min[0]+.64,0,bed.position[2]],sleepYaw:Math.PI/2,sleepHeight:.99,sleepSink:.05,sleepLift:.08,blanketDrop:.20,blanketDropChicken:.06},
 {id:'sofa',name:'ソファ',icon:'▱',action:'relax',label:'くつろぐ',...sofa,spot:[sofa.min[0]-.5,0,sofa.position[2]],face:0,seatAnchor:[sofa.position[0]-.45,.20,sofa.position[2]+.1]},
 {id:'table',name:'テーブル',icon:'◷',action:'eat',label:'食べる',...table,spot:[diningChair.max[0]+.52,0,diningChair.position[2]],face:-Math.PI/2,seatAnchor:[diningChair.position[0],.43,diningChair.position[2]]},
 {id:'vr',name:'VRヘッドセット',icon:'∞',action:'vr',label:'VRで遊ぶ',...vr,spot:[vr.max[0]+.6,0,vr.position[2]],face:0},
 // 掃除機の本体には背を向けて立ち、ノズルを開いた床側へ押し出す。
 {id:'vacuum',name:'掃除機',icon:'✧',action:'clean',label:'掃除する',...vacuum,spot:[vacuum.min[0]-.65,0,vacuum.position[2]],face:-Math.PI/2},
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
 piyomi:{spot:[backChair.position[0],0,backChair.min[2]-.26],seatAnchor:[backChair.position[0],.53,backChair.position[2]],face:0,activityLabel:'ホットドッグをもぐもぐ',label:'ホットドッグを食べる'},
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
  piyo:{spot:[printChair.position[0]-.26,0,printChair.max[2]+.60],...stand(4.24,-1.92),headTilt:-.21,
   label:'プリントを覗く',activityLabel:'造形物をのぞきこみ中'},
  piyomi:{spot:[printChair.position[0]+.30,0,printChair.max[2]+.60],...stand(4.58,-1.56),headTilt:-.21,
   label:'プリントを覗く',activityLabel:'造形物をのぞきこみ中'},
 };
}
// Static props also block walking, despite having no action buttons.
export const roomObstacles=[...roomFurniture.filter(f=>f.id!=='vacuum'),desk,...[
 ['fridge_part_01'],['07 Stove | Cube.009'],['Kitchen storage'],['Plane.086'],
 ['Circle.002'],['Cube.002'],['Cube.003'],['Cube.004'],
].map(bounds)];
