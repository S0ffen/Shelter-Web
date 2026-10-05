import type { Position } from '../domain/types';
import { SHELTER_ENTRY, inBase, inHall } from '../world/ShelterLayout';

export function shelterGuide(position: Position, yaw: number): { angle: number; meters: number; label: string; hint: string; inside: boolean } {
  const inside = inHall(position);
  const dx = SHELTER_ENTRY.x - position.x, dz = SHELTER_ENTRY.z - position.z;
  const bearing = Math.atan2(dx, dz) - yaw;
  const angle = Math.atan2(Math.sin(bearing), Math.cos(bearing)) * 180 / Math.PI;
  return { angle, meters: inside ? 0 : Math.round(Math.hypot(dx, dz)), inside,
    label: inside ? 'WEWNĄTRZ SHELTERU' : 'SHELTER',
    hint: inside ? 'Schronienie · wyjście przez otwarte drzwi' : inBase(position) ? 'Teren bazy · budowanie dozwolone' : 'Wróć do bazy · budowanie tylko w Shelterze' };
}
