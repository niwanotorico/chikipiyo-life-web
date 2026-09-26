"""Export only the human-authored piyokichi; never save the source Blend.

The Blend keeps piyokichi placed in the room (rotated 180 degrees). The Web rig
expects the character at the origin facing Blender -Y (glTF +Z), so the Body's
full world transform is removed from every part.
Leg names follow the Web rig: Leg_L is character-left (glTF -X).
"""
import bpy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'model-work/human/chikipiyo-envato-room_human.blend'
OUT = ROOT / 'assets/characters/piyokichi.glb'
digest = lambda: hashlib.sha256(SOURCE.read_bytes()).hexdigest()
before = digest()
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
collection = bpy.data.collections['02 Character | piyokichi']
objects = {o.name: o for o in collection.all_objects if o.type == 'MESH'}
body = objects['Body.001']
to_local = body.matrix_world.inverted()


def local_center_x(obj):
    xs = [(to_local @ obj.matrix_world @ v.co).x for v in obj.data.vertices]
    return sum(xs) / len(xs)


# The two legs are authored as Leg_L.001 and Body.004 (thigh + foot in one
# mesh, same structure as piyomi). Pick left/right by their local side.
legs = sorted([objects['Leg_L.001'], objects['Body.004']], key=local_center_x)
parts = {'Body': body, 'Head': objects['Head.003'],
         }
# Web rig convention (same as chicken/piyomi GLBs): *_L parts sit at local
# x<0 (Leg_L pivot at x=-0.11). glTF x == Blender x in the Y-up export.
parts['Leg_L'], parts['Leg_R'] = legs[0], legs[1]
wing_side = sorted([objects['Wing_L.001'], objects['Wing_R.001']], key=local_center_x)
parts['Wing_L'], parts['Wing_R'] = wing_side[0], wing_side[1]
rows = {name: {'sourceObject': obj.name, 'vertices': len(obj.data.vertices),
               'materials': [s.material.name if s.material else None for s in obj.material_slots],
               'localCenterX': round(local_center_x(obj), 4)}
        for name, obj in parts.items()}
for obj in list(bpy.data.objects):
    obj.name = 'source_' + obj.name
export_scene = bpy.data.scenes.new('Piyokichi export')
bpy.context.window.scene = export_scene
copies = []
for name, src in parts.items():
    obj = src.copy()
    obj.data = src.data.copy()
    obj.name = name
    export_scene.collection.objects.link(obj)
    obj.parent = None
    obj.matrix_world = to_local @ src.matrix_world
    obj.hide_viewport = False
    obj.hide_render = False
    obj.hide_set(False)
    copies.append(obj)
bpy.context.view_layer.update()
for obj in copies:
    obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT), export_format='GLB', use_selection=True,
    export_animations=False, export_apply=True, export_yup=True)
assert before == digest(), 'Source Blend changed'
(ROOT / 'model-work/piyokichi-provenance.json').write_text(json.dumps({
    'source': str(SOURCE.relative_to(ROOT)), 'sha256': before,
    'sourceUnchanged': True, 'parts': rows,
    'roomTransformRemoved': [list(r) for r in body.matrix_world],
}, ensure_ascii=False, indent=2), encoding='utf8')
