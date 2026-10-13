"""Place the existing 48 IDs on streets from the reference, with room to harvest."""
import json, math, pathlib
root=pathlib.Path(__file__).resolve().parent.parent
world=json.loads((root/'shared/world.json').read_text());r=world['reference']
floor={(x,y) for y,spans in enumerate(r['walkableRows']) for a,b in spans for x in range(a,b)}
nodes=json.loads((root/'shared/resources.json').read_text());defs=json.loads((root/'shared/harvesting.json').read_text());used=[]
bosses=json.loads((root/'shared/encounters.json').read_text())
base=json.loads((root/'shared/shelter.json').read_text())['bounds'];arena=bosses['finalArena']['bounds']
def okay(x,z,w,d):
    if base['minX']-3<x<base['maxX']+3 and base['minZ']-3<z<base['maxZ']+3:return False
    if any(math.hypot(x-p['x'],z-p['z'])<4 for p in world['spawnAreas']):return False
    if any(math.hypot(x-b['position']['x'],z-b['position']['z'])<6 for key,b in bosses.items() if key!='finalArena'):return False
    px=(x-r['originWorld']['x'])/r['metersPerPixel']+r['originPixel']['x'];py=r['originPixel']['y']-(z-r['originWorld']['z'])/r['metersPerPixel']
    wx=max(w/2+.6,2.1)/r['metersPerPixel'];dy=max(d/2+.6,2.1)/r['metersPerPixel']
    if any((a,b) not in floor for a in range(math.floor(px-wx+.5),math.floor(px+wx+.5)+1) for b in range(math.floor(py-dy+.5),math.floor(py+dy+.5)+1)):return False
    return all(abs(x-u[0])>(w+u[2])/2+1.8 or abs(z-u[1])>(d+u[3])/2+1.8 for u in used)
waypoints=[(-26,-14),(-12,-24),(-30,12),(32,20),(-30,35),(35,38),(-46,52),(60,55),(-65,83),(75,90),(-35,98),(25,115),(65,128),(97,132),(-65,155),(5,157),(55,173),(105,173),(148,166),(140,196),(-7,210),(34,221),(75,198),(135,135),(175,154),(25,66),(55,28),(106,80),(4,133),(116,110),(2,190),(151,60),(126,38),(85,56),(161,24),(106,14)]
for idx,node in enumerate(nodes):
    spec=defs[node['type']];w,d=spec['width'],spec['depth']
    if node['id'].startswith('iron-ancient-forge-'):target=tuple(bosses['forgeGuardian']['position'].values());limit=14
    elif node['id'].startswith('wood-outskirts-'):target=tuple(bosses['graveGuardian']['position'].values());limit=14;node['rewardMultiplier']=2
    else:
        ox,oz=waypoints[idx%len(waypoints)];target=(1.5+(ox-1.5)*r['metersPerPixel']/1.2,4+(oz-4)*r['metersPerPixel']/1.2);limit=22
    candidates=[]
    for dz in range(-limit,limit+1):
        for dx in range(-limit,limit+1):
            x,z=round(target[0]+dx,1),round(target[1]+dz,1)
            if okay(x,z,w,d) and not (arena['minX']-2<x<arena['maxX']+2 and arena['minZ']-2<z<arena['maxZ']+2):candidates.append((dx*dx+dz*dz,x,z))
    if not candidates:raise ValueError(node['id'])
    _,x,z=min(candidates);node['x']=x;node['z']=z;used.append((x,z,w,d))
(root/'shared/resources.json').write_text(json.dumps(nodes,indent=2)+'\n')
print([(n['id'],n['x'],n['z']) for n in nodes[:4]])
