import { Color3, Color4, DirectionalLight, Engine, HemisphericLight, Scene, ShadowGenerator, Vector3 } from '../rendering/babylon';
import { World } from '../world/World';
import type { SurvivalCycle } from '../domain/SurvivalCycle';

export class SceneManager {
  readonly scene: Scene;
  readonly world: World;
  private readonly ambient: HemisphericLight;
  private readonly sunlight: DirectionalLight;
  private daylight = 1;
  private shadow: ShadowGenerator | null = null;
  private shadowMeshCount = -1;

  constructor(engine: Engine) {
    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0.12, 0.18, 0.18, 1);
    this.scene.collisionsEnabled = true;
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.018;
    this.scene.fogColor = new Color3(0.12, 0.18, 0.18);
    const ambient = new HemisphericLight('night-ambient', new Vector3(0, 1, 0), this.scene);
    this.ambient = ambient;
    ambient.diffuse = new Color3(0.95, 0.94, 0.92);
    ambient.groundColor = new Color3(0.21, 0.24, 0.22);
    ambient.intensity = 0.65;
    const moonlight = new DirectionalLight('moonlight', new Vector3(0.6, -1, 0.4), this.scene);
    this.sunlight = moonlight;
    moonlight.diffuse = new Color3(0.78, 0.89, 0.9);
    moonlight.intensity = 0.4;
    this.world = new World(this.scene);
    this.scene.imageProcessingConfiguration.contrast = 1.1;
    this.scene.imageProcessingConfiguration.exposure = 1.05;
    if (typeof document !== 'undefined') {
      moonlight.position.set(20, 40, -20);
      this.shadow = new ShadowGenerator(1024, moonlight);
      this.shadow.usePercentageCloserFiltering = true;
      this.shadow.bias = 0.002; this.shadow.normalBias = 0.03;
      this.shadow.setDarkness(0.3);
    }
  }

  updateLighting(cycle: SurvivalCycle, dt: number): void {
    if (this.shadow && this.shadowMeshCount !== this.scene.meshes.length) {
      this.shadowMeshCount = this.scene.meshes.length;
      const map = this.shadow.getShadowMap();
      if (map) map.renderList = this.scene.meshes.filter(mesh => mesh.isVisible && mesh.renderingGroupId !== 1 &&
        !['courtyard', 'base-floor', 'shelter-floor', 'generator-pad', 'open-plaza', 'north-south-avenue', 'east-west-avenue', 'moon', 'ward-crystal'].includes(mesh.name) &&
        !mesh.name.startsWith('blade') && !mesh.name.startsWith('resource-collider') && !mesh.name.endsWith('-collider') && !mesh.name.startsWith('impact-') && !mesh.name.startsWith('magic-'));
    }
    const target = cycle.state.period === 'night' ? 0 : Math.min(1, 0.12 + cycle.secondsRemaining / 68);
    this.daylight += (target - this.daylight) * Math.min(1, dt * 0.5);
    const modifier = cycle.modifier;
    const blood = modifier ? 1 - this.daylight : 0;
    const color = Color3.Lerp(new Color3(0.065, 0.09, 0.13), new Color3(0.49, 0.51, 0.51), this.daylight);
    if (modifier) color.copyFrom(Color3.Lerp(color, Color3.FromHexString(modifier.skyColor), blood * .8));
    this.scene.clearColor.set(color.r, color.g, color.b, 1);
    this.scene.fogColor.copyFrom(color);
    this.scene.fogDensity = 0.018 - this.daylight * 0.011;
    this.ambient.intensity = 0.38 + this.daylight * 0.52;
    this.sunlight.intensity = 0.22 + this.daylight * 0.5;
    this.sunlight.diffuse = Color3.Lerp(new Color3(0.63, 0.76, 0.88), new Color3(1, 0.91, 0.73), this.daylight);
    if (modifier) this.sunlight.diffuse.copyFrom(Color3.Lerp(this.sunlight.diffuse, Color3.FromHexString(modifier.lightColor), blood));
  }
}
