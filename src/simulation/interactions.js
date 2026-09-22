export function resolveInteraction(furniture,character){
 if(!furniture)return null;
 const seat=furniture.seats?.[character.id];
 const reservationKey=furniture.id==='printer'&&seat?.standAnchor?'printer:chair':seat?`${furniture.id}:${character.id}`:furniture.id;
 return {...furniture,...seat,reservationKey};
}
export function occupiedPosition(c){
 return c.phase==='acting'&&c.target?.seatAnchor ? c.target.seatAnchor : c.root.position.toArray();
}
export const personalRadius=c=>c.variant==='chicken'?.42:.34;
