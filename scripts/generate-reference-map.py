"""Convert the supplied layout into shared, exact raster-derived city geometry."""
import json
import math
import pathlib
from collections import deque
from PIL import Image

root = pathlib.Path(__file__).resolve().parent.parent
image = Image.open(root / 'reference-assets/layout.png').convert('RGB')
width, height = image.size
scale, origin_x, origin_y = 1.2, 88.5, 217.5

def position(x, y):
    return {'x': round(1.5 + (x-origin_x)*scale, 3), 'z': round(4 + (origin_y-y)*scale, 3)}

def is_floor(color):
    r, g, b = color
    return (40 <= r <= 105 and abs(r-g)<5 and abs(g-b)<5) or (r>50 and r>g and b<g*.7)

walk = [[is_floor(image.getpixel((x,y))) for x in range(width)] for y in range(height)]
# The gold rectangle is the Shelter marker, including its outline, not a city wall.
for y in range(212,224):
    for x in range(78,100): walk[y][x]=True
outside = set()
queue = deque([(0,0)])
while queue:
    x,y = queue.popleft()
    if (x,y) in outside or x<0 or y<0 or x>=width or y>=height or walk[y][x]: continue
    outside.add((x,y))
    queue.extend(((x-1,y),(x+1,y),(x,y-1),(x,y+1)))

def rectangles(mask):
    active, result = {}, []
    for y,row in enumerate(mask+[[]]):
        runs = []
        x=0
        while x<len(row):
            if not row[x]: x+=1; continue
            start=x
            while x<len(row) and row[x]: x+=1
            runs.append((start,x))
        next_active={}
        for span in runs:
            next_active[span]=active.pop(span,(y,0))
            start,length=next_active[span]
            next_active[span]=(start,length+1)
        for (left,right),(top,depth) in active.items():
            result.append((left,top,right-left,depth))
        active=next_active
    return result

def footprint(rect, wall_height=None):
    x,y,w,h=rect
    output={**position(x+(w-1)/2,y+(h-1)/2),'width':round(w*scale,3),'depth':round(h*scale,3)}
    if wall_height is not None: output['height']=wall_height
    return output

rows=[]
for row in walk:
    spans=[]; x=0
    while x<width:
        if not row[x]: x+=1; continue
        start=x
        while x<width and row[x]: x+=1
        spans.append([start,x])
    rows.append(spans)
interior=[[not walk[y][x] and (x,y) not in outside for x in range(width)] for y in range(height)]
external=[[not walk[y][x] and (x,y) in outside for x in range(width)] for y in range(height)]
markers={'ravager':(128,125),'graveGuardian':(22,112),'forgeGuardian':(230,142),'finalBoss':(173,34)}
for marker,point in markers.items():
    if not walk[point[1]][point[0]]: raise ValueError('Marker is not walkable: '+marker)
arena_center=position(170,34)
areas={
    'ancientForge': {'name':'Ancient Forge',**position(230,142),'width':20,'depth':30,'risk':3},
    'graveyard': {'name':'Catacomb Gate',**position(22,112),'width':16,'depth':32,'risk':3},
    'centralSquare': {'name':'Plac Kolosa',**position(128,125),'width':48,'depth':54,'risk':3},
    'finalArena': {'name':'Citadel of the Curse',**arena_center,'width':62.4,'depth':43.2,'risk':3},
}
patrol_pixels=[(45,193),(109,186),(114,145),(62,131),(23,147),(69,78),(133,78),(202,100),(229,170),(180,193),(100,42)]
world={
    'bounds': {'minX':-106,'maxX':203,'minZ':-43,'maxZ':267},
    'reference':{'width':width,'height':height,'metersPerPixel':scale,'originPixel':{'x':origin_x,'y':origin_y},'originWorld':{'x':1.5,'z':4},'source':'reference-assets/layout.png','walkableRows':rows},
    'areas':areas,
    'floorTiles':[footprint(rect) for rect in rectangles(walk)],
    'solidLots':[footprint(rect,7.2) for rect in rectangles(interior)],
    'boundaryLots':[footprint(rect,7.2) for rect in rectangles(external)],
    'patrolAreas':[position(*p) for p in patrol_pixels if walk[p[1]][p[0]]],
    'spawnAreas':[{'x':-29,'z':27},{'x':-24,'z':-15},{'x':23,'z':-17},{'x':27,'z':25},{'x':14,'z':27}],
}
(root/'shared/world.json').write_text(json.dumps(world,indent=2)+'\n',encoding='utf-8')
encounters=json.loads((root/'shared/encounters.json').read_text())
encounters['forgeGuardian']['position']=position(*markers['forgeGuardian'])
encounters['graveGuardian']={**encounters['forgeGuardian'],'kind':'warden','position':position(*markers['graveGuardian'])}
encounters['ravager']={'kind':'ravager','position':position(*markers['ravager']),'triggerDistance':48,'aggroRange':44,'leashRange':76,'attackRange':2.8,'windup':.25,'slamRadius':0}
encounters['finalBoss'].update({'position':position(*markers['finalBoss']),'triggerDistance':90,'aggroRange':90,'leashRange':90,'chargeInterval':8,'chargeWindup':.8,'chargeDuration':1.0,'chargeSpeed':14,'chargeDamage':55})
encounters['finalArena']={'bounds':{'minX':round(arena_center['x']-31.2,3),'maxX':round(arena_center['x']+31.2,3),'minZ':round(arena_center['z']-21.6,3),'maxZ':round(arena_center['z']+21.6,3)},'gateHeight':6,'gateThickness':.65,'entryInset':1.5,'protectsPsyche':True}
(root/'shared/encounters.json').write_text(json.dumps(encounters,indent=2)+'\n',encoding='utf-8')
report={'floorCells':sum(map(sum,walk)),'floorRectangles':len(world['floorTiles']),'solidRectangles':len(world['solidLots']),'boundaryRectangles':len(world['boundaryLots']),'markers':{k:position(*v) for k,v in markers.items()}}
(root/'verification/reference-layout.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
