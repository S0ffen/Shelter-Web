import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup.js';
import { TransformNode } from '../rendering/babylon';

export type EnemyMotion = 'idle' | 'walk' | 'run' | 'attack' | 'death';
const FADE_SECONDS = .12;
const NAMES: Record<EnemyMotion, RegExp> = {
  idle: /(?:^|[-_ ])(?:idle|rest)(?:$|[-_ ])/i,
  walk: /(?:^|[-_ ])(?:walk|walking|locomotion)(?:$|[-_ ])/i,
  run: /(?:^|[-_ ])(?:run|running|sprint)(?:$|[-_ ])/i,
  attack: /(?:^|[-_ ])(?:attack|strike|slash)(?:$|[-_ ])/i,
  death: /(?:^|[-_ ])(?:death|die)(?:$|[-_ ])/i,
};

type ActiveClip = { weight: number; rate: number };

/** Each actor owns its playback state and cloned joint targets. Geometry, textures and
 * immutable animation keyframes stay shared through the imported model library. */
export class EnemyAnimationController {
  private readonly clips = new Map<EnemyMotion, AnimationGroup>();
  private readonly active = new Map<AnimationGroup, ActiveClip>();
  private readonly restPose: (() => void)[] = [];
  private selected: AnimationGroup | null = null;
  private current: EnemyMotion = 'idle';

  constructor(private readonly groups: readonly AnimationGroup[]) {
    for (const motion of Object.keys(NAMES) as EnemyMotion[]) {
      const group = groups.find(candidate => candidate.targetedAnimations.length > 0 && NAMES[motion].test(candidate.name));
      if (group) this.clips.set(motion, group);
    }
    const targets = new Set<TransformNode>();
    for (const group of groups) {
      group.stop(true);
      for (const track of group.targetedAnimations) if (track.target instanceof TransformNode) targets.add(track.target);
    }
    for (const target of targets) {
      const position = target.position.clone(), rotation = target.rotation.clone(), scaling = target.scaling.clone();
      const quaternion = target.rotationQuaternion?.clone();
      this.restPose.push(() => {
        target.position.copyFrom(position); target.rotation.copyFrom(rotation); target.scaling.copyFrom(scaling);
        if (quaternion && target.rotationQuaternion) target.rotationQuaternion.copyFrom(quaternion);
      });
    }
  }

  get motion(): EnemyMotion { return this.current; }
  get hasSkeletalMotion(): boolean { return this.clips.has('walk') || this.clips.has('run') || this.clips.has('attack'); }
  has(motion: EnemyMotion): boolean { return this.clip(motion) !== null; }

  /** Asset duration is independent of the mutable playback speed. */
  duration(motion: EnemyMotion): number {
    const group = this.clip(motion), fps = group?.targetedAnimations[0]?.animation.framePerSecond;
    return group && fps && group.to > group.from ? (group.to - group.from) / fps : 0;
  }

  private clip(motion: EnemyMotion): AnimationGroup | null {
    return this.clips.get(motion) ?? (motion === 'run' ? this.clips.get('walk') : motion === 'walk' ? this.clips.get('run') : null) ?? null;
  }

  update(motion: EnemyMotion, dt: number, playbackRate = 1, restart = false): boolean {
    const next = this.clip(motion);
    this.current = motion;
    if (next !== this.selected || restart) {
      if (next && restart) { next.stop(true); this.active.delete(next); }
      this.selected = next;
      if (next && !this.active.has(next)) {
        // Weighted crossfades use real render dt, rather than a frame-count-dependent blend.
        next.weight = this.active.size === 0 ? 1 : 0;
        next.start(motion === 'walk' || motion === 'run' || motion === 'idle', dt > 0 ? playbackRate : 0);
        this.active.set(next, { weight: next.weight, rate: playbackRate });
      }
    }
    const amount = Math.max(0, dt) / FADE_SECONDS;
    for (const [group, state] of this.active) {
      const desired = group === this.selected ? 1 : 0;
      state.weight += Math.sign(desired - state.weight) * Math.min(Math.abs(desired - state.weight), amount);
      if (group === this.selected) state.rate = playbackRate;
      group.speedRatio = dt > 0 ? state.rate : 0;
      group.weight = state.weight;
      if (state.weight === 0 && group !== this.selected) { group.stop(true); this.active.delete(group); }
    }
    // Stopping a group keeps its last joint pose in Babylon. Restore the actual bind
    // pose once an unanimated idle/death state has finished fading out.
    if (!this.active.size) this.restorePose();
    return next !== null;
  }

  private restorePose(): void { for (const restore of this.restPose) restore(); }

  reset(): void {
    for (const group of this.groups) group.stop(true);
    this.active.clear(); this.selected = null; this.current = 'idle'; this.restorePose();
  }
}
