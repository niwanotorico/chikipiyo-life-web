// Expression meshes remain children of Head and follow all existing head motion.
export function updateCharacterExpression(c){
 if(!c.expressionMeshes)return;
 const action=c.phase==='walking'?'walk':c.action;
 const expression=action==='sleep'?'sleep':
  action==='piano'||(action==='eat'&&c.target?.id==='table')?'happy':'normal';
 for(const [name,meshes] of Object.entries(c.expressionMeshes)){
  for(const mesh of meshes)mesh.visible=name===expression;
 }
}
