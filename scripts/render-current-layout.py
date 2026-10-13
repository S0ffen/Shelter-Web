"""Draw the current static map from the same shared data used by the game."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ROOT=Path(__file__).resolve().parent.parent
load=lambda name: json.loads((ROOT/'shared'/name).read_text(encoding='utf-8'))
w=load('world.json'); a=load('map-adjustments.json'); s=load('shelter.json'); e=load('encounters.json')
r=w['reference']; SCALE=3; LEFT=24; TOP=104
font=lambda size,bold=False: ImageFont.truetype('C:/Windows/Fonts/'+('segoeuib.ttf' if bold else 'segoeui.ttf'),size)
canvas=Image.new('RGB',(1180,960),'#111817'); draw=ImageDraw.Draw(canvas)
draw.text((24,20),'FANTASY SHELTER',font=font(30,True),fill='#edf1e8')
draw.text((24,60),'Aktualny layout • rzut z góry • 9 października 2026',font=font(19),fill='#abb8ad')
mask=Image.new('L',(r['width'],r['height']),0); md=ImageDraw.Draw(mask)
for y,spans in enumerate(r['walkableRows']):
 for start,end in spans: md.line((start,y,end-1,y),fill=255)
p=a['westernCourt']['pixels']; md.rectangle((p['left'],p['top'],p['right']-1,p['bottom']-1),fill=255)
for py in range(r['height']):
 for px in range(r['width']):
  xx=r['originWorld']['x']+(px-r['originPixel']['x'])*r['metersPerPixel']
  zz=r['originWorld']['z']+(r['originPixel']['y']-py)*r['metersPerPixel']
  if any(zone['minX']<xx<zone['maxX'] and zone['minZ']<zz<zone['maxZ'] for zone in s['buildZones']):mask.putpixel((px,py),255)
mask=mask.resize((r['width']*SCALE,r['height']*SCALE),Image.Resampling.NEAREST)
map_image=Image.new('RGB',mask.size,'#232a28'); map_image.paste('#626b67',mask=mask)
from PIL import ImageChops
edge=ImageChops.subtract(mask.filter(ImageFilter.MaxFilter(3)),mask.filter(ImageFilter.MinFilter(3)))
map_image.paste('#a1aaa2',mask=edge)
canvas.paste(map_image,(LEFT,TOP)); draw=ImageDraw.Draw(canvas,'RGBA')

def point(x,z):
 return (LEFT+((x-r['originWorld']['x'])/r['metersPerPixel']+r['originPixel']['x']+.5)*SCALE,
         TOP+(r['originPixel']['y']-(z-r['originWorld']['z'])/r['metersPerPixel']+.5)*SCALE)
def footprint(x,z,width,depth,fill,outline=None,line=2):
 x0,y0=point(x-width/2,z+depth/2); x1,y1=point(x+width/2,z-depth/2)
 draw.rectangle((x0,y0,x1,y1),fill=fill,outline=outline,width=line)
def bounds(b,fill,outline,line=2):
 footprint((b['minX']+b['maxX'])/2,(b['minZ']+b['maxZ'])/2,b['maxX']-b['minX'],b['maxZ']-b['minZ'],fill,outline,line)
# Open construction area and the actual hall footprint.
base_mask=Image.new('L',canvas.size,0); base_draw=ImageDraw.Draw(base_mask)
for zone in s['buildZones']:
 x0,y0=point(zone['minX'],zone['maxZ']);x1,y1=point(zone['maxX'],zone['minZ'])
 base_draw.rectangle((x0,y0,x1,y1),fill=255)
overlay=Image.new('RGBA',canvas.size,(219,181,76,0));overlay.putalpha(base_mask.point(lambda value:value*25//255))
canvas=Image.alpha_composite(canvas.convert('RGBA'),overlay).convert('RGB')
canvas.paste('#dfba61',mask=ImageChops.subtract(base_mask,base_mask.filter(ImageFilter.MinFilter(5))))
draw=ImageDraw.Draw(canvas,'RGBA')
h=s['hall']; footprint(h['x'],h['z'],h['width'],h['depth'],'#c2a35c','#f4d278',2)
for side in [-1,1]:
 px,py=point(h['x'],h['z']+side*h['depth']/2)
 half=h['doorWidth']/r['metersPerPixel']*SCALE/2
 draw.line((px-half,py,px+half,py),fill='#626b67',width=4)
for pad in s['generatorPads']:footprint(pad['x'],pad['z'],2.4,2.4,None,'#e0cb98',2)
c=s['core']; footprint(c['x'],c['z'],c['width'],c['depth'],'#fcf1b6')
# The arena exists permanently, four meters below street level.
bounds(e['finalArena']['bounds'],(61,167,214,45),'#56b8ea',3)
for spec in a['barricades']:
 px=spec['referenceCenter']['x']; py=spec['referenceCenter']['y']
 x=r['originWorld']['x']+(px-r['originPixel']['x'])*r['metersPerPixel']
 z=r['originWorld']['z']+(r['originPixel']['y']-py)*r['metersPerPixel']
 footprint(x,z,spec['width'],spec['depth'],'#d86e8f','#f3aec5',2)
# Extra western fighting room authorized in map-adjustments.json.
x0=LEFT+p['left']*SCALE; y0=TOP+p['top']*SCALE; x1=LEFT+p['right']*SCALE; y1=TOP+p['bottom']*SCALE
draw.rectangle((x0,y0,x1,y1),outline='#86bca0',width=2)
markers=[('ravager','1','#ee5b50'),('graveGuardian','2','#f6a25a'),('forgeGuardian','3','#f6a25a'),('finalBoss','4','#58bce9')]
for key,label,color in markers:
 pos=e[key]['position']; px,py=point(pos['x'],pos['z'])
 draw.ellipse((px-12,py-12,px+12,py+12),fill=color,outline='#111817',width=2)
 draw.text((px,py-1),label,font=font(16,True),fill='#111817',anchor='mm')
# Legend avoids covering any part of the level.
x=830; y=115
draw.text((x,y),'LEGENDA',font=font(22,True),fill='#edf1e8');y+=52
rows=[('#626b67','Ulice / dostępny teren'),('#232a28','Zabudowa / obszar zamknięty'),('#dfba61','Teren budowy Shelteru'),('#c2a35c','Budynek Shelteru'),('#e0cb98','Stanowiska generatorów'),('#d86e8f','Dwie stałe barykady'),('#86bca0','Poszerzona zachodnia alejka'),('#58bce9','Arena końcowa — pit −4 m')]
for color,label in rows:
 draw.rectangle((x,y+4,x+15,y+19),fill=color)
 draw.text((x+28,y),label,font=font(17),fill='#d2dbd2');y+=38
y+=30;draw.text((x,y),'BOSSOWIE',font=font(22,True),fill='#edf1e8');y+=46
for color,label in [('#ee5b50','1   Rozszalały Kolos'),('#f6a25a','2   Strażnik Katakumb'),('#f6a25a','3   Strażnik Kuźni'),('#58bce9','4   Władca Klątwy')]:
 draw.text((x,y),label,font=font(18),fill=color);y+=36
y+=30
for text in ['Mapa: około 182 × 182 m','Shelter: nieregularny obrys','Północ u góry','', 'Układ statyczny z konfiguracji gry.', 'Bez budowli ustawionych w runie.']:
 draw.text((x,y),text,font=font(15),fill='#a5b4a9');y+=27
# Physical scale.
x0,y0=point(-52,-18); line=20/r['metersPerPixel']*SCALE
draw.line((x0,y0,x0+line,y0),fill='#edf1e8',width=3)
for px in [x0,x0+line]:draw.line((px,y0-4,px,y0+4),fill='#edf1e8',width=2)
draw.text((x0+line/2,y0-20),'20 m',font=font(15),fill='#edf1e8',anchor='mm')
draw.text((24,902),'Źródło: shared/world.json + map-adjustments.json + shelter.json + encounters.json',font=font(17),fill='#a5b4a9')
output=ROOT/'reference-assets/current-layout.png';canvas.save(output)
print(output)
