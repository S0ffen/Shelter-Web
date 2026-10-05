import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/domain/config';
import type { Position } from '../src/domain/types';
import { createResourceNodes } from '../src/resources/ResourceNode';
import { CITY_BLOCKS, hasLineOfSight, isBlocked, SECTORS, sectorAt, WORLD_BOUNDS } from '../src/world/WorldLayout';
import type { Footprint } from '../src/world/WorldLayout';

function overlaps(a: Footprint, b: Footprint): boolean {
  return Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.z - b.z) < (a.depth + b.depth) / 2;
}

/** Walk the authored streets with the player's collision radius, without destroying nodes. */
function reachablePositions(extra: Footprint[]): Position[] {
  const queue: Position[] = [{ x: Math.round(CONFIG.player.spawn.x), z: Math.round(CONFIG.player.spawn.z) }];
  const visited = new Set([`${queue[0].x},${queue[0].z}`]);
  for (let head = 0; head < queue.length; head++) {
    const from = queue[head];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const to = { x: from.x + dx, z: from.z + dz };
      const key = `${to.x},${to.z}`;
      if (visited.has(key) || to.x <= WORLD_BOUNDS.minX || to.x >= WORLD_BOUNDS.maxX ||
        to.z <= WORLD_BOUNDS.minZ || to.z >= WORLD_BOUNDS.maxZ) continue;
      if (isBlocked(to, 0.32, extra) || isBlocked({ x: from.x + dx / 2, z: from.z + dz / 2 }, 0.32, extra)) continue;
      visited.add(key);
      queue.push(to);
    }
  }
  return queue;
}

describe('authored exploration map', () => {
  it('places thirty-two wood/iron nodes outside ruins, base walls and other nodes', () => {
    const nodes = createResourceNodes();
    expect(nodes).toHaveLength(32);
    expect(new Set(nodes.map(node => node.id)).size).toBe(nodes.length);
    for (const [index, node] of nodes.entries()) {
      expect(CITY_BLOCKS.some(block => overlaps(node.footprint, block)), node.id).toBe(false);
      expect(nodes.slice(index + 1).some(other => overlaps(node.footprint, other.footprint)), node.id).toBe(false);
    }
  });

  it('connects all ten districts and every harvest target to the Shelter streets', () => {
    const nodes = createResourceNodes();
    const reachable = reachablePositions(nodes.map(node => node.footprint));
    for (const sector of SECTORS) {
      expect(reachable.some(position => sectorAt(position).id === sector.id), sector.name).toBe(true);
    }
    for (const node of nodes) {
      const otherNodes = nodes.filter(other => other !== node).map(other => other.footprint);
      expect(reachable.some(position => node.distanceFrom(position) <= 2 &&
        hasLineOfSight(position, node.position, otherNodes)), node.id).toBe(true);
    }
    // The market has accessible streets on both sides, rather than a single dead-end entrance.
    for (const exit of [{ x: -20, z: 32 }, { x: 20, z: 32 }, { x: 0, z: 23 }]) {
      expect(reachable.some(point => point.x === exit.x && point.z === exit.z), JSON.stringify(exit)).toBe(true);
    }
  });
});
