# Fantasy Shelter

Przeglądarkowy FPS survivalowy dark fantasy, inspirowany New Zombie Shelter. Aktualna wersja obejmuje rozbudowę bazy, depozyt i plecak, Psyche, rozwój postaci, cykl dnia/nocy, hordy, minibossów i finałowy pit. Trzej podstawowi przeciwnicy mają teksturowane modele oraz chód, bieg i atak. Gra ma angielski HUD, muzykę dnia/nocy, checkpoint v17 i tryb uruchamiania w LAN. Gracz sam wybiera inwestycje i moment walki z bossem; nie ma dziennych questów.

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

Graj w desktopowym Chrome/Edge z WebGL i przechwytywaniem kursora. Po zmianie serwera uruchom go ponownie. Checkpoint **v17** migruje zapisy v14/v15/v16 bez resetu postępu. Zapisy v1–v13 wymagają nowej próby; stare lokalne klucze pozostają zachowane.

## Pokazanie gry w sieci lokalnej (LAN)

Na komputerze hosta uruchom backend jak wyżej (port 5080 pozostaje lokalny). W drugim terminalu, w katalogu `client`, uruchom:

```powershell
npm run dev:lan
```

Jeśli działa już `npm run dev`, zatrzymaj ten terminal przez Ctrl+C przed uruchomieniem wersji LAN. Vite wypisze adres `Network`, np. **http://192.168.1.143:5173/**. Drugi komputer musi być w tej samej sieci; otwórz na nim adres IP hosta, a nie `localhost`. Przy zwykłym lokalnym uruchomieniu na hoście nadal działa **http://127.0.0.1:5173/**.

Klient wysyła żądania `/api` pod adres strony, a Vite przekazuje je do `127.0.0.1:5080` na hoście. Dzięki temu drugi komputer nie próbuje łączyć się ze swoim localhostem. Nie trzeba udostępniać portu 5080 ani zmieniać CORS. Własny adres API nadal można ustawić przez `VITE_API_URL`.

Windows może poprosić o dostęp Node.js do sieci prywatnej. Jeżeli lokalny adres IP działa na hoście, a drugi komputer nadal nie łączy się, sprawdź zaporę dla TCP 5173 oraz izolację urządzeń w sieci gościnnej. Nie wyłączaj całej zapory.

To pokaz wersji solo: symulacje graczy nie są synchronizowane, a backend ma jeden wspólny slot checkpointu. Do pokazów bez nadpisywania własnego runu można pozostawić backend wyłączony; zapis będzie wtedy w przeglądarce gościa.

Opcjonalnie po `npm run build` komenda `npm run preview:lan` udostępnia gotowy build na porcie **4173**, również z proxy API.

## Zawartość repozytorium

W Git są kod klienta i serwera, wspólne konfiguracje, testy, używane assety pod `client/`, plan mapy oraz utrzymywane narzędzia opisane w `scripts/README.md`. Pobraną kopię projektu można zbudować bez instalacji CSNZ i bez katalogu surowych plików `models/`.

Lokalne pobrania modeli i materiałów 4K (`models/`), duplikaty soundtracków (`music/`), surowe atlasy PNG, wyciągnięte pliki Nexona, raporty, screenshoty, checkpointy i skompilowany serwer w `verification/` są ignorowane. Dwa używane efekty Nexona pozostają w `client/src/assets/audio/`. Muzyka, modele i gotowe tekstury są w `client/public/`.

`Scripts` nie jest ignorowany w całości: Git dopuszcza tylko listę utrzymywanych narzędzi testowania i przygotowania assetów/mapy. Jednorazowe czytniki archiwów i eksperymenty z ekstrakcją audio mogą pozostać lokalnie poza Git. Wzmianki o historycznych raportach `verification/...` poniżej odnoszą się do lokalnych materiałów diagnostycznych, nie do plików wymaganych przez grę.

## HUD i rytm runu

**Górny centralny panel** pokazuje bank Wood/Iron, Arcane Power, dzień/noc z ikoną i numerem dnia oraz wszystkie zabójstwa. Mała liczba nad materiałem to pojemność, duża to stan w Shelterze. Dla mocy mała oznacza całkowitą moc, duża wolną. Pod panelem jest timer do końca fazy.

**Dolny panel** pokazuje ikonę i pasek Psyche oraz Wood/Iron przy sobie. HP gracza i rdzenia mają osobne wskaźniki. Strzałka oraz odległość pomagają wrócić do bazy.

Wyprawa → harvesting do plecaka → powrót → menu DEPOSIT (wybór ilości) → budowanie/rozwój → obrona nocna → świt → dalsza eksploracja → samodzielnie wybrana próba walki z bossem.

Dzień trwa **180 s**, noc **90 s**. Ostrzeżenia występują 60/30/10 s przed nocą. Światło i mgła zmieniają się wraz z fazą. Noc ma cztery rosnące mini-fale z krótkimi przerwami. Pierwsza noc liczy 24 nowe zombie w grupach 3 / 5 / 7 / 9; kolejne noce rosną o 8, do 128. Limit żywych regularnych przeciwników wynosi 48, spawny mają minimalny interwał 0,55 s. Ocalali z poprzedniej fazy nie pomniejszają nowej hordy; limit żywych wstrzymuje kolejkę. Regularne zombie nocą przyspieszają ×1,65. O świcie żywe zombie pozostają na mapie, zachowują HP i nadal atakują. Przestaje działać nocne przyspieszenie; znika tylko kolejka niewysłanych przeciwników.

