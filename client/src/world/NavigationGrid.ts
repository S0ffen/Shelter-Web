import type { Position } from '../domain/types';
import { distance } from '../domain/types';
import { isBlocked, WORLD_BOUNDS } from './WorldLayout';
import type { Footprint } from './WorldLayout';
import { SHELTER_GOALS } from './ShelterLayout';

export const SPAWN_AREAS: readonly Position[] = [
  { x: -36, z: 29 }, { x: -19, z: 28 }, { x: 0, z: 38 }, { x: 35, z: 32 },
  { x: 18, z: 20 }, { x: 17, z: -22 }, { x: 30, z: -32 }, { x: 0, z: -39 },
  { x: -31, z: -32 }, { x: -37, z: -18 },
];

/** A shared distance field: one city search, then cheap routes for the whole horde. */
export class NavigationGrid {
  private readonly width = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX - 1;
  private readonly height = WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ - 1;
  private readonly open: Uint8Array;
  private readonly next: Int32Array;
  private readonly costs: Int32Array;
  private readonly destinations = new Map<number, Position>();

  constructor(private readonly obstacles: readonly Footprint[]) {
    const size = this.width * this.height;
    this.open = new Uint8Array(size);
    this.next = new Int32Array(size).fill(-1);
    this.costs = new Int32Array(size).fill(-1);
    for (let i = 0; i < size; i++) this.open[i] = Number(!isBlocked(this.position(i), 0.38, obstacles));
    const queue: number[] = [];
    for (const goal of SHELTER_GOALS) {
      const index = this.index(goal);
      if (index >= 0 && this.open[index] && this.canWalk(this.position(index), goal)) {
        this.costs[index] = 0; queue.push(index); this.destinations.set(index, goal);
      }
    }
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head];
      const from = this.position(current);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const candidate = this.index({ x: from.x + dx, z: from.z + dz });
        if (candidate < 0 || !this.open[candidate] || this.costs[candidate] >= 0 ||
          isBlocked({ x: from.x + dx / 2, z: from.z + dz / 2 }, 0.38, obstacles)) continue;
        this.costs[candidate] = this.costs[current] + 1;
        this.next[candidate] = current;
        queue.push(candidate);
      }
    }
  }

  private index(position: Position): number {
    const x = Math.round(position.x) - WORLD_BOUNDS.minX - 1;
    const z = Math.round(position.z) - WORLD_BOUNDS.minZ - 1;
    return x < 0 || x >= this.width || z < 0 || z >= this.height ? -1 : z * this.width + x;
  }
  private position(index: number): Position {
    return { x: index % this.width + WORLD_BOUNDS.minX + 1, z: Math.floor(index / this.width) + WORLD_BOUNDS.minZ + 1 };
  }
  canWalk(from: Position, to: Position): boolean {
    const steps = Math.max(1, Math.ceil(distance(from, to) / 0.25));
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      if (isBlocked({ x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t }, 0.35, this.obstacles)) return false;
    }
    return true;
  }
  routeFrom(position: Position): Position[] {
    let start = -1;
    let nearest = Infinity;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      const index = this.index({ x: position.x + dx, z: position.z + dz });
      if (index < 0 || this.costs[index] < 0) continue;
      const point = this.position(index);
      const d = distance(position, point);
      if (d < nearest && this.canWalk(position, point)) { nearest = d; start = index; }
    }
    if (start < 0) return [];
    const route: Position[] = [];
    let end = start;
    for (let index = start; index >= 0; index = this.next[index]) { route.push(this.position(index)); end = index; }
    const destination = this.destinations.get(end);
    if (destination) route.push(destination);
    // Collapse straight passages while retaining corners that keep zombies out of walls.
    const result: Position[] = [];
    let from = position;
    for (let i = 0; i < route.length;) {
      let last = i;
      while (last + 1 < route.length && this.canWalk(from, route[last + 1])) last++;
      result.push(route[last]);
      from = route[last];
      i = last + 1;
    }
    return result;
  }
}
