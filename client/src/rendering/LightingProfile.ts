import config from '../../../shared/lighting.json';
import { Color3 } from './babylon';
import type { SurvivalCycle } from '../domain/SurvivalCycle';
export const LIGHTING_SETTINGS = config;
type Phase = typeof config.day;
export interface LightingProfile {
  ambient: number; sun: number; fog: number; contrast: number; shadowDarkness: number; nightFactor: number;
  sky: Color3; ambientColor: Color3; groundColor: Color3; sunColor: Color3;
}
function phase(source: Phase, nightFactor: number): LightingProfile {
  return { ...source, nightFactor, sky: Color3.FromHexString(source.sky), ambientColor: Color3.FromHexString(source.ambientColor),
    groundColor: Color3.FromHexString(source.groundColor), sunColor: Color3.FromHexString(source.sunColor) };
}
export function blendLighting(a: LightingProfile, b: LightingProfile, amount: number): LightingProfile {
  const t=Math.max(0,Math.min(1,amount)),mix=(x:number,y:number)=>x+(y-x)*t;
  return { ambient:mix(a.ambient,b.ambient),sun:mix(a.sun,b.sun),fog:mix(a.fog,b.fog),contrast:mix(a.contrast,b.contrast),
    shadowDarkness:mix(a.shadowDarkness,b.shadowDarkness),nightFactor:mix(a.nightFactor,b.nightFactor),
    sky:Color3.Lerp(a.sky,b.sky,t),ambientColor:Color3.Lerp(a.ambientColor,b.ambientColor,t),groundColor:Color3.Lerp(a.groundColor,b.groundColor,t),sunColor:Color3.Lerp(a.sunColor,b.sunColor,t) };
}
export function lightingTarget(cycle: SurvivalCycle): LightingProfile {
  const day=phase(config.day,0), dusk=phase(config.dusk,.65), night=phase(config.night,1);
  let result: LightingProfile;
  if(cycle.state.period==='night') result=blendLighting(dusk,night,cycle.state.periodElapsed/config.nightTransitionDuration);
  else if(cycle.state.day>1 && cycle.state.periodElapsed<config.dawnDuration) result=blendLighting(night,day,cycle.state.periodElapsed/config.dawnDuration);
  else result=blendLighting(day,dusk,1-cycle.secondsRemaining/Math.min(config.duskDuration,cycle.settings.dayDuration/2));
  if(cycle.modifier) {
    result.sky=Color3.Lerp(result.sky,Color3.FromHexString(cycle.modifier.skyColor),result.nightFactor*.8);
    result.sunColor=Color3.Lerp(result.sunColor,Color3.FromHexString(cycle.modifier.lightColor),result.nightFactor);
  }
  return result;
}
