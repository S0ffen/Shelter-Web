# Fantasy Shelter

Przeglądarkowy FPS survivalowy w klimacie dark fantasy, inspirowany przygotowywaniem bazy i obroną przed hordami w Shelter. Ukończone etapy **1–6, 6.5, 7 i 8**, z serwerem zapisu **ASP.NET Core + SQLite**.

Aktualny stan: [STATUS_PROJEKTU.md](STATUS_PROJEKTU.md). Specyfikacje: [MVP](fantasy_shelter_mvp.md), [eksploracja i harvesting](fantasy_shelter_next_milestone.md). Parametry poniżej dotyczą tego prototypu.

## Rozgrywka

1. Rozpoczynasz dzień przy Shelterze. Masz **150 sekund** na zbieranie, eksplorację i budowanie. Cztery patrole krążą po ruinach i atakują pobliskiego gracza; ubytki patroli są uzupełniane co 20 sekund.
2. Noc zaczyna oblężenie. Pierwsza fala liczy **8 przeciwników**, następne rosną o 4, do 64. Żywe patrole wchodzą w skład fali. Kolejni zombie pojawiają się co 2 sekundy, przy limicie 24 żywych jednocześnie.
3. Spawny losują pozycje w dziesięciu obszarach miasta, co najmniej 10 m od gracza, z dostępną trasą do Shelteru. Zombie omijają ruiny, źródła surowców i konstrukcje. Wieże wybierają cele z całej hordy.
4. Noc trwa co najmniej **45 sekund** i kończy się dopiero po wyczerpaniu kolejki spawnu oraz zabiciu wszystkich przeciwników. Zegar na zero nie kończy aktywnego oblężenia.
5. Następny dzień zachowuje HP, zasoby, konstrukcje i wyczerpane złoża. Zabicie pojedynczego zombie nie kończy próby. Śmierć gracza lub zniszczenie Shelteru oznacza przegraną.

Oświetlenie i mgła płynnie przechodzą między dniem, zmierzchem i nocą. HUD pokazuje dzień, czas, żywych zombie, oczekujące spawny oraz zabójstwa. **N przy Shelterze** rozpoczyna noc wcześniej. Pauza zatrzymuje zegar, AI i spawny; restart tworzy nową próbę.

## Uruchomienie

Klient wymaga Node.js 22.12+ i npm; serwer — .NET SDK 8. Uruchom w dwóch terminalach.

~~~powershell
# Terminal 1, katalog główny projektu
dotnet restore server/FantasyShelter.Server.csproj
dotnet run --project server/FantasyShelter.Server.csproj --no-launch-profile
~~~

~~~powershell
# Terminal 2
cd client
npm install
npm run dev
~~~

Gra: **http://127.0.0.1:5173/**. API: **http://127.0.0.1:5080/api/health**. Baza `server/Data/shelter.db` powstaje automatycznie; nie trzeba podpinać zewnętrznej bazy. Klient działa również bez serwera, zapisując w localStorage przeglądarki.

Graj w desktopowym Chrome lub Edge z WebGL. „Wejdź do ruin” przechwytuje kursor i rozpoczyna próbę. Przeglądarka Codex może blokować pointer lock; wtedy otwórz adres w zwykłej przeglądarce.

## Sterowanie

| Sterowanie | Działanie |
| --- | --- |
| WASD / mysz | Ruch / rozglądanie |
| LPM | Miecz lub zbieranie z obiektu w celowniku; zasięg 3 m |
| B | Włącz/wyłącz budowanie |
| 1 / 2 / 3 | Storehouse / Generator Arcane / Magic Tower |
| Q | Obrót podglądu o 90° |
| LPM podczas budowania | Postaw konstrukcję w zasięgu 6 m |
| PPM podczas budowania | Anuluj i wróć do miecza |
| N przy Shelterze | Rozpocznij noc wcześniej |
| Escape | Pauza i zwolnienie kursora |
| R | Nowa próba |
| „Zapisz próbę” w pauzie | Zapis ręczny |
| „Wznów zapis” w menu | Wczytaj checkpoint |

Utrata aktywnej karty lub fokusu zatrzymuje rozgrywkę i anuluje podgląd budowania. Nie ma jeszcze skoku, sprintu ani ciężkiego ataku.

## Mapa i surowce

Ręcznie zaprojektowane miasto **96 × 98 m**, bez ekranów ładowania: Schronienie, Cmentarz, Stare Miasto, Rynek, Świątynia, Slumsy, Kuźnia, Las, Brama i Kopalnie. Dzielnica jest widoczna w HUD. Uliczki, place, zaułki i charakterystyczne budowle pomagają w orientacji.

