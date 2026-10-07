# Fantasy Shelter — aktualny stan projektu

Stan na **6 października 2026 r.** Ukończono 12 etapów zgodności z New Zombie Shelter i kolejną poprawkę na podstawie dziewięciu uwag gracza. Aktualny checkpoint: **v13**, SQLite: **schema v2**.

## Ostatnie poprawki

| Uwaga | Wdrożenie |
| --- | --- |
| Dźwięki zbierania | Wyłącznie oryginalny sygnał zdobycia materiału zsh_resouceget.wav z instalacji CSNZ gracza. Uderzenie w źródło bez dźwięku. Mono PCM 8-bit / 22050 Hz; identyczny bajtowo z cstrike.nar. |
| Psyche | Ikona głowy/mózgu i złoty pasek bez widocznej nazwy ani opisu. Pełny pasek oznacza dobrą kondycję, poza bazą maleje. |
| Depozyt | Metalowa „lodówka” we wnętrzu Shelteru. Celowanie + E przekazuje Wood/Iron do banku. Sam powrót niczego nie przenosi. Nadmiar zostaje w plecaku. |
| Punkty zawsze | N i przycisk w pauzie; zakup w dowolnym miejscu, za dnia i nocą. |
| Tempo | Gracz 5,2 m/s (+30%), szybsze regularne zombie i Guardian. Nocne przyspieszenie regularnych zombie ×1,65 pozostaje. |
| Dzień / noc | 180 / 90 s, centralna konfiguracja; ostrzeżenia 60/30/10, cztery rosnące mini-fale z przerwami. |
| Ambient / muzyka | Całkowicie usunięte na prośbę gracza; pozostają jednorazowe odgłosy gry. |
| Drzewka | Combat / Survival / Engineer: 33 perki, po 11 na ścieżkę, cztery poziomy, wielokrotne rangi, wymagania specjalizacji. Wszystkie mają działające efekty. |
| Boss | Władca Klątwy: 16000 HP, 20% odporności, szarża, Biegacze, enrage i zamknięta arena. Kolos 4500 HP oraz dwa minibossy. Dowolny dzień walki. |

Audio pochodzi z `D:/steam/steamapps/common/CSNZ/Data/cstrike.nar`. Opis i hash: `client/public/audio/README.md`, `verification/csnz-audio/resource-cue-only.json`. Bez ambientu i muzyki.

Mapa powstała z dokładnej maski zrzutu gracza: około 309 × 310 m. Zachowano kształt ulic, placów, zabudowy, Shelter na południu i pozycje czterech bossów. Layout i rozstawienie 48 dostępnych źródeł można odtworzyć skryptami `generate-reference-map.py` i `place-reference-resources.py`.

## Rozwój

3 Skill Points na start, +1 za każdy kolejny dzień. Jedna ranga kosztuje jeden punkt. Tier II / III / IV wymaga 3 / 6 / 9 punktów wydanych w tej samej ścieżce. Kolejne Weapon Mastery i Engineer Mastery wymagają poprzednika na maksymalnej randze.

- **Combat:** trzy poziomy Weapon Mastery, Battle Tempo, Health Up, Combat Crafting, Armor Enhancement, Combat Master, Special Weapon Mastery, Arcane Barrage, Stats Up. Realne obrażenia, HP, tempo, zasięg, pancerz, awaryjna osłona i atak obszarowy.
- **Survival:** Beginner / Advance Harvest, Speed Up, Explorer, Campfire, Survival Crafting, Hunter, Endurance, Scavenger, Cloak, Resource Transporting. Plecak do 60 Wood / 38 Iron, większe nagrody, zasięg narzędzia, wskazania pobliskich obiektów, regeneracja, spowolnienie celów, materiały z zabójstw, ukrycie i ręczny transport pełnego plecaka.
- **Engineer:** Auto Repair, Beginner / Intermediate / Expert Engineer, Improve Blueprint, Engineer Crafting, Electrical Engineering, Recycle, Construction Master, Wrecking Team, Turret Tower Moving. Koszty, HP, naprawy, wydajność i zużycie mocy, obrażenia i tempo wież, zwrot materiałów, atak obszarowy i przenoszenie wież.

N otwiera drzewka; menu zatrzymuje symulację. 5 = Barrage, 6 = Cloak, 7 = Wrecking po odblokowaniu; cooldowny 90 s. X = Recycle, V = przenoszenie trafionej wieży przez podgląd budowy. HP i cooldown przenoszonej wieży pozostają. Auto Repair potrzebuje bezruchu, zasięgu i 2 Wood / 1 Iron z banku na sekundę naprawy. Zdalny depozyt E wymaga perka i pełnego limitu jednego materiału.

