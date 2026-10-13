import { Light, PointLight, Vector3 } from './babylon';
import type { Scene } from './babylon';
import { FantasyArt } from './FantasyArt';
import { Color3 } from './babylon';
import { LIGHTING_SETTINGS as config } from './LightingProfile';

/** Six local lights plus sky/moon: one bounded shader budget, no point-light shadow maps. */
export class WorldLighting {
  private readonly warm: PointLight[] = [];
  private readonly arcane: PointLight[] = [];
  private time = 0;
  constructor(scene: Scene) {
    const create=(name:string,source:{x:number;y:number;z:number;range:number},color:string)=> {
      const light=new PointLight(name,new Vector3(source.x,source.y,source.z),scene);
      light.diffuse=Color3.FromHexString(color);light.range=source.range;light.falloffType=Light.FALLOFF_STANDARD;
      return light;
    };
    for(const [i,source]of config.warmLights.entries()) this.warm.push(create('shelter-warm-'+i,source,config.warmColor));
    const art=new FantasyArt(scene),glow=art.flat('street-arcane-glow','#65d5ed','#65d5ed');
    for(const [i,source]of config.arcaneLights.entries()) {
      this.arcane.push(create('street-arcane-'+i,source,config.arcaneColor));
      art.cylinder('arcane-lantern-post-'+i,.12,source.y-.3,source.x,(source.y-.3)/2,source.z,art.iron,.12);
      const crystal=art.crystal('arcane-lantern-heart-'+i,.13,source.x,source.y,source.z,glow);
      crystal.metadata={artOnly:true,unlitDetail:true};
      art.ring('arcane-lantern-cage-'+i,.48,source.x,source.y-.2,source.z,.035,art.bronze);
    }
    this.update(0,0);
  }
  update(nightFactor:number,dt:number):void {
    this.time+=dt;
    this.warm.forEach((light,i)=>light.intensity=(config.warmDayIntensity+(config.warmNightIntensity-config.warmDayIntensity)*nightFactor)*(1+Math.sin(this.time*3+i)*.025));
    this.arcane.forEach(light=>light.intensity=config.arcaneDayIntensity+(config.arcaneNightIntensity-config.arcaneDayIntensity)*nightFactor);
  }
}