Źródła mają HP i są zbierane mieczem: 34 obrażenia co 0,65 s. Skieruj celownik na obiekt, przy niskich złożach spójrz w dół. Żelazo ma postać nieregularnych ciemnych skał z żyłami rudy. Arcane jest wyłącznie mocą infrastruktury; nie ma zbieralnych kryształów.

| Źródło | HP | Nagrody przy HP | Liczba | Cała pula |
| --- | ---: | --- | ---: | ---: |
| Powalony pień | 100 | 75 / 50 / 25: po 3 Wood; 0: 5 Wood | 16 | 224 Wood |
| Złoże żelaza | 160 | 120 / 80 / 40 / 0: po 2 Iron | 16 | 128 Iron |


Każdy próg przyznaje nagrodę raz. Zniszczony obiekt znika i zwalnia kolizję. **Źródła nie odradzają się wraz z nowym dniem**; przywraca je nowa próba. Mapa i materiały są stałe, pozycje zombie są losowane.

Początkowe limity: **100 Wood / 50 Iron**. Jeśli cała nagroda z uderzenia nie mieści się w magazynie, trafienie jest blokowane; HP i materiał pozostają zachowane. Wydaj zasoby lub zbuduj Storehouse.

## Budowanie i obrona

Baza ma dziedziniec **28 × 26 m**, cztery bramy w niskim murze oraz dostępny Shelter **8 × 7 m** z wejściem szerokości 3 m. Możesz wejść i wyjść bez interakcji. Po obu bokach jest dziesięć sugerowanych stanowisk wież; można też wybierać inne poprawne miejsca na dziedzińcu. Budowanie wymaga, aby gracz i cały obrys konstrukcji znajdowali się na terenie bazy. Wnętrze Shelteru, drzwi i przejścia między bramami pozostają wolne. Strzałka HUD wskazuje kierunek oraz odległość do wejścia, a wysoki świetlny znacznik ułatwia znalezienie bazy w mieście.

