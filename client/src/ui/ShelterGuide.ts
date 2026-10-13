import type { Position } from '../domain/types';
import { SHELTER_ENTRIES, inBase, inHall } from '../world/ShelterLayout';

export function shelterGuide(position: Position, yaw: number): { angle: number; meters: number; label: string; hint: string; inside: boolean } {
  const inside = inHall(position);
  const entry = SHELTER_ENTRIES.reduce((closest, point) => Math.hypot(point.x-position.x,point.z-position.z) < Math.hypot(closest.x-position.x,closest.z-position.z) ? point : closest);
  const dx = entry.x - position.x, dz = entry.z - position.z;
  const bearing = Math.atan2(dx, dz) - yaw;
  const angle = Math.atan2(Math.sin(bearing), Math.cos(bearing)) * 180 / Math.PI;
  return { angle, meters: inside ? 0 : Math.round(Math.hypot(dx, dz)), inside,
    label: inside ? 'INSIDE THE SHELTER' : 'SHELTER',
    hint: inside ? 'Shelter · exit through the open doors' : inBase(position) ? 'Base grounds · building allowed' : 'Return to base · build within Shelter grounds' };
}
