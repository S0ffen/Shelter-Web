import fs from 'node:fs';
const skills=JSON.parse(fs.readFileSync('shared/skills.json','utf8'));
const rows=Object.entries(skills.branches).flatMap(([branch,perks])=>perks.map(perk=>`| ${branch.toUpperCase()} | ${perk.tier} | ${perk.name} | ${perk.maxRank} | ${perk.effect} |`)).join('\n');
const p='README.md';let s=fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');
s=s.replace('Po etapach 1–10 wdrożono wszystkie 12 części nowego milestone\'u: ekonomię wypraw, Skażenie, rozwój i bossów.', 'Po 12 etapach zgodności wdrożono kolejną poprawkę: ręczny depozyt, Psyche, większe drzewka, szybsze tempo i trudniejszego bossa.');
s=s.replace('**v11**','**v12**').replace('z v1–v10','z v1–v11');
s=s.replace('pokazuje Skażenie i Wood/Iron przy sobie','pokazuje ikonę i pasek Psyche oraz Wood/Iron przy sobie');
s=s.replace('powrót → automatyczny depozyt','powrót → E przy urządzeniu DEPOSIT');
s=s.replace('**150 s**, noc **75 s**','**180 s**, noc **90 s**');
s=s.replace('## Ekonomia i Skażenie','## Ekonomia i Psyche');
s=s.replace('Stała pojemność plecaka','Beginner / Advance Harvest: do 60 / 38');
s=s.replace('Wejście na chroniony teren bazy automatycznie deponuje tyle każdego materiału, ile mieści bank.', 'Wewnątrz Shelteru stoi metalowy depozyt, przypominający lodówkę. Podejdź, wyceluj i naciśnij **E**, aby oddać tyle każdego materiału, ile mieści bank. Samo wejście do bazy niczego nie oddaje.');
s=s.replace('Skażenie rośnie poza bazą o **1/s**, wewnątrz maleje o **4/s**. Przy 100%:', 'Psyche zaczyna od pełnego paska. Poza bazą spada o **1/s**, wewnątrz regeneruje się o **4/s**. Przy pustym pasku:');
s=s.replace('Survival III zmniejsza narastanie o 30%.', 'Endurance spowalnia utratę o 15/25/35%. W kodzie stan klątwy nadal przechowuje się jako corruption (0 = pełne Psyche, 100 = puste).');
s=s.replace('Engineer III daje 30 HP.', 'Engineer Crafting i Construction Master zwiększają skuteczność, a perki Engineer skracają cooldown.');
s=s.replace('Engineer I obniża koszty budowy i rozbudowy o 10%', 'Improve Blueprint obniża koszty budowy i rozbudowy o 5/10/15%');
const a=s.indexOf('**3 punkty na start'),b=s.indexOf('## Mapa i cel końcowy',a);
s=s.slice(0,a)+`**3 punkty na start, +1 za każdy kolejny dzień.** N otwiera menu również z pauzy. Punkty rozdzielasz w dowolnym miejscu i porze runu. Menu zatrzymuje symulację. Każda ranga kosztuje punkt. Wyższe poziomy wymagają 3/6/9 wydanych punktów w danej ścieżce, a rozwinięte mastery również poprzedniego perka na maksymalnej randze.

**33 perki, cztery poziomy na każdą ścieżkę**, z rangami i specjalizacją. Broń palną, bombardowanie i materiały pierwowzoru dostosowano do istniejącego miecza, magii i budynków.

| Ścieżka | Tier | Perk | Rangi | Efekt |
| --- | ---: | --- | ---: | --- |
${rows}

Cloak przerywa każde uderzenie oraz otrzymane obrażenia. Naprawa automatyczna wymaga bezruchu, zasięgu i zasobów banku. Zdalny transport jest ręczną akcją E po odblokowaniu perka, wymaga pełnego Wood albo Iron w plecaku. Przenoszenie wieży: V na pobliskiej wieży, następnie zwykły podgląd, LPM potwierdza; HP i cooldown pozostają.

Referencje: [gameplay City of Damned](https://www.youtube.com/watch?v=w5bPBMt6yJ4), [poradnik społeczności Nexon](https://csonline.nexon.com/Community/Strategy/View/1347?cp=1&sw=llAcceleraterll). Efekty i balans są adaptacją do tej gry.

`+s.slice(b);
s=s.replace('**Władcy Klątwy (2400 HP)**','**Władcy Klątwy (7800 HP)**');
s=s.replace('Sam wybierasz dzień wyprawy.', 'Sam wybierasz dzień wyprawy. Boss redukuje otrzymywane obrażenia o 20%, przygotowuje silny slam i oznacza ziemię przed zdalnym uderzeniem. Przywołuje Biegaczy (maks. 6), a poniżej połowy HP przyspiesza i częściej atakuje. Po 6 sekundach wycofania gracza z walki odzyskuje pełne HP — nie można go łatwo wykończyć serią krótkich wypraw. Kręgi można uniknąć przy bazowej szybkości gracza.');
s=s.replace('| N | Drzewka umiejętności |', '| N | Drzewka w dowolnym miejscu, również w pauzie |\n| E | Oddanie materiałów przy DEPOSIT |\n| 5 / 6 / 7 | Arcane Barrage / Cloak / Wrecking Team po odblokowaniu |\n| X / V | Recycle / przenoszenie wieży po odblokowaniu |');
s=s.replace('Audio jest syntezowane', 'Audio jest syntezowane');
s=s.replace('111','124').replace('40 kontroli','49 kontroli');
s=s.replace('checkpoint v11','checkpoint v12').replace('Checkpoint v11','Checkpoint v12').replace('v1–v10','v1–v11');
s += `\n## Dźwięki i tempo — poprawka z 6 października\n\nOdgłosy Wood/Iron korzystają z krótkich próbek wyciętych z dostarczonego gameplayu (00:50.47 i 00:55.81), z krótkim wygaszeniem i zachowanym tonem. Są to fragmenty zmiksowanego nagrania, nie czyste pliki z instalacji CSN. Pochodzenie: client/public/audio/README.md. Jeżeli odczyt próbki się nie uda, działa zapasowa synteza.\n\nW tle gra cicha, własna sekwencja muzyczna: spokojniejsze akordy w dzień, niższy puls i inne akordy w nocy; pauza wycisza podkład. Pełnego utworu z filmu nie kopiowano.\n\nBazowy ruch gracza 5,2 m/s (+30%). Normalny zombie 1,65 m/s, Biegacz 2,65 m/s, Tank 1,15 m/s; nocne przyspieszenie pozostaje ×1,65.\n\nZapis v12 zachowuje wszystkie rangi, powiększony plecak, aktywne osłony/Cloak, cooldowny umiejętności oraz kręgi i timery bossa. Przy przejściu z poprzedniego zapisu rozpocznij nową próbę. Raport: verification/15-feedback-final.json.\n`;
// Keep the old milestone description historical; current audio details are in the revision section.
s=s.replace('syntezowane audio','audio z próbkami i syntezą');
fs.writeFileSync(p,s);
fs.appendFileSync('.gitignore','\n.tools/\nverification/audio-reference/\n');