Każdy świt odradza wszystkie źródła i dodaje punkt rozwoju, zachowując pozostały stan runu. Co piątą noc **Blood Moon** zwiększa falę o 50%, zmienia światło na czerwone i dodaje ostrzeżenia. Dzień ma cztery patrole, uzupełniane co 20 s. Pauza zatrzymuje symulację.

## Ekonomia i Psyche

| Zapas | Pojemność początkowa | Rozszerzenie |
| --- | ---: | --- |
| Wood / Iron w Shelterze | 100 / 50 | +50 / +25 na Storehouse |
| Wood / Iron przy sobie | 30 / 20 | Beginner / Advance Harvest: do 60 / 38 |

Harvesting trafia wyłącznie do plecaka. W narożniku Shelteru stoi szafa DEPOSIT. Podejdź, wyceluj i naciśnij **E**, aby otworzyć menu oddawania i pobierania: po 1/5 sztuk, własna ilość lub oddaj wszystko. Samo wejście do bazy niczego nie przenosi; nadmiar pozostaje u źródła transferu. Budowa, rozbudowa i naprawy korzystają najpierw z plecaka, a brakującą ilość pobierają z banku. Jeżeli pełna nagroda z uderzenia nie mieści się w plecaku, trafienie jest blokowane i materiały pozostają w źródle.

Psyche zaczyna od pełnego paska. Poza bazą spada o **1/s**, wewnątrz regeneruje się o **4/s**. Przy pustym pasku: pulsująca winieta, ruch wolniejszy o 20%, **5 HP co 3 s**. Powrót przerywa obrażenia. Endurance spowalnia utratę o 15/25/35%. W kodzie stan klątwy nadal przechowuje się jako corruption (0 = pełne Psyche, 100 = puste). Wszystkie wartości znajdują się w `shared/corruption.json`.

**Arcane jest mocą infrastruktury.** Każdy generator ma własny poziom i dostarcza 10 / 15 / 25 / 130 mocy. Wyceluj w niego i naciśnij **F**, aby kupić następny poziom; wymaga odpowiedniego tieru Shelteru. Rozbudowa rdzenia odblokowuje możliwość ulepszenia generatorów. Wieża rezerwuje 12, magazyn 10, a rdzeń 0 / 15 / 20 / 30 według poziomu. Rdzeń i magazyny mają pierwszeństwo przed wieżami. Arcane nie jest zbieranym ani jednorazowo spalanym zasobem; utrata generatora może wyłączyć wieże.

## Baza i obrona

Teren Shelteru ma **nieregularny obrys zgodny z żółtym zrzutem gracza**: większy plac główny, zachodnie poszerzenie i dolny pas. Otacza go wyraźna złotożółta linia na ziemi. Trzy strefy mają wspólne zasady budowania i ochrony Psyche; wewnętrzne łączenia nie ograniczają budowli. Całość mieści się w 62,05 × 39,4 m, ale wycięte narożniki pozostają poza bazą. Teren jest otwarty, bez niskich murków. Budynek ma **12,6 × 7,9 m**, dwa przeciwległe wejścia po 3,2 m i sześć otwartych okien. Jego proporcje wynikają z oryginalnego brushu `shelter_check1` w `zsh_deadcity_pve.bsp`. **Centralny słup jest celem oblężenia**; zombie muszą do niego dotrzeć.

Śmierć gracza nie kończy próby. Kamera pokazuje Shelter z góry; po **5 s** gracz odradza się w budynku z pełnym HP i Psyche oraz **3 s** ochrony i wraca do widoku pierwszej osoby. Traci materiały w plecaku, zachowuje bank, budynki, rozwój i stan dnia. Zombie i wieże działają podczas odliczania. **Przegrana następuje dopiero po zniszczeniu rdzenia.** Śmierć w końcowej arenie przerywa tę próbę walki; kolejna zaczyna się z pełnym HP bossa. Timery są konfigurowane w `shared/player.json`.

Budujesz wyłącznie w bazie. Generatory wymagają jednego z sześciu stanowisk. Magazyny i wieże ustawiasz swobodnie, zachowując wejścia i trasy. Nieudana budowa nie pobiera materiałów.

| Konstrukcja | Koszt Wood / Iron | HP | Moc / efekt |
| --- | ---: | ---: | --- |
| Storehouse | 12 / 6 | 1250 | Rezerwuje 10, +50 / +25 pojemności |
| Generator Arcane I | 5 / 5 | 1000 | Dostarcza 10 |
| Generator Arcane II | 9 / 9 | 1500 | Dostarcza 15 |
| Generator Arcane III | 15 / 13 | 2000 | Dostarcza 25 |
| Generator Arcane IV | 20 / 22 | 2500 | Dostarcza 130 |
| Magic Tower | 6 / 6 | 550 | Rezerwuje 12; zasięg 12 m, 25 obrażeń co 1,2 s |

Koszt wyższego poziomu generatora to pełny koszt kolejnego ulepszenia, przed rabatem Engineer. HP, materiały i Power istniejących konstrukcji pochodzą z odzyskanych tabel i tooltipów CSNZ. Atak magicznej wieży, pojemność magazynów, naprawy, pancerz rdzenia i uproszczone odblokowania technologii pozostają naszym dostosowaniem.

Zombie mogą niszczyć konstrukcje. Utrata magazynu zmniejsza pojemność i usuwa zapasy ponad nowy limit. LPM w trafiony uszkodzony rdzeń/konstrukcję naprawia do 60 HP za 2 Wood + 1 Iron, zasięg 3 m, raz na 1,5 s; Engineer Crafting i Construction Master zwiększają skuteczność, a perki Engineer skracają cooldown. PPM nie naprawia.

