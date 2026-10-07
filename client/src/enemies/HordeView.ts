import type { Scene } from '../rendering/babylon';
import type { Zombie } from './Zombie';
import type { Player } from '../player/Player';
import { ZombieView } from './ZombieView';

export class HordeView {
  private readonly views = new Map<string, ZombieView>();
  constructor(private readonly scene: Scene) {}
  hit(id: string): void { this.views.get(id)?.hit(); }
  reset(): void { for (const view of this.views.values()) view.dispose(); this.views.clear(); }
  update(enemies: readonly Zombie[], player: Player, alpha: number, dt: number, time: number): void {
    const ids = new Set(enemies.map(enemy => enemy.id));
    for (const [id, view] of this.views) if (!ids.has(id)) { view.dispose(); this.views.delete(id); }
    for (const enemy of enemies) {
      let view = this.views.get(enemy.id);
      if (!view) { view = new ZombieView(this.scene, enemy.id, enemy.kind); this.views.set(enemy.id, view); }
      view.update(enemy, player, alpha, dt, time);
    }
  }
}
