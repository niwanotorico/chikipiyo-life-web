"""Export the river camp set (26 tent + 25 fire) from the human Blend without altering the source.

Run: python export_camp.py   (bpy 5.x)  または  blender --factory-startup --background --python export_camp.py
- 元の .blend は開くだけ（保存しない）。前後で sha256 を比べる
- tent と fire の相対位置はそのまま。原点だけ「焚火の薪の中心・地面の高さ」へずらして書き出す（メモリ上だけ）
- fire に炎のメッシュは無い（石・薪・串・魚だけ）。炎・火の粉・煙・光は Web 側（src/river/campfire.js）
- テクスチャは使っていないので UV・画像は書き出さない（見た目は同じで容量だけ減る。リュック素材のリンク切れ画像も入れない）
"""
import bpy,bmesh,hashlib,json
from pathlib import Path
from mathutils import Vector

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent.parent
SOURCE=HERE/'chikipiyo-envato-room_human.blend'
OUT=ROOT/'assets'/'props'/'camp.glb'
PARTS={'tent':'26 tent','fire':'25 fire'}

def digest(): return hashlib.sha256(SOURCE.read_bytes()).hexdigest()
before=digest()
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))

def objects_in(name):
 col=bpy.data.collections.get(name)
 if not col: raise RuntimeError('Missing collection: '+name)
 objs=[o for o in col.all_objects if o.type=='MESH']
 if not objs: raise RuntimeError('No mesh in '+name)
 return objs
parts={k:objects_in(v) for k,v in PARTS.items()}

# 焚火の中心＝薪（kayu で低い所にある面）の中心。串（kayu・細長い）は高さで除く
def log_center(objs):
 pts=[]
 for o in objs:
  bm=bmesh.new();bm.from_mesh(o.data);mw=o.matrix_world
  for f in bm.faces:
   mat=o.data.materials[f.material_index] if f.material_index<len(o.data.materials) else None
   if not mat or not mat.name.strip().startswith('kayu'):continue
   ws=[mw@v.co for v in f.verts]
   if max(w.z for w in ws)>.36:continue            # 串は .8m まで伸びる。薪は .3m 以下
   pts.extend(ws)
  bm.free()
 lo=Vector((min(p.x for p in pts),min(p.y for p in pts),min(p.z for p in pts)))
 hi=Vector((max(p.x for p in pts),max(p.y for p in pts),max(p.z for p in pts)))
 return (lo+hi)/2,lo,hi
center,llo,lhi=log_center(parts['fire'])
ground=min((o.matrix_world@Vector(c)).z for o in parts['fire'] for c in o.bound_box)
origin=Vector((center.x,center.y,max(0.0,ground)))

bpy.ops.object.select_all(action='DESELECT')
saved=[]
for kind,objs in parts.items():
 for o in objs:
  saved.append((o,o.matrix_world.copy()))
  o['campPart']=kind
  o.matrix_world.translation-=origin
  o.select_set(True)
OUT.parent.mkdir(exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_extras=True,
 export_animations=False,export_apply=True,export_yup=True,export_texcoords=False,
 export_image_format='NONE')                                   # UV を書かないので画像も入れない（リンク切れ画像の空データも防ぐ）
for o,m in saved:
 o.matrix_world=m
 del o['campPart']
if before!=digest(): raise RuntimeError('Source Blend changed during export')

def box(objs):
 ps=[o.matrix_world@Vector(c)-origin for o in objs for c in o.bound_box]
 return [[min(p[i] for p in ps) for i in range(3)],[max(p[i] for p in ps) for i in range(3)]]
def footprint(objs):
 # テントが地面に接する部分（高さ 12cm 以下の頂点＝床・杭）の x・z 範囲（glTF 座標）
 ps=[o.matrix_world@v.co-origin for o in objs for v in o.data.vertices]
 ps=[p for p in ps if p.z<.12]
 return {'x':[min(p.x for p in ps),max(p.x for p in ps)],'z':[min(-p.y for p in ps),max(-p.y for p in ps)]}
toY=lambda lo,hi:{'min':[lo[0],lo[2],-hi[1]],'max':[hi[0],hi[2],-lo[1]]}   # Blender Z-up → glTF Y-up の箱
manifest={'source':str(SOURCE.relative_to(ROOT)),'sha256':before,'sourceUnchanged':True,
 'originBlender':list(origin),'note':'origin = log centre of 25 fire on the ground; glTF is Y-up',
 'logsGltf':toY(llo-origin,lhi-origin),
 'parts':{k:{'objects':[o.name for o in v],'tris':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in v),
   'materials':sorted({o.data.materials[p.material_index].name for o in v for p in o.data.polygons if o.data.materials[p.material_index]}),
   'boxBlender':box(v)} for k,v in parts.items()},
 'tentFootprintGltf':footprint(parts['tent']),
 'bytes':OUT.stat().st_size}
(OUT.with_name('camp-manifest.json')).write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print(json.dumps(manifest,ensure_ascii=False))