| Poziom rdzenia | HP | Pancerz | Koszt Wood / Iron | Rezerwacja Power |
| --- | ---: | ---: | ---: | ---: |
| 1 | 1250 | 0% | Start | 0 |
| 2 | 2100 | 10% | 40 / 35 | 15 |
| 3 | 2750 | 20% | 70 / 70 | 20 |
| 4 | 3300 | 30% | 125 / 125 | 30 |

F we wnętrzu ulepsza rdzeń tylko za dnia; F na trafionym generatorze ulepsza ten generator. Ulepszenie wymaga materiałów, a rdzeń także wolnej mocy na zwiększoną rezerwację. Brak materiałów lub mocy nie powoduje częściowej zapłaty. Ulepszenie zachowuje wcześniej zadane uszkodzenia. Improve Blueprint obniża koszty budowy i rozbudowy o 5/10/15%, zaokrąglając materiały w górę.

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

Miasto odtwarza dostarczony layout City of Damned. Rozmiar około **182 × 182 m**, skala 0,7 m/piksel: odległości skrócono o około 42%. Kształt ulic, placów, zaułków i brył wynika z `reference-assets/layout.png`; model 3D oraz kolizje używają tej samej maski. Shelter znajduje się przy żółtym oznaczeniu na południu. 48 źródeł Wood/Iron rozmieszczono na dostępnych ulicach z miejscem na harvesting. Źródła odradzają się każdego dnia. Analiza oryginalnej mapy: `verification/csnz-map/README.md`.

- Czerwony punkt w środku: **Rozszalały Kolos**, 4500 HP, 5,9 m/s, 32 obrażenia, szybki pościg i walka wręcz. Nie rzuca zaklęć ani kręgów na ziemi. Aggro 18 m, limit pościgu 8 s i maksymalne oddalenie celu 26 m od placu. Po utracie celu lub wyczerpaniu czasu wraca na plac i leczy się; ponowny atak odblokowuje po powrocie i oddaleniu się gracza poza 18 m.
- Pomarańczowe punkty: **Strażnik Katakumb** na zachodzie (2100 HP) i **Strażnik Kuźni** na wschodzie (1800 HP). Pokonanie odblokowuje bogate źródła w ich okolicy; strażnicy nie odradzają się przy świcie.
- Niebieski punkt: **Władca Klątwy** na północnym wschodzie, 16000 HP i 20% redukcji obrażeń. Arena jest pitem 4 m poniżej ulicy. Wskakujesz z krawędzi (Spacja); zwykły skok nie sięga z dna na ulicę. Stałe kamienne ściany istnieją od początku runu. Boss budzi się dopiero po wylądowaniu na dnie. Boss uderza wręcz, szarżuje z prędkością 14 m/s i zadaje 55 obrażeń przy trafieniu. Kierunek szarży jest zapamiętywany przed ruszeniem, co pozwala wykonać uskok. Przywołuje do 6 Biegaczy; poniżej połowy HP przyspiesza. Pieczęć areny chroni Psyche podczas walki. Nie resetuje HP podczas Cloak i nie ma zaklęć oznaczających ziemię.

Dowolny dzień wyprawy. Pokonanie końcowego bossa przy żywym graczu i rdzeniu daje **RUN COMPLETED**, **DAY REACHED**, **ZOMBIES KILLED**. Pozostali bossowie nie kończą runu. Zniszczenie słupa oznacza przegraną; śmierć gracza uruchamia odrodzenie.

## Sterowanie i feedback

| Klawisz | Działanie |
| --- | --- |
| WASD / mysz | Ruch / rozglądanie |
| Spacja | Skok; wejście do pita z krawędzi |
| LPM | Szybki atak 34 / 0,65 s, harvesting lub naprawa trafionego obiektu |
| PPM | Mocny atak 80 / 1,4 s; wspólny cooldown z LPM |
| B | Budowanie |
| 1 / 2 / 3 | Storehouse / Generator Arcane / Magic Tower |
| Q | Obrót podglądu o 90° |
| LPM / PPM w budowaniu | Postaw w zasięgu 6 m / anuluj |
| N | Drzewka w dowolnym miejscu, również w pauzie |
| E | Menu oddawania i pobierania materiałów przy DEPOSIT |
| 5 / 6 / 7 | Arcane Barrage / Cloak / Wrecking Team po odblokowaniu |
| X / V | Recycle / przenoszenie wieży po odblokowaniu |
| F | Rozbudowa rdzenia za dnia we wnętrzu albo ulepszenie trafionego generatora |
| Escape | Pauza / zamknięcie drzewek |
| R | Nowa próba |

Utrata fokusu zatrzymuje grę. Spacja wykonuje skok z grawitacją; sprintu jeszcze nie ma. Trafienia mają hit marker, flash, audio i wstrząs kamery przy mocnym ataku. Harvesting: drzazgi/iskry, floating text i mocniejszy rozpad. Wieże: magiczne pociski, trail, audio i efekty trafienia. Rdzeń reaguje w HUD; niskie HP wywołuje **SHELTER CRITICAL**.

## Zapis i architektura

Checkpoint **v17** zachowuje bank/plecak, Psyche, perki, HP konstrukcji i indywidualne poziomy generatorów, źródła, zombie i przygotowanie ataków bossów, dzień/noc, cooldowny, pociski, losowość, strażników, odliczanie odrodzenia, ochronę po odrodzeniu, wysokość/prędkość pionową gracza, czas pościgu/powrót Kolosa i wynik active/won/lost. Autosave: rozpoczęcie/wznowienie, 20 s, pauza, świt, perki, strażnik, śmierć, odrodzenie i zakończenie. Jest jeden slot; zakończony run zapisuje stan terminalny i nie wraca do życia po odświeżeniu. Historia obejmuje zwycięstwa i przegrane.

