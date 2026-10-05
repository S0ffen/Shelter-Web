import { Color3, Color4, DirectionalLight, Engine, HemisphericLight, Scene, Vector3 } from '../rendering/babylon';
import { World } from '../world/World';
import type { SurvivalCycle } from '../domain/SurvivalCycle';

export class SceneManager {
  readonly scene: Scene;
  readonly world: World;
  private readonly ambient: HemisphericLight;
  private readonly sunlight: DirectionalLight;
  private daylight = 1;

  constructor(engine: Engine) {
    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0.12, 0.18, 0.18, 1);
    this.scene.collisionsEnabled = true;
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.018;
    this.scene.fogColor = new Color3(0.12, 0.18, 0.18);
    const ambient = new HemisphericLight('night-ambient', new Vector3(0, 1, 0), this.scene);
    this.ambient = ambient;
    ambient.diffuse = new Color3(0.72, 0.82, 0.8);
    ambient.groundColor = new Color3(0.21, 0.24, 0.22);
    ambient.intensity = 0.65;
    const moonlight = new DirectionalLight('moonlight', new Vector3(0.6, -1, 0.4), this.scene);
    this.sunlight = moonlight;
    moonlight.diffuse = new Color3(0.78, 0.89, 0.9);
    moonlight.intensity = 0.4;
    this.world = new World(this.scene);
  }

  updateLighting(cycle: SurvivalCycle, dt: number): void {
    const target = cycle.state.period === 'night' ? 0 : Math.min(1, 0.25 + cycle.secondsRemaining / 30);
    this.daylight += (target - this.daylight) * Math.min(1, dt * 0.5);
    const color = Color3.Lerp(new Color3(0.075, 0.12, 0.14), new Color3(0.42, 0.49, 0.46), this.daylight);
    this.scene.clearColor.set(color.r, color.g, color.b, 1);
    this.scene.fogColor.copyFrom(color);
    this.scene.fogDensity = 0.023 - this.daylight * 0.011;
    this.ambient.intensity = 0.38 + this.daylight * 0.52;
    this.sunlight.intensity = 0.22 + this.daylight * 0.5;
    this.sunlight.diffuse = Color3.Lerp(new Color3(0.63, 0.76, 0.88), new Color3(1, 0.91, 0.73), this.daylight);
  }
}
