# Fantasy Shelter — aktualny stan projektu

Stan na **9 października 2026 r.** Ukończono 12 etapów zgodności z New Zombie Shelter i kolejne poprawki gracza. Aktualny checkpoint: **v17**, SQLite: **schema v2**.

Zatwierdzona mapa ma około **182 × 182 m**. Teren budowy Shelteru ma **nieregularny obrys** z żółtego zrzutu gracza: poszerzony plac główny, zachodnia część oraz dolny pas. Prostokąt obejmujący całość ma 62,05 × 39,4 m; jego wycięte narożniki pozostają poza bazą. Budynek ma **12,6 × 7,9 m**, proporcje odczytane z oryginalnego `zsh_deadcity_pve.bsp`. Miasto zachowuje zatwierdzone ulice, źródła, bossów i arenę. Najnowszy etap poszerza zachodnią alejkę obok minibossa, zamyka dwa centralne pasaże fizycznymi barykadami i obniża końcową arenę do pita. Zachowano pozostałe ulice oraz pozycje źródeł, bazy i bossów.

**Oprawa miasta:** kamienne partery, drewniane piętra i belki, okiennice, drzwi, spadziste i częściowo uszkodzone dachy, kominy oraz wieżyczki. Są landmarki kuźni, kaplicy katakumb, posągu i cytadeli; przy fasadach beczki, skrzynie, martwe drzewa, wiszące szyldy i latarnie. Rdzeń to Arcane Beacon z runami, pieczęcią na ziemi i ośmioma drobinami światła. Generator to Arcane Conduit, wieża ma kamienny trzon i runiczną głowicę, depozyt ma drewniane drzwi i okucia. Hollow / Feral / Fallen Guard zachowują wcześniejsze statystyki i klucze zapisu. Dekoracje nie dodają kolizji; statyczne detale są łączone według współdzielonych materiałów. Oświetlenie ma dwa światła globalne i sześć lokalnych: cztery ciepłe w bazie oraz dwie cyjanowe latarnie miejskie; audio opisano poniżej. Zapis **v17** automatycznie migruje dotychczasowe próby v14/v15/v16 z zachowaniem procentu HP.

**Śmierć gracza nie kończy runu.** Po 5 s odradza się wewnątrz Shelteru z pełnym HP/Psyche i 3 s ochrony; traci plecak. Rozwój, bank i budynki pozostają, a oblężenie trwa podczas odliczania. Przegrana następuje dopiero po zniszczeniu rdzenia. Śmierć w arenie resetuje próbę walki z końcowym bossem. Parametry: `shared/player.json`.

Kolejna poprawka: materiały fantasy z dwóch atlasów imagegen, stała skala bruku na całej mapie, tekstury skóry/szat/pancerza/kości zombie i poprawione sylwetki. Po śmierci kamera pokazuje bazę, po odrodzeniu wraca pierwsza osoba. Usunięto niskie murki na granicy terenu Shelteru oraz ich kolizje. Wszyscy bossowie walczą wręcz, bez kręgów na ziemi; Władca zachowuje szarżę i posiłki. Ten etap zachowuje kompatybilność checkpointu v14.

## Najnowszy etap 29

- Nieregularny teren budowy zgodny z żółtym zrzutem: plac główny X −25,9…29 / Z −8,95…23,75, zachodnia część X −33,05…−10,55 / Z −15,65…5,1 i dolny pas. `shared/shelter.json` przechowuje trzy połączone strefy. Budowanie, naprawy i ochrona Psyche używają ich sumy; budowle mogą przekraczać wewnętrzne łączenia, ale nie zewnętrzny obrys.
- Ciągła, wyraźna złotożółta linia szerokości 26 cm na ziemi. Bez kolizji, blokowania pocisków i dodatkowych murków. Bruk dopasowany do obrysu, fragmenty zewnętrznych kolizji przycięte miejscowo. Pozycje domu, rdzenia, sześciu generatorów, źródeł i bossów zachowane.
- Baza: ciepłe lokalne światło, jaśniejsza nocą. Miasto: chłodny pochmurny dzień, ostatnie 60 s to łagodniejszy i bardziej mglisty zmierzch, następnie ciemna czytelna noc z niebieskim światłem księżyca i cyjanowymi latarniami. Świt rozjaśnia się przez 12 s. Blood Moon zachowuje czerwone akcenty.
- Konfiguracja `shared/lighting.json`; płynne przejścia, osiem świateł łącznie, jeden kierunkowy cień 2048 px. Materiały otoczenia i przeciwników obsługują ten sam limit, więc lokalne światła działają także na modele GLB.
- Aktualny rzut: `reference-assets/current-layout.png`; odtworzenie: `python scripts/render-current-layout.py`. Checkpoint nadal v17 — format nie wymaga migracji; wcześniejszy teren mieści się w nowym obrysie. Klient i serwer sprawdzają pełny footprint budynku w sumie stref.
- 270 testów klienta / 46 plików, 110 kontroli HTTP/SQLite, oba buildy. Aktualny checkpoint v17 odtworzono w pamięci z zachowaniem runId, zasobów, rozwoju, budowli i cyklu; narzędzia weryfikacji nie zapisują slotu gracza. Lokalne API uruchomiono ponownie z nowymi strefami.
- Raport kontroli: `verification/29-shelter-lighting.json`. Podgląd GPU w przeglądarce nadal blokuje `helper_unknown_error: setup refresh had errors`; scena, kolizje, przejścia światła oraz zapis są kontrolowane automatycznie.