ASP.NET Core 8 + SQLite waliduje i przechowuje zapis. Schemat **v2** automatycznie dodaje Outcome do wyników i zachowuje wcześniejsze dane. Symulacja pozostaje w kliencie. Multiplayer i autorytatywna symulacja są dalszym etapem. Szczegóły: [server/README.md](server/README.md).

TypeScript + Babylon.js + Vite, HUD HTML/CSS, bez Reacta. Domena oddzielona od renderera. Symulacja 30 Hz, decyzje AI i dobór celu wież 5 Hz. Nawigacja uwzględnia aktualne przeszkody. Modele pozostają prototypowe. Cztery zestawy gracza dostarczają współdzielone materiały PBR 2K ścian, dachów, drewna i bruku, z oryginalnymi normalnymi i szorstkością, mipmapami oraz filtrowaniem ×8. Wcześniejsze atlasy 512 px pozostają dla pozostałych powierzchni i nieumarłych. Podłoże ma projekcję w przestrzeni świata, bez rozciągania na wąskich fragmentach ulic. Audio łączy próbkę zbierania z efektami walki i komunikatów Web Audio; ambient i muzyka są wyłączone.

| Pliki w shared/ | Parametry |
| --- | --- |
| survival.json | Fazy, ostrzeżenia, mini-fale, patrole |
| economy.json / corruption.json | Pojemności i Skażenie |
| skills.json / buildings.json | Perki, receptury i HP |
| world.json / map-adjustments.json / resources.json | Mapa, lokalne poszerzenie, barykady, dzielnice, źródła |
| harvesting.json / combat.json | Nagrody i ataki |
| shelter.json / defense.json | Baza, stanowiska, moc, naprawy |
| zombies.json / encounters.json | Zombie, bossowie i ataki |
| player.json | Czas/pozycja/ochrona odrodzenia, skok, grawitacja i maksymalna prędkość spadania |
| night-modifiers.json / checkpoint.json | Specjalne noce i wersja zapisu |

## Weryfikacja

W katalogu głównym, PowerShell 7:

```powershell
pwsh -NoProfile -File scripts/Verify-Milestone.ps1 -Stage manual-check
```

Skrypt uruchamia testy klienta, build klienta, build serwera i test HTTP/SQLite. Kompiluje do osobnego `verification/server`, więc nie koliduje z działającą grą. Logi i raporty trafiają do `verification/`. Testy serwera używają osobnej bazy w `server/test-results/` na porcie 5081; nie zmieniają bazy gry. Migracja testowa wymaga Node z `node:sqlite` (zweryfikowano Node 24).

**227 testów klienta i 98 kontroli HTTP/SQLite przechodzi; oba buildy są poprawne.** Raport aktualnego etapu: `verification/25-hordes-barricades-pit.json`. Testy sprawdzają pełne 128 spawny przy 15/30/60 FPS, przerwy między falami, ocalonych po świcie, kolizje barykad, zachodnią alejkę, rzeczywisty skok/spadanie w pełnej scenie, pit przed walką i po niej, krótszy pościg oraz migrację zapisów v14/v15/v16. Zabezpieczono 306 wcześniejszych brył poza autoryzowanymi zmianami. Najnowsza kontrola istniejącego checkpointu jest tylko odczytem i odtworzeniem w pamięci. Błąd narzędzia przeglądarkowego `helper_unknown_error: setup refresh had errors` uniemożliwił nową kontrolę wizualną; nie wykonano nowego zrzutu ekranu.

