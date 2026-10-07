import type { Scene, UniversalCamera } from '../rendering/babylon';

/** One nearest ray hit for fighting, harvesting and repairing the central pillar. */
export function combatTarget(scene: Scene, camera: UniversalCamera, range: number): string | null {
  const pick = scene.pickWithRay(camera.getForwardRay(range), mesh => mesh.isEnabled() && mesh.isPickable);
  const data = pick?.pickedMesh?.metadata;
  return data?.zombieId ?? data?.resourceNodeId ?? data?.shelterCoreId ?? data?.buildingId ?? data?.depositId ?? null;
}