## Poprzedni etap 28

- Usunięto owalne dekoracyjne plamy ziemi z ulic na prośbę gracza; pozostaje czysty bruk.

- Materiały gracza: medieval_wall_02 na elewacjach i kamieniu, roof_slates_02 na dachach, weathered_planks na drewnie/drzwiach/okiennicach oraz cobblestone_01 na ulicach i podłożu bazy.
- 12 współdzielonych map PBR 2K: kolor, oryginalne normalne i szorstkość. 35,64 MiB plików WebP; mipmapy, anizotropia ×8. Oryginały 4K/EXR/Blend w `models/` niezmienione.
- Skala 2 m, ciągłe UV bruku, kierunek słojów wzdłuż belek i prawidłowe ułożenie połaci dachów. Statyczne detale PBR nadal łączone według materiału i otrzymują cienie. Zatwierdzona geometria i kolizje zachowane.
- 265 testów klienta / 44 pliki, 98 kontroli HTTP/SQLite, oba buildy. Dodatkowo sprawdzono dekodowanie 12 map, długość wektorów normalnych, dane roughness, SHA-256 źródeł i odpowiedzi HTTP assetów. Hash istniejącego checkpointu identyczny przed/po; nadal v17.
- Raport: `verification/28-environment-textures.json`, szczegóły: `client/public/textures/README.md`. Nową kontrolę wizualną w przeglądarce zablokował błąd helpera; wykonano kontrolę plików oraz sceny Babylon NullEngine.

## Poprzedni etap 27

- Każdy z trzech modeli ma 17 kości i trzy autorskie klipy: Walk, Run, Attack. Kończyny i tułów rzeczywiście deformują siatkę. Hollow = zamach toporem, Feral = pazury, Armoured Knight = cięższy chód/zamach.
- Runtime przełącza chód/bieg na podstawie prędkości, w tym nocnego przyspieszenia. Przejścia 0,12 s, pojedyncze ataki, zatrzymanie w pauzie i powrót do pozy spoczynkowej. Osobne szkielety aktorów, wspólna geometria i tekstury.
- Poprawiono wagi broni, dłoni i tkanin, szwy oraz obwiednie renderowania. Zachowano tekstury, UV, indeksy i proporcje; źródła niezmienione. Trzy animowane GLB mają łącznie 14,8 MB; każdy przechodzi walidację 0 błędów / 0 ostrzeżeń.
- 262 testy klienta / 43 pliki, 98 kontroli HTTP/SQLite, oba buildy. 35 testów modeli i animacji obejmuje deformację, rozciąganie trójkątów, bind pose i niezależne szkielety 48 aktorów. Istniejący zapis ma identyczny hash przed/po; checkpoint nadal v17.
- Podglądy CPU/GIF: `verification/27-enemy-animation/`. Raport `verification/27-enemy-animations.json`. Animacje są proste, bez IK stóp i symulacji ubrań; test GPU nadal blokuje błąd helpera przeglądarkowego.

## Poprzedni etap 26

