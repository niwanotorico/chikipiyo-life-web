export function resolveInteraction(furniture,character){
 if(!furniture)return null;
 const seat=furniture.seats?.[character.id];
 return {...furniture,...seat,reservationKey:seat?`${furniture.id}:${character.id}`:furniture.id};
}
export function occupiedPosition(c){
 return c.phase==='acting'&&c.target?.seatAnchor ? c.target.seatAnchor : c.root.position.toArray();
}
export const personalRadius=c=>c.variant==='chicken'?.42:.34;