[Podgląd deweloperski](http://127.0.0.1:5173/tests/visual/preview.html) pozwala sprawdzać scenariusze bez pointer lock. Zegar przesuwają przyciski; skróty i finansowanie dotyczą wyłącznie testu, który nie trafia do produkcyjnego dist. Sprawdzono HUD w wąskim i desktopowym układzie, harvesting/depozyt, drzewka, Skażenie, Blood Moon, bossów i zwycięstwo.

## Dźwięki i tempo — poprawka z 6 października

Przy zbieraniu Wood/Iron odtwarzany jest wyłącznie oryginalny sygnał zdobycia materiału `zsh_resouceget.wav` z instalacji CSNZ gracza. Uderzenia w źródła są bez dźwięku. Próbka jest identyczna bajtowo z wpisem w `cstrike.nar`, bez obróbki i syntetycznych zamienników. Pochodzenie i odczyt archiwum: `client/public/audio/README.md`. Poprawka audio nie zmienia checkpointu v13; raport: `verification/19-resource-cue-only.json`.
Na prośbę gracza całkowicie usunięto ambient i muzykę w tle. Pozostają jednorazowe efekty gry.

Bazowy ruch gracza 5,2 m/s (+30%). Normalny zombie 1,65 m/s, Biegacz 2,65 m/s, Tank 1,15 m/s; nocne przyspieszenie pozostaje ×1,65.

Etap v13 dodał układ mapy i czterech bossów; jego raport: `verification/18-reference-map.json`.

## Mniejsza mapa i odrodzenie — 7 października

Etap v14 zagęszcza miasto, dopasowuje teren budowy do czerwonego prostokąta i proporcje budynku do oryginalnych danych BSP. Fasady mają okna, parapety i wejścia w skali postaci. Przesunięto źródła, stanowiska generatorów, depozyt, punkty odrodzenia zombie, bossów oraz bariery areny; nawigacja i kolizje korzystają z nowych wymiarów.

Śmierć gracza uruchamia odrodzenie, a zniszczenie rdzenia kończy próbę przegraną. Zapis v14 obsługuje oba timery i odrzuca fałszywą przegraną przy żywym rdzeniu. Rozpocznij nową próbę po aktualizacji. Raport: `verification/20-compact-map-respawn.json`, zrzuty: `verification/screenshots/20-*.png`.

## Materiały fantasy, obserwowanie bazy i melee bossów

Następna poprawka zachowuje checkpoint **v14** i istniejące próby. Usunięto murki na granicy terenu budowy, ich kolizje i blokowanie linii wzroku. Granice budowania oraz regeneracji Psyche pozostają wyznaczone przez teren Shelteru. Budynek, jego okna i centralny słup są nadal fizycznymi przeszkodami.

Po śmierci osobna kamera pokazuje bazę, bez zmieniania położenia gracza w zapisie. Broń znika na czas odliczania, a panel odrodzenia znajduje się niżej. Po odrodzeniu wraca pierwsza osoba. Każdy boss podchodzi i uderza z zasięgu wręcz; usunięto kręgi, znaczniki zagrożenia i obszarowy slam minibossów. Władca zachowuje szarżę, posiłki oraz zamkniętą arenę.

Nowe, autorskie materiały dark fantasy obejmują kamień, bruk, drewno, łupek, ziemię i metal oraz skórę, szaty, pancerz i kości nieumarłych. Poprawiono sylwetki, twarze, dłonie i animację zamachu z bronią. Rudy mają bardziej szczegółową geometrię i teksturę. Atlasy, pochodzenie i pełne prompty: `client/public/textures/README.md`. Raport: `verification/21-fantasy-materials-spectator-melee.json`.

## Przeklęte średniowieczne miasto — oprawa zatwierdzonej mapy

Układ i gameplay etapu v14 pozostają zamrożone. `CityArt` ubiera istniejące bryły w kamienne partery, drewniane piętra, belki, okiennice, spadziste dachy, zniszczone połacie, kominy i wieżyczki. Sąsiadujące fragmenty nieregularnego budynku współdzielą wysokość fasady. Oryginalne bryły nadal obsługują kolizje i przesłanianie celów; modele dekoracyjne są niekolizyjne i pomijane przy interakcjach. Zewnętrzne bryły maski wyglądają jak uliczne lica dawnych murów miejskich, bez ogromnych płaskich wierzchów.

Landmarki wykorzystują istniejące działki: wielki komin kuźni, kaplica katakumb, posąg dawnego władcy i dwie wieże cytadeli. Beczki, skrzynie, martwe drzewa, szyldy i latarnie stoją przy fasadach; subtelne runy i kryształy sugerują klątwę. Przygaszone światło dnia, czytelna noc i ciepłe latarnie korzystają z dotychczasowych świateł. Ambient audio i muzyka pozostają wyłączone.

Shelter jest runicznym sanktuarium w tym samym miejscu, z tymi samymi oknami, wejściem i rdzeniem. Arcane Beacon ma rzeźbione runy, pieczęć i osiem lekkich drobin światła. Arcane Conduit zastępuje wygląd generatora, a kamienna Magic Tower ma kryształową głowicę bez lufy. Magazyn i depozyt mają drewniane drzwi, belki oraz okucia. Współdzielone materiały, istniejące atlasy i łączenie statycznych detali ograniczają koszt renderowania; liczba dynamicznych świateł nie wzrosła.

Przeciwnicy to **Hollow**, **Feral** i **Fallen Guard**: kaptur i postrzępiony strój dawnego mieszkańca, zdeformowany łowca z długimi pazurami oraz upadły strażnik w hełmie i uszkodzonej zbroi. Klucze `normal` / `fast` / `tank`, statystyki, AI i zapis są takie same. Stroje i ozdoby nie powiększają interaktywnych brył ciała. Checkpoint pozostaje **v14**, bez konieczności zaczynania nowej próby.

Raport: `verification/22-cursed-medieval-city.json`; zabezpieczony stan geometrii: `client/tests/fixtures/approved-layout-v14.json`; porównanie plików gameplayu: `verification/22-art-layout-baseline.json`. Zrzuty: `verification/screenshots/22-*.png`. Podgląd deweloperski zawiera dodatkowo widoki ulicy, generatora i wieży z bliska.


## Etap 23 — magazyn, dwa wejścia i ciągłe oblężenie

E przy szafie w narożniku otwiera menu magazynu. Oddawanie i pobieranie Wood/Iron po 1 lub 5 odtwarza kontrolki oryginalnego `WarehouseDlg.res`. Dostępne są też pola własnej ilości i przycisk oddania wszystkiego. Transfer ogranicza się do dostępnych materiałów i wolnego miejsca; nadmiar zostaje u źródła. Otwarcie menu zatrzymuje lokalną symulację, podobnie jak Skill Tree; Escape / E wraca do gry. Samo wejście do bazy niczego nie przekazuje.

Budowa, ulepszenie rdzenia oraz naprawy wykorzystują najpierw zasoby przy sobie, potem brakującą ilość z magazynu, osobno dla Wood i Iron. Pełny koszt jest sprawdzany przed pobraniem materiałów. HUD podglądu budowy pokazuje podział kosztu. Generatory nadal mają sześć stanowisk; wieże i magazyny rozstawia się swobodnie. Ulice, bryły miasta i źródła zachowują zatwierdzony layout. Dodano dwa przeciwległe wejścia zgodnie ze szkicem; wskazówka powrotu wybiera bliższe.

Ocalałe zombie nie znikają o świcie i nadal mogą atakować rdzeń. Alarm przy trafieniu rdzenia lub konstrukcji używa oryginalnego `/dstrike/sound/shelterteam/siren.wav`, z odstępem zapobiegającym nakładaniu dźwięków. Muzyka i ambient pozostają wyłączone.

Checkpoint **v15** automatycznie przyjmuje v14, zachowując procent HP konstrukcji, zasoby, skille, przeciwników i postęp. Stary slot lokalny nie jest usuwany; SQLite zabezpieczono kopią w `server/Data/backups/`. Starsze niezgodne układy nadal wymagają nowej próby.

Potwierdzona cena podstawowej wieży: **6 Wood / 6 Iron / 12 Power** ze zrzutu gracza. Moc generatorów **10/15/25** pochodzi z tooltipów instalacji. Pełnej tabeli cen/HP New Zombie Shelter coop nie udało się potwierdzić w odczytanych plikach; pozostałe obecne koszty i HP są naszym balansem, a sześć oryginalnych typów wież nie jest jeszcze zaimplementowane. Źródła i rozróżnienie: `verification/csnz-balance/README.md`.

Walidacja: **173 testy klienta / 39 plików**, **69 kontroli HTTP/SQLite**, build klienta i serwera. Raport `verification/23-shelter-economy.json`, zrzuty `verification/screenshots/23-*.png`.


## Etap 24 — odzyskany balans New Zombie Shelter

Odczytano zaszyfrowane CSV z `zsht_building.cso`, `zsht_buildmenu.cso` i tabel mapy `zsh_deadcity_pve`. Weryfikacja CRC archiwum, ponownego szyfrowania i zgodności dwóch tabel cen przeszła. Dane źródłowe i granice adaptacji: verification/csnz-balance/README.md (`verification/csnz-balance/README.md`). Nie włączono jeszcze pięciu dodatkowych wariantów wież ani pełnego oryginalnego systemu technologii i walki NPC.

Zapis v14/v15 migruje do **v16** z zachowaniem zasobów, rozwoju, ocalałych zombie i procentu HP. Dotychczasowe generatory otrzymują własny poziom równy dawnemu tierowi rdzenia, dzięki czemu zachowują wcześniejszą moc. Zachowane sloty localStorage są porównywane według daty zapisu; starszy slot nowszej wersji nie zasłania nowszego postępu. GET SQLite nadal zwraca istniejący checkpoint; migracja następuje przed przywróceniem i zwykłym kolejnym zapisem. Kopia SQLite jest w `server/Data/backups/`.

Kontrola: `verification/24-original-balance.json`. Poprzedni etap 23 zachował oba wejścia, ilościowy magazyn, budowanie z plecaka i banku, syrenę oraz zombie po świcie.

Etap 24 zweryfikowano: **199 testów klienta / 39 plików**, **79 kontroli HTTP/SQLite**, oba buildy. Dodatkowa kontrola istniejącego zapisu wykonuje wyłącznie GET i odtworzenie w pamięci; nie nadpisuje checkpointu gry.


## Etap 25 — hordy, barykady i otchłań

Pierwsza noc 24 zombie, wzrost +8, maksymalna kolejka 128 i limit 48 jednocześnie żywych. Cztery rosnące mini-fale zachowują przerwy; ocalałe zombie nadal żyją po świcie. Dawne domyślne parametry hord w checkpointach v14–v16 migrują na nowe, a bieżąca rozpoczęta fala i inne własne ustawienia pozostają.

Zachodnia alejka obok Strażnika Katakumb jest szersza o 7,7 m. Zamknięto dwa centralne pasaże trwałymi barykadami. W oryginalnym BSP potwierdzono `func_breakable` *199 i *212 oraz 46 poziomych powierzchni dna `boss_room` na Z=-96. Źródła i zakres adaptacji: dowody mapy (`verification/csnz-map/25-layout-evidence.json`). Pozostała maska źródłowa, pozycje budynków, źródeł i bossów są zachowane.

Końcowy boss ma arenę na poziomie -4 m: nawierzchnia jest wycięta, podłoga i kamienne ściany mają realną geometrię. Wejście nie tworzy nowych barier. Spacja pozwala wskoczyć; z dna nie da się wyskoczyć. Zapis v17 przechowuje wysokość i prędkość pionową, także podczas spadania. Wcześniejsza aktywna walka zostaje przeniesiona na dno z zachowanym HP bossa. Aktorzy zapisani w nowych barykadach są odsuwani miejscowo bez resetowania runu.

Kolos ma aggro 18 m zamiast 44 m, pościg maksymalnie 8 s i leash 26 m. Po przerwaniu wraca do punktu startu, odradza HP i ponownie angażuje dopiero po oddaleniu się gracza. Jego stan powrotu jest zapisywany. Śmierć gracza nadal pokazuje Shelter i uruchamia odrodzenie; przegrana wymaga zniszczenia rdzenia.


## Etap 26 — modele Hollow, Feral i Armoured Knight

Trzy różne modele z Pixabay zastępują wygląd regularnych przeciwników: szkieletowy wojownik dla Hollow, ghoul dla Feral i opancerzony rycerz dla tanka. Zachowane proporcje i tekstury, poprawiony kierunek Hollow, wysokość oraz poziom stóp. Horda współdzieli geometrię i tekstury, a flash trafienia działa niezależnie. Modele wczytują się wcześniej; błąd wczytywania pozostawia dotychczasowy model.

Źródłowe 81,5 MB zmniejszono do 12,7 MB. Tekstury mają 1024 × 1024, geometrię uproszczono, naprawiono normalne Feral i wygenerowano tangenty. Wszystkie trzy GLB mają 0 błędów i 0 ostrzeżeń walidatora. Pliki źródłowe w `models/` pozostają niezmienione. Pochodzenie, dokładne rozmiary i odtworzenie optymalizacji: [modele przeciwników](client/public/models/enemies/README.md).

Modele są statyczne, bez szkieletów i klipów animacji. Na razie ruch/atak/upadek wykorzystują proste transformacje całego ciała. Pełne animacje kończyn wymagają rigowania. W tym etapie zmienia się wygląd regularnych jednostek; checkpoint pozostaje v17.

Weryfikacja: **241 testów klienta / 42 pliki**, **98 kontroli HTTP/SQLite**, oba buildy. Import, skala, kierunek twarzy, normalne i mieszana horda 48 jednostek zostały sprawdzone przez Babylon. Zapis gracza przed/po ma identyczny hash. Raport: etap 26 (`verification/26-pixabay-enemies.json`). Kontrola teksturowanych modeli CPU: `verification/pixabay-models/model-orientation-contact.png`; narzędzie przeglądarkowe nie pozwoliło na nową kontrolę GPU/FPS.


## Etap 27 — chód, bieg i atak

Hollow, Feral i Armoured Knight mają po 17 kości i po trzy animacje: **Walk / Run / Attack**. Pracują kończyny i tułów; broń podąża za dłonią. Rycerz ma cięższy chód, Hollow zamach toporem, Feral atak pazurami. Są to proste autorskie animacje dodane do modeli gracza, bez pobierania nowych modeli i bez modyfikowania źródeł w `models/`.

Prędkość ruchu przełącza chód/bieg; nocne przyspieszenie uruchamia Run. Przejścia trwają 0,12 s, atak jest odtwarzany jednokrotnie, pauza zatrzymuje animacje. W bezruchu wraca poza spoczynkowa. Każdy przeciwnik ma własny szkielet i stan odtwarzania, a geometria/tekstury pozostają współdzielone. Poprawiono deformacje przy broni i szatach oraz obwiednię renderowania, aby zamach nie znikał przy krawędzi ekranu.

Rozmiar trzech modeli po dodaniu wag i animacji: 14,8 MB. Zachowano tekstury, UV, indeksy i proporcje. Pełny pipeline: `scripts/prepare-enemy-models.ps1`; szybkie odtworzenie rigów: `node scripts/model-tools/rig-enemies.mjs`. Szczegóły i autorzy modeli: [modele](client/public/models/enemies/README.md).

**262 testy klienta / 43 pliki**, **98 kontroli HTTP/SQLite**, oba buildy poprawne. Checkpoint v17 i zapis gracza pozostają zachowane. Raport: etap 27 (`verification/27-enemy-animations.json`). Podglądy animacji: `verification/27-enemy-animation/*-animations.gif`. Kontrola assetów odbyła się przez CPU skinning; kontrolę przeglądarkową blokuje Windows helper. Animacje nie mają IK stóp ani fizyki ubrań. Śmierć i bossowie zachowują dotychczasowe animowanie.


## Etap 28 — tekstury otoczenia dostarczone przez gracza

Zastosowano **medieval_wall_02** do elewacji i kamiennych elementów, **roof_slates_02** do dachów, **weathered_planks** do drewnianych belek/drzwi/okiennic i **cobblestone_01** do nawierzchni miasta oraz Shelteru. Każdy zestaw ma albedo, prawdziwą mapę normalnych i szorstkość. Wersje przeglądarkowe 2K WebP zajmują łącznie 35,64 MiB; oryginały 4K w `models/` pozostają niezmienione.

Bruk zachowuje ciągłość pomiędzy fragmentami ulic, dachówki układają się wzdłuż kalenicy, a deski wzdłuż drewnianych części. Materiały i warianty kolorystyczne współdzielą 12 map, a dekoracje nadal są łączone według materiału. Geometria, układ mapy, kolizje i checkpoint v17 pozostają zachowane.

Przygotowanie: `python scripts/prepare-environment-textures.py`. [Szczegóły materiałów](client/public/textures/README.md). **265 testów klienta / 44 pliki**, **98 kontroli HTTP/SQLite**, oba buildy oraz integralność istniejącego zapisu przeszły. Raport etapu 28 (`verification/28-environment-textures.json`). Kontrolę wizualną w przeglądarce ponownie zablokował błąd Windows helper; zweryfikowano mapy i scenę przez NullEngine.


## Etap 29 — obrys bazy i oświetlenie

Teren budowy dopasowano do żółtego zrzutu gracza. Zamiast pojedynczego prostokąta obowiązuje suma trzech stref z `shared/shelter.json`; pełny obrys wyznacza 26-centymetrowa żółta linia na ziemi. Obszar ochrony Psyche i budowania jest wspólny. Można stawiać konstrukcje przez łączenia stref; wycięte narożniki są wyłączone. Bruk i skrajne kolizje dopasowano miejscowo, zachowując dom, wejścia, generatory i pozostałe miasto. [Aktualny plan mapy](reference-assets/current-layout.png).

Shelter otrzymał cztery lokalne ciepłe światła. Poza bazą dzień jest chłodniejszy i pochmurny; ostatnia minuta stopniowo zmniejsza kontrast i zwiększa mgłę. Noc obniża światło otoczenia, wzmacnia cienie i dodaje niebieskie/cyjanowe akcenty; dwie magiczne latarnie oświetlają fragmenty ulic. Świt rozjaśnia miasto przez 12 s. Konfiguracja: `shared/lighting.json`. Łącznie osiem świateł, jeden kierunkowy cień 2048 px; lokalne źródła nie tworzą kolejnych map cieni.

Checkpoint pozostaje v17. Klient i serwer weryfikują footprint budowli względem całego nieregularnego terenu. **270 testów klienta / 46 plików, 110 kontroli HTTP/SQLite**, oba buildy. Raport etapu 29 (`verification/29-shelter-lighting.json`). Kontrolę wizualną GPU zablokował ponownie Windows helper; zweryfikowano konfigurację, scenę, przejścia oświetlenia, geometrię, budowę w nowych strefach i checkpointy.


## Etap 30 — naprawa znikających powierzchni

Po zmianach oświetlenia modułowe shadery Babylon nie były zarejestrowane przy kompilacji. Awaryjne pobieranie plików `.fx` zwracało stronę HTML Vite, co kończyło się błędem GLSL (`'<' : syntax error`). Dekoder RGBD pozostawiał wspólną teksturę BRDF w stanie niegotowym, blokując wszystkie materiały PBR miasta.

Dodano jawne importy shaderów PBR, Standard, mapy cieni oraz dekodera RGBD i jego wierzchołków przed utworzeniem sceny. Ziemia, ściany, dachy i drewno zachowują dostarczone mapy 2K. Obrys, nieregularny teren Shelteru i konfiguracja ośmiu świateł pozostają z etapu 29.

Diagnostyka działającej gry po poprawce: **34 gotowe tekstury, 17 poprawnie skompilowanych programów GPU, 380 aktywnych siatek**; próbka 20 powierzchni PBR gotowa do renderowania. Przed naprawą (`verification/30-render-fix/runtime-before.json`), po naprawie (`verification/30-render-fix/runtime-after.json`). Tymczasowe instrumentowanie klienta i Vite zostało usunięte. Nie wykonano nowego zrzutu ekranu przez narzędzie przeglądarkowe.

Dwa testy inicjalizacji PBR wymuszają dekodowanie BRDF do half-float i float, pomijane przez domyślny NullEngine. **272 testy klienta / 47 plików, 110 kontroli HTTP/SQLite**, oba buildy. Aktualny checkpoint v17 poprawnie odtworzono w pamięci bez zapisu do bazy. Raport etapu 30 (`verification/30-render-fix.json`).


## Etap 31 — feedback, angielski interfejs i muzyka

- Oryginalny sygnał materiału gra przy każdym skutecznym trafieniu w źródło, także przy pierwszym ciosie w Iron przed progiem nagrody. Krótkie kolejki zapobiegają zgubieniu pierwszego sygnału podczas ładowania audio; trafienie i nagroda w tej samej klatce nie dublują dźwięku.
- Złote przyciski **B / Housing** i **N / Skill** na dole HUD-u otwierają istniejące panele. Skill pokazuje liczbę wolnych punktów. Nazwy, komunikaty, depozyt, cele, przeciwnicy i opisy wszystkich 33 perków są po angielsku.
- Dostarczona muzyka dnia i nocy jest zapętlona, odtwarzana strumieniowo i przechodzi płynnie przez 2 s. Głośność: dzień 11%, noc 7,5%; konfiguracja `shared/audio.json`. Pauza i zakończenie runu wyciszają i zatrzymują muzykę.
- Brakujące wizualnie fragmenty murów wynikały z zaokrąglania siatki po poszerzeniu bazy. Render uwzględnia teraz ciągły obrys bazy i domyka drobne szwy narożników. Kolizje i układ przejść pozostają zachowane. Projekcja UV zachowuje właściwą skalę kamienia na wąskich ścianach.
- Trafienie gracza przez przeciwnika używa tego samego efektu `flesh` co trafienie zombie mieczem oraz wyraźnego czerwonego błysku.

**278 testów klienta / 49 plików, 110 kontroli HTTP/SQLite, oba buildy — PASS.** Obecny checkpoint v17 odtworzono w pamięci bez zapisu do bazy. Podgląd UI, obu paneli, oświetlenia i czerwonego błysku sprawdzono w osobnej scenie używającej rzeczywistych komponentów gry; bez dostępu do checkpointu. Tymczasowy podgląd usunięto.

Raport (`verification/31-feedback-english-music.json`) · Szczegóły weryfikacji (`verification/31-feedback-english-music/verification-details.json`) · HUD i naprawiona ściana (`verification/31-feedback-english-music/hud-wall.png`).


## Etap 33 — naprawa startu przez HTTP w LAN

Rzeczywiste uruchomienie w przeglądarce pod adresem IP ujawniło błąd `crypto.randomUUID is not a function`. Ta funkcja nie jest dostępna dla zwykłego HTTP w LAN, choć działa na localhost. Nowy generator `createRunId` używa natywnego UUID tam, gdzie jest dostępne, a w LAN generuje zgodne UUID v4 przez `crypto.getRandomValues`. Poprawiono oba wywołania: utworzenie runu i reset. Zachowano format identyfikatora i checkpoint v17.

Ogólny komunikat startowy nie przypisuje już wszystkich błędów do WebGL. Zawiera rozwijane szczegóły rzeczywistego błędu, wstawiane jako bezpieczny tekst. Nie zmieniano ustawień ani zabezpieczeń przeglądarki.

**283 testy klienta / 50 plików, 110 kontroli HTTP/SQLite i oba buildy — PASS.** Cztery testy obejmują natywne UUID, fallback bez randomUUID, zgodność identyfikatora z checkpointem po starcie/resecie oraz czytelny błąd przy braku generatora. Po odtworzeniu błędu sprawdzono faktyczny start pod `http://192.168.1.143:5173/`: widoczne menu, teksturowana scena 3D i status Checkpoint ready. Kontrola przeglądarkowa nie rozpoczynała nowego runu i nie nadpisywała checkpointu.

Raport (`verification/33-lan-startup.json`) · Weryfikacja przeglądarkowa (`verification/33-lan-startup/browser-verification.json`) · Gra uruchomiona przez LAN (`verification/33-lan-startup/lan-startup.png`).
