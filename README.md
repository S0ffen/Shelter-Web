# Fantasy Shelter

Przeglądarkowy FPS survivalowy dark fantasy, inspirowany New Zombie Shelter. Po 12 etapach zgodności wdrożono kolejną poprawkę: ręczny depozyt, Psyche, większe drzewka, szybsze tempo i trudniejszego bossa. Gracz sam wybiera inwestycje i moment walki z bossem; nie ma dziennych questów.

Stan: [STATUS_PROJEKTU.md](STATUS_PROJEKTU.md). Wcześniejsze specyfikacje: [MVP](fantasy_shelter_mvp.md), [harvesting i eksploracja](fantasy_shelter_next_milestone.md). Poniżej aktualne zasady.

## Uruchomienie

Wymagania: Node.js 22.12+ i npm, .NET SDK 8. Otwórz dwa terminale w katalogu projektu.

```powershell
# Terminal 1
dotnet restore server/FantasyShelter.Server.csproj
dotnet run --project server/FantasyShelter.Server.csproj --no-launch-profile --urls http://127.0.0.1:5080
```

```powershell
# Terminal 2
cd client
npm install
npm run dev
```

Gra: [http://127.0.0.1:5173/](http://127.0.0.1:5173/). API: [stan serwera](http://127.0.0.1:5080/api/health). SQLite tworzy się automatycznie w `server/Data/shelter.db`. Bez API klient zapisuje w localStorage.

Graj w desktopowym Chrome/Edge z WebGL i przechwytywaniem kursora. Po zmianie serwera uruchom go ponownie. Checkpoint **v13** wymaga nowego runu przy przejściu z v1–v11; stare lokalne klucze pozostają zachowane.

## HUD i rytm runu

**Górny centralny panel** pokazuje bank Wood/Iron, Arcane Power, dzień/noc z ikoną i numerem dnia oraz wszystkie zabójstwa. Mała liczba nad materiałem to pojemność, duża to stan w Shelterze. Dla mocy mała oznacza całkowitą moc, duża wolną. Pod panelem jest timer do końca fazy.

**Dolny panel** pokazuje ikonę i pasek Psyche oraz Wood/Iron przy sobie. HP gracza i rdzenia mają osobne wskaźniki. Strzałka oraz odległość pomagają wrócić do bazy.

Wyprawa → harvesting do plecaka → powrót → E przy urządzeniu DEPOSIT → budowanie/rozwój → obrona nocna → świt → dalsza eksploracja → samodzielnie wybrana próba walki z bossem.

Dzień trwa **180 s**, noc **90 s**. Ostrzeżenia występują 60/30/10 s przed nocą. Światło i mgła zmieniają się wraz z fazą. Noc ma cztery rosnące mini-fale z krótkimi przerwami. Pierwsza liczy 8 przeciwników; kolejne rosną o 4, do 64. Limit żywych wynosi 24. Regularne zombie nocą przyspieszają ×1,65. O świcie pozostałe jednostki oblężenia wycofują się bez naliczenia zabójstw.

Każdy świt odradza wszystkie źródła i dodaje punkt rozwoju, zachowując pozostały stan runu. Co piątą noc **Blood Moon** zwiększa falę o 50%, zmienia światło na czerwone i dodaje ostrzeżenia. Dzień ma cztery patrole, uzupełniane co 20 s. Pauza zatrzymuje symulację.

## Ekonomia i Psyche

| Zapas | Pojemność początkowa | Rozszerzenie |
| --- | ---: | --- |
| Wood / Iron w Shelterze | 100 / 50 | +50 / +25 na Storehouse |
| Wood / Iron przy sobie | 30 / 20 | Beginner / Advance Harvest: do 60 / 38 |

Harvesting trafia wyłącznie do plecaka. Wewnątrz Shelteru stoi metalowy depozyt, przypominający lodówkę. Podejdź, wyceluj i naciśnij **E**, aby oddać tyle każdego materiału, ile mieści bank. Samo wejście do bazy niczego nie oddaje. Nadmiar zostaje przy graczu. Budowa, rozbudowa i naprawy korzystają wyłącznie z banku. Jeżeli pełna nagroda z uderzenia nie mieści się w plecaku, trafienie jest blokowane i materiały pozostają w źródle.

Psyche zaczyna od pełnego paska. Poza bazą spada o **1/s**, wewnątrz regeneruje się o **4/s**. Przy pustym pasku: pulsująca winieta, ruch wolniejszy o 20%, **5 HP co 3 s**. Powrót przerywa obrażenia. Endurance spowalnia utratę o 15/25/35%. W kodzie stan klątwy nadal przechowuje się jako corruption (0 = pełne Psyche, 100 = puste). Wszystkie wartości znajdują się w `shared/corruption.json`.

**Arcane jest mocą infrastruktury.** Generator dostarcza 40, wieża rezerwuje 10, magazyn 5. Nie zbierasz Arcane i nie zużywasz go przy strzałach. Zniszczenie generatora może wyłączyć wieże; odbudowa przywraca moc.

## Baza i obrona

Otwarty plac 54 × 55 m, dziedziniec 38 × 36 m, cztery bramy 8 m. Shelter: dostępne wnętrze 12 × 10 m, drzwi 4,4 m, sześć otwartych okien. **Centralny słup jest celem oblężenia**; zombie muszą do niego dotrzeć.

Budujesz wyłącznie w bazie. Generatory wymagają jednego z sześciu stanowisk. Magazyny i wieże ustawiasz swobodnie, zachowując wejścia i trasy. Nieudana budowa nie pobiera materiałów.

| Konstrukcja | Koszt Wood / Iron | HP | Efekt |
| --- | ---: | ---: | --- |
| Storehouse | 30 / 10 | 160 | +50 / +25 pojemności, 5 mocy |
| Generator Arcane | 20 / 15 | 200 | +40 mocy |
| Magic Tower | 20 / 15 | 240 | 10 mocy, zasięg 12 m, 25 obrażeń co 1,2 s |

Zombie mogą niszczyć konstrukcje. Utrata magazynu zmniejsza pojemność i usuwa zapasy ponad nowy limit. LPM w trafiony uszkodzony rdzeń/konstrukcję naprawia do 25 HP za 2 Wood + 1 Iron, zasięg 3 m, raz na 1,5 s; Engineer Crafting i Construction Master zwiększają skuteczność, a perki Engineer skracają cooldown. PPM nie naprawia.

| Poziom rdzenia | HP | Pancerz | Koszt Wood / Iron |
| --- | ---: | ---: | ---: |
| 1 | 300 | 0% | Start |
| 2 | 500 | 10% | 50 / 25 |
| 3 | 750 | 20% | 80 / 40 |

F we wnętrzu ulepsza tylko za dnia. Ulepszenie zachowuje wcześniej zadane uszkodzenia. Improve Blueprint obniża koszty budowy i rozbudowy o 5/10/15%, zaokrąglając materiały w górę.

## Combat / Survival / Engineer

**3 punkty na start, +1 za każdy kolejny dzień.** N otwiera menu również z pauzy. Punkty rozdzielasz w dowolnym miejscu i porze runu. Menu zatrzymuje symulację. Każda ranga kosztuje punkt. Wyższe poziomy wymagają 3/6/9 wydanych punktów w danej ścieżce, a rozwinięte mastery również poprzedniego perka na maksymalnej randze.

**33 perki, cztery poziomy na każdą ścieżkę**, z rangami i specjalizacją. Broń palną, bombardowanie i materiały pierwowzoru dostosowano do istniejącego miecza, magii i budynków.

| Ścieżka | Tier | Perk | Rangi | Efekt |
| --- | ---: | --- | ---: | --- |
| COMBAT | 1 | Beginner Weapon Mastery | 3 | Obrażenia miecza +8 / 16 / 24% |
| COMBAT | 1 | Battle Tempo | 3 | Szybkość ataków +5 / 10 / 15% |
| COMBAT | 1 | Health Up | 3 | Maksymalne HP +10 / 20 / 30% |
| COMBAT | 2 | Intermediate Weapon Mastery | 3 | Dalsze +10 / 20 / 30% obrażeń miecza |
| COMBAT | 2 | Combat Crafting | 1 | Wzmocnione ostrze: +15% obrażeń i +0,4 m zasięgu |
| COMBAT | 2 | Armor Enhancement | 3 | Redukcja obrażeń od wrogów o 8 / 16 / 24% |
| COMBAT | 3 | Advanced Weapon Mastery | 3 | Dalsze +15 / 30 / 45% obrażeń miecza |
| COMBAT | 3 | Combat Master | 2 | Przy niskim HP: osłona na 4 / 5 s, odnowienie 90 s |
| COMBAT | 3 | Special Weapon Mastery | 3 | Mocny atak: dodatkowe +20 / 40 / 60% obrażeń |
| COMBAT | 4 | Bombing Request · Arcane Barrage | 1 | 5: magiczny ostrzał wokół celownika, odnowienie 90 s |
| COMBAT | 4 | Stats Up | 1 | +20% HP, +15% obrażeń, +5% ruchu |
| SURVIVAL | 1 | Beginner Harvest | 3 | Plecak +5/10/15 Wood i +3/6/9 Iron; harvesting +10/20/30%; ranga 3: +1 nagrody |
| SURVIVAL | 1 | Speed Up | 3 | Ruch szybszy o 5 / 10 / 20% |
| SURVIVAL | 1 | Explorer | 3 | Wskazuje pobliskie Wood / również Iron / również zombie |
| SURVIVAL | 2 | Advance Harvest | 3 | Dodatkowa pojemność +5/10/15 Wood i +3/6/9 Iron; +1/1/2 nagrody |
| SURVIVAL | 2 | Campfire | 1 | Ognisko wewnątrz Shelteru przywraca 2 HP/s i Psyche |
| SURVIVAL | 2 | Survival Crafting | 1 | Narzędzie: +25% obrażeń źródeł i +1 m zasięgu |
| SURVIVAL | 3 | Hunter | 3 | Trafienie mieczem spowalnia przeciwnika o 10/20/30% na 2 s |
| SURVIVAL | 3 | Endurance | 3 | Psyche wyczerpuje się o 15/25/35% wolniej; regeneracja przy Psyche >50% |
| SURVIVAL | 3 | Scavenger | 3 | 10/20/30% szans na materiał do plecaka z zabitego zombie |
| SURVIVAL | 4 | Cloak | 1 | 6: ukrycie na 15 s, pierwszy cios ×2; odnowienie 90 s |
| SURVIVAL | 4 | Resource Transporting | 1 | E pozwala zdalnie oddać pełny plecak do banku Shelteru |
| ENGINEER | 1 | Auto Repair | 3 | Podczas bezruchu: pobliska infrastruktura odzyskuje 1/3/5% HP/s (2 Wood + 1 Iron/s) |
| ENGINEER | 1 | Beginner Engineer | 3 | HP konstrukcji +10/20/30%; szybsze naprawy |
| ENGINEER | 1 | Improve Blueprint | 3 | Budowa i rozbudowa tańsze o 5 / 10 / 15% |
| ENGINEER | 2 | Engineer Crafting | 1 | Młot: +30% napraw i +20% szybkości napraw |
| ENGINEER | 2 | Intermediate Engineer | 3 | Dalsze +10/20/30% HP i +5/10/15% wydajności generatorów |
| ENGINEER | 2 | Electrical Engineering | 3 | Wieże i magazyny potrzebują o 10/20/30% mniej mocy |
| ENGINEER | 3 | Recycle | 3 | X: rozbiórka trafionej konstrukcji, zwrot 25/50/75% ceny |
| ENGINEER | 3 | Expert Engineer | 3 | Dalsze +10/20/30% HP konstrukcji i obrażeń wież |
| ENGINEER | 3 | Construction Master | 3 | Szybkość wież +5/10/15%; naprawy +10/20/30% przy Psyche >50% |
| ENGINEER | 4 | Wrecking Team | 1 | 7: wybuch runy, 800 obrażeń wokół celu; odnowienie 90 s |
| ENGINEER | 4 | Turret Tower Moving | 1 | V na wieży: przenieś ją przez podgląd budowania bez opłat |

Cloak przerywa każde uderzenie oraz otrzymane obrażenia. Naprawa automatyczna wymaga bezruchu, zasięgu i zasobów banku. Zdalny transport jest ręczną akcją E po odblokowaniu perka, wymaga pełnego Wood albo Iron w plecaku. Przenoszenie wieży: V na pobliskiej wieży, następnie zwykły podgląd, LPM potwierdza; HP i cooldown pozostają.

Referencje: [gameplay City of Damned](https://www.youtube.com/watch?v=w5bPBMt6yJ4), [poradnik społeczności Nexon](https://csonline.nexon.com/Community/Strategy/View/1347?cp=1&sw=llAcceleraterll). Efekty i balans są adaptacją do tej gry.

## Mapa i cel końcowy

Miasto odtwarza dostarczony layout City of Damned. Rozmiar około **309 × 310 m**, skala 1,2 m/piksel. Kształt ulic, placów, zaułków i brył wynika z `reference-assets/layout.png`; model 3D oraz kolizje używają tej samej maski. Shelter znajduje się przy żółtym oznaczeniu na południu. 48 źródeł Wood/Iron rozmieszczono na dostępnych ulicach z miejscem na harvesting. Źródła odradzają się każdego dnia.

- Czerwony punkt w środku: **Rozszalały Kolos**, 4500 HP, 5,9 m/s, 32 obrażenia, szybki pościg i walka wręcz. Nie rzuca zaklęć ani kręgów na ziemi.
- Pomarańczowe punkty: **Strażnik Katakumb** na zachodzie (2100 HP) i **Strażnik Kuźni** na wschodzie (1800 HP). Pokonanie odblokowuje bogate źródła w ich okolicy; strażnicy nie odradzają się przy świcie.
- Niebieski punkt: **Władca Klątwy** na północnym wschodzie, 16000 HP i 20% redukcji obrażeń. Wejście zamyka cztery granice areny; bramy blokują gracza, zombie i linię strzału. Boss uderza wręcz, szarżuje z prędkością 14 m/s i zadaje 55 obrażeń przy trafieniu. Kierunek szarży jest zapamiętywany przed ruszeniem, co pozwala wykonać uskok. Przywołuje do 6 Biegaczy; poniżej połowy HP przyspiesza. Pieczęć areny chroni Psyche podczas walki. Nie resetuje HP podczas Cloak i nie ma zaklęć oznaczających ziemię.

Dowolny dzień wyprawy. Pokonanie końcowego bossa przy żywym graczu i rdzeniu daje **RUN COMPLETED**, **DAY REACHED**, **ZOMBIES KILLED**. Pozostali bossowie nie kończą runu. Śmierć gracza lub słupa oznacza przegraną.

## Sterowanie i feedback

| Klawisz | Działanie |
| --- | --- |
| WASD / mysz | Ruch / rozglądanie |
| LPM | Szybki atak 34 / 0,65 s, harvesting lub naprawa trafionego obiektu |
| PPM | Mocny atak 80 / 1,4 s; wspólny cooldown z LPM |
| B | Budowanie |
| 1 / 2 / 3 | Storehouse / Generator Arcane / Magic Tower |
| Q | Obrót podglądu o 90° |
| LPM / PPM w budowaniu | Postaw w zasięgu 6 m / anuluj |
| N | Drzewka w dowolnym miejscu, również w pauzie |
| E | Oddanie materiałów przy DEPOSIT |
| 5 / 6 / 7 | Arcane Barrage / Cloak / Wrecking Team po odblokowaniu |
| X / V | Recycle / przenoszenie wieży po odblokowaniu |
| F we wnętrzu | Rozbudowa rdzenia za dnia |
| Escape | Pauza / zamknięcie drzewek |
| R | Nowa próba |

Utrata fokusu zatrzymuje grę. Nie ma jeszcze skoku/sprintu. Trafienia mają hit marker, flash, audio i wstrząs kamery przy mocnym ataku. Harvesting: drzazgi/iskry, floating text i mocniejszy rozpad. Wieże: magiczne pociski, trail, audio i efekty trafienia. Rdzeń reaguje w HUD; niskie HP wywołuje **SHELTER CRITICAL**.

## Zapis i architektura

Checkpoint **v13** zachowuje bank/plecak, Skażenie, perki, HP konstrukcji, źródła, zombie i przygotowanie ataków bossów, dzień/noc, cooldowny, pociski, losowość, strażników i wynik active/won/lost. Autosave: rozpoczęcie/wznowienie, 20 s, pauza, świt, perki, strażnik i zakończenie. Jest jeden slot; zakończony run zapisuje stan terminalny i nie wraca do życia po odświeżeniu. Historia obejmuje zwycięstwa i przegrane.

ASP.NET Core 8 + SQLite waliduje i przechowuje zapis. Schemat **v2** automatycznie dodaje Outcome do wyników i zachowuje wcześniejsze dane. Symulacja pozostaje w kliencie. Multiplayer i autorytatywna symulacja są dalszym etapem. Szczegóły: [server/README.md](server/README.md).

TypeScript + Babylon.js + Vite, HUD HTML/CSS, bez Reacta. Domena oddzielona od renderera. Symulacja 30 Hz, decyzje AI i dobór celu wież 5 Hz. Nawigacja uwzględnia aktualne przeszkody. Modele pozostają prototypowe; współdzielone tekstury proceduralne 512 px mają mapy normalnych i cienie. Audio łączy próbkę zbierania z efektami walki i komunikatów Web Audio; ambient i muzyka są wyłączone.

| Pliki w shared/ | Parametry |
| --- | --- |
| survival.json | Fazy, ostrzeżenia, mini-fale, patrole |
| economy.json / corruption.json | Pojemności i Skażenie |
| skills.json / buildings.json | Perki, receptury i HP |
| world.json / resources.json | Mapa, dzielnice, źródła |
| harvesting.json / combat.json | Nagrody i ataki |
| shelter.json / defense.json | Baza, stanowiska, moc, naprawy |
| zombies.json / encounters.json | Zombie, bossowie i ataki |
| night-modifiers.json / checkpoint.json | Specjalne noce i wersja zapisu |

## Weryfikacja

W katalogu głównym, PowerShell 7:

```powershell
pwsh -NoProfile -File scripts/Verify-Milestone.ps1 -Stage manual-check
```

Skrypt uruchamia testy klienta, build klienta, build serwera i test HTTP/SQLite. Kompiluje do osobnego `verification/server`, więc nie koliduje z działającą grą. Logi i raporty trafiają do `verification/`. Testy serwera używają osobnej bazy w `server/test-results/` na porcie 5081; nie zmieniają bazy gry. Migracja testowa wymaga Node z `node:sqlite` (zweryfikowano Node 24).

**136 testów klienta i 55 kontroli serwera przechodzi.** Wszystkie 12 etapów mają osobne raporty. Sprawdzono depozyty, limity, Skażenie, świt, fale, perki, moce, zniszczenia/naprawy, strażników, zwycięstwo, walidację checkpointu i migrację SQLite. Testy audio sprawdzają ciszę w tle, odtwarzanie sygnału zdobycia materiału i brak syntetycznego zamiennika przy błędzie. Vite ostrzega o rozmiarze pakietu Babylon.js.

[Podgląd deweloperski](http://127.0.0.1:5173/tests/visual/preview.html) pozwala sprawdzać scenariusze bez pointer lock. Zegar przesuwają przyciski; skróty i finansowanie dotyczą wyłącznie testu, który nie trafia do produkcyjnego dist. Sprawdzono HUD w wąskim i desktopowym układzie, harvesting/depozyt, drzewka, Skażenie, Blood Moon, bossów i zwycięstwo.

## Dźwięki i tempo — poprawka z 6 października

Przy zbieraniu Wood/Iron odtwarzany jest wyłącznie oryginalny sygnał zdobycia materiału `zsh_resouceget.wav` z instalacji CSNZ gracza. Uderzenia w źródła są bez dźwięku. Próbka jest identyczna bajtowo z wpisem w `cstrike.nar`, bez obróbki i syntetycznych zamienników. Pochodzenie i odczyt archiwum: `client/public/audio/README.md`. Poprawka audio nie zmienia checkpointu v13; raport: `verification/19-resource-cue-only.json`.
Na prośbę gracza całkowicie usunięto ambient i muzykę w tle. Pozostają jednorazowe efekty gry.

Bazowy ruch gracza 5,2 m/s (+30%). Normalny zombie 1,65 m/s, Biegacz 2,65 m/s, Tank 1,15 m/s; nocne przyspieszenie pozostaje ×1,65.

Zapis v13 zachowuje rozwój, plecak, osłony/Cloak, cooldowny, cztery flagi bossów, stan zamkniętej areny i przygotowanie/trwanie szarży. Mapa i zapis zmieniły się — rozpocznij nową próbę. Starsze dane zachowano; przed uruchomieniem wersji utworzono kopię SQLite. Raport: `verification/18-reference-map.json`.
