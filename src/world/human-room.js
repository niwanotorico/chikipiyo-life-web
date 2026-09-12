// Compatibility entry point; all coordinates now come from the latest Blend export.
import {roomFurniture} from './room-layout.js';
export {loadLatestRoom as loadHumanRoom} from './latest-room.js';
export const humanLayout=Object.fromEntries(roomFurniture.map(f=>[f.id,f]));