Pełne rangi i efekty: [README.md](README.md), konfiguracja: `shared/skills.json`. Układ i nazwy nawiązują do pierwowzoru; efekty broni/trapów dostosowano do miecza, magii i istniejącej infrastruktury. [Referencja rozwoju — poradnik Nexon](https://csonline.nexon.com/Community/Strategy/View/1347?cp=1&sw=llAcceleraterll).

## Pozostałe działające systemy

- Miasto według zrzutu City of Damned, około 309 × 310 m, zabudowa, skróty, ryzykowne strefy i otwarty plac przy Shelterze.
- Shelter: dziedziniec 38 × 36 m, cztery bramy, dostępne wnętrze 12 × 10 m, drzwi 4,4 m i sześć okien. Zombie atakują centralny słup.
- Generatory na sześciu stałych stanowiskach, magazyny i wieże swobodnie poza przejściami. Budowa wyłącznie na terenie Shelteru.
- Harvesting przez trafienie mieczem do plecaka. 48 źródeł (22 Wood / 26 Iron), w tym 16 bogatych; odrastają każdego świtu.
- Bank 100 Wood / 50 Iron na start, każdy Storehouse +50 / +25. Budowa, rozbudowa i naprawy korzystają z banku.
- Arcane = moc generatorów: bazowo generator +40, wieża rezerwuje 10, magazyn 5. Perki wpływają na bilans i rzeczywiste zasilanie wież.
- Psyche: −1/s poza bazą, +4/s w ochronie. Przy pustym pasku: winieta, −20% ruchu, 5 HP co 3 s. Endurance spowalnia utratę, Campfire pomaga regenerować.
- Rdzeń 300/500/750 HP, pancerz 0/10/20%. F we wnętrzu rozbudowuje za dnia. LPM naprawia trafiony słup lub konstrukcję za materiały, PPM jest mocnym atakiem.
- LPM: 34 / 0,65 s; PPM: 80 / 1,4 s, wspólny cooldown. Perki zmieniają realny zasięg, obrażenia i tempo.
- Storehouse 160 HP, generator 200, Magic Tower 240. Wieża: bazowo 25 obrażeń / 1,2 s, 12 m. Zniszczenie magazynu ogranicza bank, utrata generatora może wyłączyć wieże.
- Normalny / Biegacz / Tank: 100 / 70 / 300 HP. Losowe patrole i nocne oblężenia; limit żywych 24. Pierwsza noc 8 jednostek, +4 każdego dnia, do 64.
- Blood Moon co 5 nocy: fala ×1,5, czerwone światło i komunikaty. Świt przywraca źródła i dodaje punkt, zachowując zasoby i rozwój.
- Feedback: hit marker, flash, wstrząs przy mocnym ataku, particles, floating text, dźwięki, magiczne pociski i trail, ostrzeżenia o HP rdzenia.

## Bossowie i koniec runu

Na wschodzie Strażnik Kuźni (1800 HP) pilnuje bogatego Iron, a na zachodzie Strażnik Katakumb (2100 HP) bogatego Wood. W centrum biega Rozszalały Kolos (4500 HP), który ściga i uderza wręcz, bez kręgów i magii. Każda pokonana jednostka pozostaje pokonana po zapisie i świcie.

Końcowy Władca Klątwy znajduje się w północno-wschodniej arenie: 16000 HP, 20% odporności, szarża 14 m/s / 55 obrażeń, mocny atak wręcz, do 6 Biegaczy i enrage poniżej 50% HP. Wejście zatrzaskuje cztery bariery z rzeczywistą kolizją. Arena chroni Psyche. Walka jest dobrowolna w dowolnym dniu; pokonanie bossa odblokowuje bariery i kończy run. Pozostali bossowie nie kończą próby.

## Zapis

Checkpoint **v13**, SQLite **schema v2**. Zapis obejmuje bank/plecak i jego rozwiniętą pojemność, Psyche (wewnętrznie corruption), wszystkie rangi i punkty, aktywne umiejętności i ich cooldowny, osłonę, idling, HP infrastruktury, źródła, przeciwników i spowolnienia, stan zamkniętej areny, cel/cooldown/trwanie szarży oraz timery bossa, cykl, losowość, pociski, flagi strażników i wynik active/won/lost.

Autosave: start/wznowienie, co 20 s, pauza, świt, zakup perków, Guardian i zakończenie. Jeden slot, fallback localStorage, historia ostatnich 20 wyników bez duplikatów. Zakończony run pozostaje zakończony po odświeżeniu. Starsze checkpointy v1–v12 wymagają nowej próby; kopie w SQLite i stare lokalne klucze pozostają zachowane do zwykłego zapisu nowej próby.

## Weryfikacja

**136 testów klienta, 55 kontroli HTTP/SQLite**, build klienta i serwera. Ostatnia poprawka audio: `verification/19-resource-cue-only.json`. Mapa i bossowie: `verification/18-reference-map.json`. Poprawka audio zachowuje checkpoint v13 i istniejącą próbę.

Testy sprawdzają maskę wszystkich pikseli mapy, dostępność dzielnic/źródeł i bossów, 10 wież przy nowym Shelterze, pościg i melee Kolosa, obu minibossów, szarżę i uskok, fizyczne blokowanie czterech wyjść, otwarcie po zwycięstwie i checkpoint areny. Pozostają testy ekonomii, depozytu, rozwoju, HP, mocy, walki, nocy, zapisu i migracji SQLite. Poprawiono nawigację zombie, aby nie wybierały skrótu przez parapet.

Przeglądarka: układ mapy z góry, Kolos, zamknięta arena. Zrzuty w `verification/screenshots/`. Podgląd testowy nie zapisuje danych gracza i nie trafia do produkcyjnego buildu.

Modele pozostają prototypowe; tekstury proceduralne są współdzielone. Pełna gra FPS wymaga desktopowego Chrome/Edge z pointer lock. Multiplayer, konta, serwerowa symulacja i kolejne specjalne noce pozostają dalszymi etapami. Symulacja nadal jest po stronie klienta.

Uruchomienie: [README.md](README.md). API: [server/README.md](server/README.md).