Układ bazy i zasada mocy odwołują się do obejrzanych fragmentów [City of Damned — Zombie Shelter Co-op](https://www.youtube.com/watch?v=w5bPBMt6yJ4), z zachowaniem fantastycznego stylu projektu.


| Konstrukcja | Koszt | Działanie |
| --- | --- | --- |
| Storehouse | 30 Wood + 10 Iron | +50 Wood, +25 Iron pojemności; rezerwuje 5 mocy |
| Generator Arcane | 20 Wood + 15 Iron | +40 mocy |
| Magic Tower | 20 Wood + 15 Iron | Rezerwuje 10 Arcane Power; zasięg 12 m, 25 obrażeń co 1,2 s |

**Arcane oznacza Power:** generatory zwiększają całkowitą moc, a wieże i magazyny rezerwują jej część. HUD pokazuje moc wolną / całkowitą. Nie zbierasz Arcane i nie zużywasz go z czasem ani przy strzałach. Jeden generator zasila cztery wieże lub trzy wieże i magazyn. Koszty i balans dotyczą tego prototypu. Pociski wież lecą do celu. Ruiny, konstrukcje i żywe źródła blokują widoczność i ataki. Gracz i każdy zombie mają 100 HP; Shelter 300 HP.

Zielony podgląd oznacza poprawne miejsce, czerwony blokadę z wyjaśnieniem. Nie można budować w przeszkodach, na graczu/zombie/żywych źródłach, w chronionych podejściach do Shelteru ani odciąć tras ze stref spawnu. Nieudana budowa nie pobiera zasobów.

Generator + Tower kosztują **40 Wood i 30 Iron**. Cztery pnie i cztery złoża przy Shelterze dają 56 Wood i 32 Iron. Najpierw zbuduj generator, następnie magazyn i wieże. Dzień służy przygotowaniu infrastruktury; wieżę ustaw z widokiem na podejścia. Naprawy, rozbieranie i ataki zombie na konstrukcje będą kolejnymi rozszerzeniami.

## Zapis i serwer

Zapis automatyczny: początek/wznowienie próby, co 20 sekund, pauza i początek nowego dnia. Checkpoint zachowuje HP, pozycję gracza, zasoby, budynki, HP źródeł, zombie, cykl, kolejkę spawnu, generator losowy, cooldowny wież i pociski. Wczytana próba jest zatrzymana do przechwycenia kursora.

Aktualny checkpoint ma **wersję 2**. Poprzedni układ mapy i zasób Arcane z wersji 1 nie są zgodne: rozpocznij nową próbę. Stary lokalny zapis pozostaje pod osobnym kluczem; w SQLite poprzedni checkpoint pozostaje do normalnego zapisu nowej próby. Moc jest odtwarzana z generatorów i odbiorników, bez osobnego zasobu Arcane.

HUD wskazuje, czy zapis trafił do SQLite czy do przeglądarki. Przy uruchomieniu wybierany jest nowszy poprawny checkpoint. Historia przegranych jest osobną tabelą; przegrana nie nadpisuje ostatniego żywego zapisu. Jest jeden slot lokalnej próby.

ASP.NET Core waliduje dane i przechowuje je w SQLite. **Symulacja gameplayu nadal działa w kliencie.** Multiplayer, SignalR i serwerowa walidacja ruchu oraz walki pozostają dalszym etapem. Szczegóły: [server/README.md](server/README.md).

## Architektura i parametry

~~~text
shared/                  survival.json, harvesting.json, resources.json, shelter.json
client/src/
  domain/                Simulation, SurvivalCycle, typy i konfiguracja walki
  core/                  Game, scena, input, pętla renderowania
  player/                Stan gracza, kontroler Babylon, widok miecza
  enemies/               Zombie, AI, ZombieSpawner, ZombieView, HordeView
  resources/             ResourceManager, ResourceNode, HarvestingConfig, ResourceView
  building/              Stan, walidacja, wieże, pociski i widoki konstrukcji
  world/                 WorldLayout, NavigationGrid, geometria miasta
  persistence/           RunSnapshot, SaveService
  shelter/, ui/          Shelter i HUD HTML/CSS
server/                  Minimal API, CheckpointValidator, RunStore, SQLite
~~~

TypeScript + Babylon.js + Vite, bez Reacta. Modele i reguły nie importują Babylon.js. Symulacja **30 Hz**, decyzje AI i dobór celów wież **5 Hz**. Wspólna siatka nawigacyjna wyznacza drogi dla hordy i aktualizuje się po zmianie przeszkód. Widoki interpolują ruch; zwłoki znikają po 3 sekundach i nie blokują raycastu.

`shared/survival.json`: cykl i spawny; `shared/harvesting.json`: HP/wymiary/nagrody; `shared/resources.json`: 32 źródła; `shared/shelter.json`: granice bazy, wymiary Shelteru i bilans mocy. Te same pliki są kopiowane do serwera. Walka/budowanie: `client/src/domain/config.ts`; miasto: `client/src/world/WorldLayout.ts`. Geometria pozostaje prototypowa, bez zewnętrznych modeli i tekstur.

## Weryfikacja

~~~powershell
cd client
npm test
npm run build
# Z katalogu głównego:
dotnet build server/FantasyShelter.Server.csproj
./server/tests/Smoke.Tests.ps1
~~~

**64 testy klienta**: cykl/fale, losowe spawny, trasy, dłuższe przebiegi hordy, walka, harvesting, budowanie, wieże, kompletny zapis i fallback. Babylon NullEngine sprawdza raycasty, kolizje, wejście i wyjście z wnętrza, wiele modeli zombie oraz usuwanie zwłok. Testy sprawdzają także budowę 10 wież bez odcięcia tras, bramy, kierunek do bazy i strzały ponad niskim murem.

**16 kontroli integracyjnych serwera**: HTTP i osobna SQLite na porcie 5081, odrzucanie błędnych zapisów, historia bez duplikatów, checkpoint i wyniki zachowane po restarcie. Skrypt wymaga PowerShell 7. Build klienta i serwera przechodzi; Vite zgłasza ostrzeżenie o rozmiarze pakietu Babylon.js.

Scena, żelazo, oświetlenie i HUD są sprawdzane w przeglądarce. Strona deweloperska `http://127.0.0.1:5173/tests/visual/preview.html` pozwala oglądać dzień/noc bez pointer lock; jej zegar przesuwają przyciski. Nie trafia do produkcyjnego `dist`.

## Kolejne etapy

**9: ulepszenia Shelteru**, następnie **10: drzewka Combat, Survival i Builder**. Dalej naprawy i niszczenie infrastruktury, ekonomia kolejnych dni, animacje/audio oraz symulacja serwerowa i multiplayer. SQLite wystarcza dla obecnego lokalnego zapisu; PostgreSQL można dodać przez drugi adapter RunStore.

#   S h e l t e r - W e b  
 