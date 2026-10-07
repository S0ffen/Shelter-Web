"""Place the existing 48 IDs on streets from the reference, with room to harvest."""
import json, math, pathlib
root=pathlib.Path(__file__).resolve().parent.parent
world=json.loads((root/'shared/world.json').read_text());r=world['reference']
floor={(x,y) for y,spans in enumerate(r['walkableRows']) for a,b in spans for x in range(a,b)}
nodes=json.loads((root/'shared/resources.json').read_text());defs=json.loads((root/'shared/harvesting.json').read_text());used=[]
bosses=json.loads((root/'shared/encounters.json').read_text())
def okay(x,z,w,d):
    if -22<x<25 and -22<z<22:return False
    if any(math.hypot(x-b['position']['x'],z-b['position']['z'])<6 for key,b in bosses.items() if key!='finalArena'):return False
    px=(x-1.5)/1.2+88.5;py=217.5-(z-4)/1.2
    wx=max(w/2+.6,2.8)/1.2;dy=max(d/2+.6,2.8)/1.2
    if any((a,b) not in floor for a in range(math.floor(px-wx+.5),math.floor(px+wx+.5)+1) for b in range(math.floor(py-dy+.5),math.floor(py+dy+.5)+1)):return False
    return all(abs(x-u[0])>(w+u[2])/2+3 or abs(z-u[1])>(d+u[3])/2+3 for u in used)
waypoints=[(-26,-14),(-12,-24),(-30,12),(32,20),(-30,35),(35,38),(-46,52),(60,55),(-65,83),(75,90),(-35,98),(25,115),(65,128),(97,132),(-65,155),(5,157),(55,173),(105,173),(148,166),(140,196),(-7,210),(34,221),(75,198),(135,135),(175,154),(25,66),(55,28),(106,80),(4,133),(116,110),(2,190),(151,60),(126,38),(85,56),(161,24),(106,14)]
for idx,node in enumerate(nodes):
    spec=defs[node['type']];w,d=spec['width'],spec['depth']
    if node['id'].startswith('iron-ancient-forge-'):target=(171.3,94.6);limit=18
    elif node['id'].startswith('wood-outskirts-'):target=(-78.3,130.6);limit=18;node['rewardMultiplier']=2
    else:target=waypoints[idx%len(waypoints)];limit=32
    candidates=[]
    for dz in range(-limit,limit+1):
        for dx in range(-limit,limit+1):
            x,z=round(target[0]+dx,1),round(target[1]+dz,1)
            if okay(x,z,w,d) and not (66<x<133 and 200<z<248):candidates.append((dx*dx+dz*dz,x,z))
    if not candidates:raise ValueError(node['id'])
    _,x,z=min(candidates);node['x']=x;node['z']=z;used.append((x,z,w,d))
(root/'shared/resources.json').write_text(json.dumps(nodes,indent=2)+'\n')
print([(n['id'],n['x'],n['z']) for n in nodes[:4]])