- Trzy aktywne modele z lokalnego folderu `models/`: Hollow = Skeleton Warrior, Feral = Bigfoot Ghoul, tank = Dark Fantasy Knight. Pochodzenie i autorzy: `client/public/models/enemies/README.md`.
- 81,5 MB źródeł → 12,7 MB w grze. Tekstury 1024, uproszczona geometria, poprawione normalne Feral, tangenty MikkTSpace; walidacja wszystkich GLB: 0 błędów / 0 ostrzeżeń. Źródła niezmienione.
- Współdzielone geometrie/tekstury, niezależny flash trafienia, wcześniejsze wczytywanie, fallback i bezpieczny restart. Dopasowane wysokości/stopy i kierunek twarzy Hollow, również dla posiłków w picie.
- Pliki nie mają rigów ani animacji: na razie ruch całego ciała, wychylenie przy ataku i upadek. Pełny animowany chód kończyn jest kolejnym zadaniem.
- 241 testów klienta / 42 pliki, 98 kontroli serwera, oba buildy. Sprawdzono rzeczywiste GLB oraz mieszaną hordę 48 jednostek. Checkpoint v17; istniejący zapis ma identyczny hash przed/po.

## Poprzedni etap 25

- Pierwsza noc: 24 nowe zombie (3/5/7/9), wzrost +8/dzień, kolejka do 128, jednocześnie do 48 żywych. Cztery mini-fale zachowują przerwy i działają przy 15/30/60 FPS. Dzień/noc nadal 180/90 s.
- Zachodnia alejka szersza o 7,7 m. Dwa centralne przejścia zamknięte barykadami, które blokują ruch, nawigację i widoczność. Źródła BSP: *199/*212; zakres: `shared/map-adjustments.json`.
- Końcowa arena jest pitem 4 m poniżej ulicy. Spacja = skok, rzeczywista grawitacja, otwór w nawierzchni i stałe ściany. Boss budzi się po wylądowaniu; nie pojawia się bariera. BSP potwierdza 46 powierzchni dna na Z=-96.
- Kolos: aggro 18 m, leash 26 m, pościg do 8 s, następnie powrót i reset HP. Ponowne aggro wymaga powrotu i oddalenia gracza. Stan pościgu/powrotu trafia do checkpointu.
- Checkpoint v17 migruje v14/v15/v16, zachowuje progres, indywidualne poziomy generatorów i procent HP. Rozpoczęta fala zachowuje swój stan; kolejne używają zwiększonej presji. Zapis obejmuje wysokość/prędkość pionową, również podczas spadania do pita. Kopia SQLite: `server/Data/backups/before-checkpoint-v17-20261008-194516.db`.

## Poprzedni etap 24

- Odzyskano oryginalne tabele CSNZ: 34 budynki, 40 menu, 33 perki, 281 NPC, 1025 wpisów fal i ustawienia mapy. CRC NAR i ponowne szyfrowanie TEA są zgodne. Źródła: `verification/csnz-balance/README.md`.
- Rdzeń I–IV: 1250 / 2100 / 2750 / 3300 HP. Rozbudowa II/III/IV kosztuje 40+35 / 70+70 / 125+125 Wood+Iron i rezerwuje 15 / 20 / 30 Power.
- Storehouse: 12 Wood + 6 Iron, 1250 HP, rezerwacja 10 Power. Magic Tower: 6+6, 550 HP, 12 Power.
- Każdy generator ma własny poziom I–IV: koszt 5+5 / 9+9 / 15+13 / 20+22, HP 1000 / 1500 / 2000 / 2500, moc 10 / 15 / 25 / 130. F na generatorze kupuje kolejny poziom; tier rdzenia odblokowuje możliwość rozbudowy, bez automatycznego ulepszania generatorów.
- Rdzeń i magazyny mają pierwszeństwo zasilania przed wieżami. Koszty materiałów nadal korzystają najpierw z plecaka, potem z banku; niedostateczna moc nie pobiera materiałów.
- Zapis v14/v15 migruje do v16, zachowując procent HP i postęp. Starsze generatory utrzymują dawną moc jako własny tier. Wybór lokalnego zapisu bierze pod uwagę datę we wszystkich obsługiwanych slotach.
- Zachowano zatwierdzony layout, dwa wejścia, magazyn ilościowy, alarm i żywe zombie po świcie. Dodatkowe typy wież oraz pełna technologia i walka NPC są odzyskanym materiałem referencyjnym dla dalszych etapów; pojemności, tempo, naprawy i pancerz to dostosowanie Fantasy Shelter.

## Etap 23 — wcześniejsze poprawki i tymczasowy balans

- Ocalałe zombie pozostają po świcie, zachowując HP i cooldowny; nadal walczą, bez przyspieszenia nocnego. Nie ma nagród za samo przejście fazy.
- Shelter ma dwa przeciwległe wejścia o szerokości 3,2 m. DEPOSIT jest w narożniku. Strzałka wskazuje bliższe wejście.
- Menu magazynu odtwarza oryginalne przyciski +1/+5 w obu kierunkach i pozwala wpisać ilość; transfer respektuje pojemność i nie duplikuje zasobów.
- Budowanie: plecak w pierwszej kolejności, bank pokrywa braki. Pełny koszt jest sprawdzany atomowo. Naprawy i rozbudowa stosują tę samą zasadę.
- Oryginalna syrena `shelterteam/siren.wav` gra przy obrażeniach rdzenia lub konstrukcji, bez nakładania kolejnych alarmów. Ambient nadal wyłączony.
- Rdzeń ma 1000/2000/3500 HP; LPM naprawia 60 HP. Magic Tower kosztuje 6 Wood / 6 Iron / 12 Power. Generator daje 10/15/25 Power według tieru Shelteru; magazyn nie pobiera mocy.
- HP i ceny generatora/magazynu to nasz wstępny balans. Nie potwierdzono pełnej tabeli cen i HP oryginału; źródła: `verification/csnz-balance/README.md`.
- Zapis v14 migruje do v15 bez resetu postępu. Kopia bazy: `server/Data/backups/before-checkpoint-v15-20261007-221815.db`.

## Ostatnie poprawki

| Uwaga | Wdrożenie |
| --- | --- |
| Dźwięki zbierania | Wyłącznie oryginalny sygnał zdobycia materiału zsh_resouceget.wav z instalacji CSNZ gracza. Uderzenie w źródło bez dźwięku. Mono PCM 8-bit / 22050 Hz; identyczny bajtowo z cstrike.nar. |
| Psyche | Ikona głowy/mózgu i złoty pasek bez widocznej nazwy ani opisu. Pełny pasek oznacza dobrą kondycję, poza bazą maleje. |
| Depozyt | Runiczna szafa w narożniku Shelteru. Celowanie + E otwiera menu oddawania i pobierania: 1/5 sztuk, własna ilość lub oddaj wszystko. Sam powrót niczego nie przenosi. Nadmiar zostaje w plecaku. |
| Punkty zawsze | N i przycisk w pauzie; zakup w dowolnym miejscu, za dnia i nocą. |
| Tempo | Gracz 5,2 m/s (+30%), szybsze regularne zombie i Guardian. Nocne przyspieszenie regularnych zombie ×1,65 pozostaje. |
| Dzień / noc | 180 / 90 s, centralna konfiguracja; ostrzeżenia 60/30/10, cztery rosnące mini-fale z przerwami. |
| Ambient / muzyka | Całkowicie usunięte na prośbę gracza; pozostają jednorazowe odgłosy gry. |
| Drzewka | Combat / Survival / Engineer: 33 perki, po 11 na ścieżkę, cztery poziomy, wielokrotne rangi, wymagania specjalizacji. Wszystkie mają działające efekty. |
| Boss | Władca Klątwy: 16000 HP, 20% odporności, szarża, Biegacze, enrage i zamknięta arena. Kolos 4500 HP oraz dwa minibossy. Dowolny dzień walki. |

Audio pochodzi z `D:/steam/steamapps/common/CSNZ/Data/cstrike.nar`. Opis i hash: `client/public/audio/README.md`, `verification/csnz-audio/resource-cue-only.json`. Bez ambientu i muzyki.

Mapa powstała z dokładnej maski zrzutu gracza: około 182 × 182 m, skala 0,7 m/piksel. Zachowano kształt ulic, placów, zabudowy, Shelter na południu i pozycje czterech bossów. Layout i rozstawienie 48 dostępnych źródeł można odtworzyć skryptami `generate-reference-map.py` i `place-reference-resources.py`. Analiza oryginalnego BSP: `verification/csnz-map/README.md`.

## Rozwój

3 Skill Points na start, +1 za każdy kolejny dzień. Jedna ranga kosztuje jeden punkt. Tier II / III / IV wymaga 3 / 6 / 9 punktów wydanych w tej samej ścieżce. Kolejne Weapon Mastery i Engineer Mastery wymagają poprzednika na maksymalnej randze.

- **Combat:** trzy poziomy Weapon Mastery, Battle Tempo, Health Up, Combat Crafting, Armor Enhancement, Combat Master, Special Weapon Mastery, Arcane Barrage, Stats Up. Realne obrażenia, HP, tempo, zasięg, pancerz, awaryjna osłona i atak obszarowy.
- **Survival:** Beginner / Advance Harvest, Speed Up, Explorer, Campfire, Survival Crafting, Hunter, Endurance, Scavenger, Cloak, Resource Transporting. Plecak do 60 Wood / 38 Iron, większe nagrody, zasięg narzędzia, wskazania pobliskich obiektów, regeneracja, spowolnienie celów, materiały z zabójstw, ukrycie i ręczny transport pełnego plecaka.
- **Engineer:** Auto Repair, Beginner / Intermediate / Expert Engineer, Improve Blueprint, Engineer Crafting, Electrical Engineering, Recycle, Construction Master, Wrecking Team, Turret Tower Moving. Koszty, HP, naprawy, wydajność i zużycie mocy, obrażenia i tempo wież, zwrot materiałów, atak obszarowy i przenoszenie wież.

N otwiera drzewka; menu zatrzymuje symulację. 5 = Barrage, 6 = Cloak, 7 = Wrecking po odblokowaniu; cooldowny 90 s. X = Recycle, V = przenoszenie trafionej wieży przez podgląd budowy. HP i cooldown przenoszonej wieży pozostają. Auto Repair potrzebuje bezruchu, zasięgu i 2 Wood / 1 Iron z plecaka lub banku na sekundę naprawy. Zdalny depozyt E wymaga perka i pełnego limitu jednego materiału.

Pełne rangi i efekty: [README.md](README.md), konfiguracja: `shared/skills.json`. Układ i nazwy nawiązują do pierwowzoru; efekty broni/trapów dostosowano do miecza, magii i istniejącej infrastruktury. [Referencja rozwoju — poradnik Nexon](https://csonline.nexon.com/Community/Strategy/View/1347?cp=1&sw=llAcceleraterll).

## Pozostałe działające systemy

- Miasto według zrzutu City of Damned, około 182 × 182 m, zabudowa, skróty, ryzykowne strefy i mniejszy plac przy Shelterze.
- Shelter: otwarty nieregularny teren budowy oznaczony żółtą linią, bez niskich murków, budynek 12,6 × 7,9 m, drzwi 3,2 m i sześć okien. Zombie atakują centralny słup.
- Generatory na sześciu stałych stanowiskach, magazyny i wieże swobodnie poza przejściami. Budowa wyłącznie na terenie Shelteru.
- Harvesting przez trafienie mieczem do plecaka. 48 źródeł (22 Wood / 26 Iron), w tym 16 bogatych; odrastają każdego świtu.
- Bank 100 Wood / 50 Iron na start, każdy Storehouse +50 / +25. Budowa, rozbudowa i naprawy korzystają najpierw z plecaka, a brakującą część pobierają z banku.
- Arcane = moc generatorów: generator dostarcza 10/15/25/130 według własnego poziomu, Magic Tower rezerwuje 12, magazyn 10, a rdzeń 0/15/20/30. Perki wpływają na bilans i rzeczywiste zasilanie wież.
- Psyche: −1/s poza bazą, +4/s w ochronie. Przy pustym pasku: winieta, −20% ruchu, 5 HP co 3 s. Endurance spowalnia utratę, Campfire pomaga regenerować.
- Rdzeń 1250/2100/2750/3300 HP, pancerz 0/10/20/30%. F we wnętrzu rozbudowuje za dnia. LPM naprawia trafiony słup lub konstrukcję za materiały, PPM jest mocnym atakiem.
- LPM: 34 / 0,65 s; PPM: 80 / 1,4 s, wspólny cooldown. Perki zmieniają realny zasięg, obrażenia i tempo.
- Storehouse 1250 HP, generator 1000/1500/2000/2500, Magic Tower 550. Wieża: bazowo 25 obrażeń / 1,2 s, 12 m. Zniszczenie magazynu ogranicza bank, utrata generatora może wyłączyć wieże.
- Normalny / Biegacz / Tank: 100 / 70 / 300 HP. Losowe patrole i nocne oblężenia; limit żywych 48. Pierwsza noc 24 nowe jednostki, +8 każdego dnia, kolejka do 128.
- Blood Moon co 5 nocy: fala ×1,5, czerwone światło i komunikaty. Świt przywraca źródła i dodaje punkt, zachowując zasoby i rozwój.
- Feedback: hit marker, flash, wstrząs przy mocnym ataku, particles, floating text, dźwięki, magiczne pociski i trail, ostrzeżenia o HP rdzenia.

## Bossowie i koniec runu

Na wschodzie Strażnik Kuźni (1800 HP) pilnuje bogatego Iron, a na zachodzie Strażnik Katakumb (2100 HP) bogatego Wood. W centrum biega Rozszalały Kolos (4500 HP), który ściga i uderza wręcz, bez kręgów i magii. Każda pokonana jednostka pozostaje pokonana po zapisie i świcie.

Końcowy Władca Klątwy znajduje się w północno-wschodniej arenie: 16000 HP, 20% odporności, szarża 14 m/s / 55 obrażeń, mocny atak wręcz, do 6 Biegaczy i enrage poniżej 50% HP. Gracz wskakuje do pita 4 m poniżej ulicy; stałe kamienne ściany uniemożliwiają wyskok na ulicę. Arena chroni Psyche. Walka jest dobrowolna w dowolnym dniu; pokonanie bossa kończy run. Pozostali bossowie nie kończą próby.

## Zapis

Checkpoint **v17**, SQLite **schema v2**. Zapis obejmuje bank/plecak i jego rozwiniętą pojemność, Psyche (wewnętrznie corruption), wszystkie rangi i punkty, aktywne umiejętności i ich cooldowny, osłonę, idling, HP infrastruktury i indywidualne poziomy generatorów, źródła, przeciwników i spowolnienia, stan zamkniętej areny, cel/cooldown/trwanie szarży oraz timery bossa, odrodzenie/ochronę i wysokość/prędkość pionową gracza, czas pościgu/powrót Kolosa, cykl, losowość, pociski, flagi strażników i wynik active/won/lost.

Autosave: start/wznowienie, co 20 s, pauza, świt, zakup perków, Guardian, śmierć, odrodzenie i zakończenie. Jeden slot, fallback localStorage, historia ostatnich 20 wyników bez duplikatów. Zakończony run pozostaje zakończony po odświeżeniu. Starsze checkpointy v1–v13 wymagają nowej próby; kopie w SQLite i stare lokalne klucze pozostają zachowane do zwykłego zapisu nowej próby.

## Weryfikacja

**270 testów klienta, 110 kontroli HTTP/SQLite**, oba buildy poprawne. Aktualny etap: `verification/29-shelter-lighting.json`; poprzedni: `verification/28-environment-textures.json`. Zabezpieczono 297 wcześniejszych brył poza autoryzowanymi zmianami terenu i krawędzi bazy; testy sprawdzają barykady, zachodnią alejkę i rzeczywisty spadek do pita w pełnej scenie. Istniejący zapis sprawdzono przez GET i odtworzenie w pamięci: `verification/25-current-save-migration.json`. Poprzedni raport: `verification/24-original-balance.json`.

Testy sprawdzają maskę wszystkich pikseli mapy, dostępność dzielnic/źródeł i bossów, 10 wież przy nowym Shelterze, pościg i melee Kolosa, obu minibossów, szarżę i uskok, stałe ściany pita, skok z krawędzi, brak możliwości wyjścia z dna i checkpoint spadania/areny. Pozostają testy ekonomii, depozytu, rozwoju, HP, mocy, walki, nocy, zapisu i migracji SQLite. Poprawiono nawigację zombie, aby nie wybierały skrótu przez parapet.

Historyczna kontrola przeglądarkowa: układ mniejszej mapy z góry, teren Shelteru, pięciosekundowe odliczanie i odrodzenie. Zrzuty w `verification/screenshots/20-*.png`. Podgląd testowy nie zapisuje danych gracza i nie trafia do produkcyjnego buildu.

Regularni przeciwnicy używają zoptymalizowanych modeli GLB z Pixabay; bossowie nadal mają modele proceduralne. Główne powierzchnie miasta korzystają z czterech zestawów PBR gracza, współdzielonych w scenie. Wcześniejsze atlasy pozostają dla pozostałych materiałów. Pochodzenie i przygotowanie tekstur: `client/public/textures/README.md`. Pełna gra FPS wymaga desktopowego Chrome/Edge z pointer lock. Multiplayer, konta, serwerowa symulacja i kolejne specjalne noce pozostają dalszymi etapami. Symulacja nadal jest po stronie klienta.

Uruchomienie: [README.md](README.md). API: [server/README.md](server/README.md).

W etapie 25 narzędzie przeglądarkowe ponownie zwróciło `helper_unknown_error: setup refresh had errors`; nowej kontroli wizualnej nie wykonano. Pełna scena i PlayerController zostały sprawdzone testami Babylon NullEngine.

W etapie 26 wykonano kontrolę teksturowanych assetów CPU (`verification/pixabay-models/model-orientation-contact.png`) i testy realnego importu Babylon. Nowa kontrola wyglądu w grze i FPS na GPU nie była dostępna przez błąd narzędzia przeglądarkowego.


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


## Etap 32 — uruchamianie w LAN

Dodano `npm run dev:lan` (port 5173) i `npm run preview:lan` (4173). Zwykłe `npm run dev` nadal nasłuchuje tylko lokalnie. Klient używa teraz względnego `/api`, przekazywanego przez proxy Vite do lokalnego backendu 5080; drugi komputer nie odwołuje się już do własnego localhosta. Override `VITE_API_URL` pozostaje dostępny. Uzupełniono instrukcję LAN w README.

Uruchomiono klient LAN oraz backend i sprawdzono HTTP strony, API health i odczyt checkpointu przez `http://192.168.1.143:5173/` na hoście. **279 testów klienta / 49 plików, 110 kontroli HTTP/SQLite i oba buildy — PASS.** Obecny checkpoint v17 odtworzono w pamięci bez zapisu do bazy. Dostęp z fizycznie drugiego komputera zależy od wspólnej sieci i zapory hosta; nie zmieniano reguł zapory. Wersja pozostaje solo, z jednym wspólnym slotem checkpointu na backendzie.

Raport (`verification/32-lan.json`) · HTTP przez LAN (`verification/32-lan/http-checks.json`) · Odtworzenie checkpointu (`verification/32-lan/current-save-validation.json`).


## Etap 33 — naprawa startu przez HTTP w LAN

Rzeczywiste uruchomienie w przeglądarce pod adresem IP ujawniło błąd `crypto.randomUUID is not a function`. Ta funkcja nie jest dostępna dla zwykłego HTTP w LAN, choć działa na localhost. Nowy generator `createRunId` używa natywnego UUID tam, gdzie jest dostępne, a w LAN generuje zgodne UUID v4 przez `crypto.getRandomValues`. Poprawiono oba wywołania: utworzenie runu i reset. Zachowano format identyfikatora i checkpoint v17.

Ogólny komunikat startowy nie przypisuje już wszystkich błędów do WebGL. Zawiera rozwijane szczegóły rzeczywistego błędu, wstawiane jako bezpieczny tekst. Nie zmieniano ustawień ani zabezpieczeń przeglądarki.

**283 testy klienta / 50 plików, 110 kontroli HTTP/SQLite i oba buildy — PASS.** Cztery testy obejmują natywne UUID, fallback bez randomUUID, zgodność identyfikatora z checkpointem po starcie/resecie oraz czytelny błąd przy braku generatora. Po odtworzeniu błędu sprawdzono faktyczny start pod `http://192.168.1.143:5173/`: widoczne menu, teksturowana scena 3D i status Checkpoint ready. Kontrola przeglądarkowa nie rozpoczynała nowego runu i nie nadpisywała checkpointu.

Raport (`verification/33-lan-startup.json`) · Weryfikacja przeglądarkowa (`verification/33-lan-startup/browser-verification.json`) · Gra uruchomiona przez LAN (`verification/33-lan-startup/lan-startup.png`).


## Porządkowanie Git — 13 października 2026

Kod, testy i gotowe używane assety zapisano w tematycznych commitach. Eksporty Nexona, wygenerowane raporty i skompilowane pliki serwera z `verification/` wyłączono ze śledzenia; lokalne kopie pozostają na dysku. Surowe modele/tekstury, duplikaty muzyki i cache Pythona są ignorowane. W `scripts` obowiązuje lista utrzymywanych narzędzi; czytniki archiwów i eksperymenty z ekstrakcją nie trafiają do Git. Poprawki LAN i uruchamiania przez HTTP wydzielono od zmian gameplayu. Aktualny checkpoint pozostaje v17.
