"""Export Piyomi from the supplied Blender meshes with Web animation pivots."""
import bpy
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'assets'/'characters'/'piyomi.glb'
SOURCE={
 'Body':['piyormi.005','piyormi.006','piyormi.007'],
 'Head':['piyormi.004','piyormi.018','piyormi.019','piyormi.020','piyormi.021','piyormi.022','piyormi.023','piyormi.024'],
 'Wing_L':['piyormi'],
 'Wing_R':['piyormi.001'],
 'Leg_L':['piyormi.003','piyormi.013','piyormi.014','piyormi.015','piyormi.016','piyormi.017'],
 'Leg_R':['piyormi.002','piyormi.008','piyormi.009','piyormi.010','piyormi.011','piyormi.012'],
}
PIVOTS={'Body':(0,0,0),'Head':(0,0,.69),'Wing_L':(-.195,0,.45),'Wing_R':(.195,0,.45),'Leg_L':(-.11,0,.25),'Leg_R':(.11,0,.25)}
SCALE=1.25

web_collection=bpy.data.collections.new('WEB_Piyomi');bpy.context.scene.collection.children.link(web_collection)
parts=[]
for part,names in SOURCE.items():
 objects=[]
 for name in names:
  src=bpy.data.objects[name]
  mesh=bpy.data.meshes.new(f'Piyomi_{name}')
  # The source collection is offset +1 on X; center it before Web export.
  verts=[tuple(Vector(((src.matrix_world @ v.co)*SCALE))-Vector((SCALE,0,0))) for v in src.data.vertices]
  mesh.from_pydata(verts,[],[list(p.vertices) for p in src.data.polygons]);mesh.update()
  for material in src.data.materials: mesh.materials.append(material)
  for polygon,original in zip(mesh.polygons,src.data.polygons): polygon.material_index=original.material_index;polygon.use_smooth=True
  obj=bpy.data.objects.new(f'Piyomi_{name}',mesh);web_collection.objects.link(obj);objects.append(obj)
 bpy.ops.object.select_all(action='DESELECT')
 for obj in objects: obj.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();obj=bpy.context.object
 bpy.context.scene.cursor.location=Vector(PIVOTS[part]);bpy.ops.object.origin_set(type='ORIGIN_CURSOR');obj.name=part;parts.append(obj)

# Preserve the original ground contact after the source is scaled.
floor=min((obj.matrix_world @ vertex.co).z for obj in parts for vertex in obj.data.vertices)
for obj in parts:
 for vertex in obj.data.vertices: vertex.co.z+=.01-floor

for obj in bpy.context.scene.objects: obj.select_set(False)
for obj in parts: obj.select_set(True)
bpy.context.view_layer.objects.active=parts[0]
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_animations=False,export_yup=True,export_apply=True)
print(f'EXPORTED {OUT}')
