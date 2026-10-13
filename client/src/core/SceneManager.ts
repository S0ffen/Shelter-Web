import { Color3, Color4, DirectionalLight, Engine, HemisphericLight, Scene, ShadowGenerator, Vector3 } from '../rendering/babylon';
import { World } from '../world/World';
import { LIGHTING_SETTINGS, lightingTarget, blendLighting } from '../rendering/LightingProfile';
import type { LightingProfile } from '../rendering/LightingProfile';
import { WorldLighting } from '../rendering/WorldLighting';
import { SurvivalCycle } from '../domain/SurvivalCycle';

export class SceneManager {
  readonly scene: Scene;
  readonly world: World;
  private readonly ambient: HemisphericLight;
  private readonly sunlight: DirectionalLight;
  private profile: LightingProfile = lightingTarget(new SurvivalCycle());
  private readonly localLighting: WorldLighting;
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
    ambient.diffuse = new Color3(0.83, 0.89, 0.93);
    ambient.groundColor = new Color3(0.22, 0.23, 0.20);
    ambient.intensity = 0.65;
    const moonlight = new DirectionalLight('moonlight', new Vector3(0.6, -1, 0.4), this.scene);
    this.sunlight = moonlight;
    moonlight.diffuse = new Color3(0.78, 0.89, 0.9);
    moonlight.intensity = 0.4;
    this.world = new World(this.scene);
    this.localLighting = new WorldLighting(this.scene);
    this.scene.imageProcessingConfiguration.contrast = 1.08;
    this.scene.imageProcessingConfiguration.exposure = 1.10;
    if (typeof document !== 'undefined') {
      moonlight.position.set(20, 40, -20);
      this.shadow = new ShadowGenerator(2048, moonlight);
      this.shadow.usePercentageCloserFiltering = true;
      this.shadow.bias = 0.002; this.shadow.normalBias = 0.03;
      this.shadow.setDarkness(0.3);
    }
    this.updateLighting(new SurvivalCycle(),0);
  }

  updateLighting(cycle: SurvivalCycle, dt: number): void {
    if (this.shadow && this.shadowMeshCount !== this.scene.meshes.length) {
      this.shadowMeshCount = this.scene.meshes.length;
      const map = this.shadow.getShadowMap();
      if (map) map.renderList = this.scene.meshes.filter(mesh => mesh.isVisible && mesh.renderingGroupId !== 1 && !mesh.metadata?.unlitDetail &&
        !['courtyard', 'base-floor', 'shelter-floor', 'generator-pad', 'open-plaza', 'north-south-avenue', 'east-west-avenue', 'moon', 'ward-crystal'].includes(mesh.name) &&
        !mesh.name.startsWith('blade') && !mesh.name.startsWith('resource-collider') && !mesh.name.endsWith('-collider') && !mesh.name.startsWith('impact-') && !mesh.name.startsWith('magic-') && !mesh.name.startsWith('beacon-mote') && mesh.name !== 'reference-city-floor');
    }
    const target=lightingTarget(cycle);
    this.profile=blendLighting(this.profile,target,1-Math.exp(-Math.max(0,dt)/LIGHTING_SETTINGS.smoothingSeconds));
    const p=this.profile;
    this.scene.clearColor.set(p.sky.r,p.sky.g,p.sky.b,1);this.scene.fogColor.copyFrom(p.sky);this.scene.fogDensity=p.fog;
    this.ambient.intensity=p.ambient;this.ambient.diffuse.copyFrom(p.ambientColor);this.ambient.groundColor.copyFrom(p.groundColor);
    this.sunlight.intensity=p.sun;this.sunlight.diffuse.copyFrom(p.sunColor);
    this.scene.imageProcessingConfiguration.contrast=p.contrast;
    this.shadow?.setDarkness(p.shadowDarkness);
    this.localLighting.update(p.nightFactor,dt);
  }
}
