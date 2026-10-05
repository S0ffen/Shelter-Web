# Fantasy Shelter — aktualny stan projektu

Stan na: **5 października 2026 r.**

Działa przeglądarkowy FPS survivalowy: eksploracja, zbieranie, budowa bazy, patrole, rosnące hordy, dzień/noc i zapis SQLite. Ukończone są milestone’y **1–6, 6.5, 7 i 8**. Ostatnia zmiana przebudowała Shelter i zastąpiła zbieralny Arcane mocą generatorów.

## Ostatnie poprawki — baza i Arcane jako Power

- Budowanie tylko na terenie bazy: gracz i cały obrys konstrukcji muszą znajdować się w jej granicach.
- Dziedziniec **28 × 26 m**, niski mur z czterema bramami i dziesięć sugerowanych stanowisk wieżyczek po bokach Shelteru.
- Dostępne wnętrze **8 × 7 m**, otwarte wejście szerokości 3 m; rzeczywiste kolizje ścian pozwalają wejść i wyjść.
- Budynki nie mogą zajmować wnętrza, wejścia ani chronionych przejść. Walidacja sprawdza również trasy zombie.
- Arcane jest wyłącznie mocą: generator daje **40**, wieżyczka rezerwuje **10**, magazyn **5**. Moc nie zużywa się z czasem ani przy strzale.
- HUD pokazuje moc **wolną / całkowitą**, kierunek i odległość do Shelteru oraz rozpoznaje wejście do wnętrza. Nad bazą jest świetlny znacznik.
- Usunięto osiem zbieralnych kryształów Arcane i ich pojemność w magazynie. Zbierasz Wood i Iron.
- Ruiny i najbliższe źródła przesunięto poza dziedziniec. Wieże strzelają ponad niskim murem; wysokie ściany nadal blokują ostrzał.
- Checkpoint **wersji 2** zapisuje nowe materiały i konstrukcje. Poprzednia próba wymaga rozpoczęcia nowej gry z powodu zmiany mapy.

Referencja: obejrzane fragmenty [Zombie Shelter Co-op — City of Damned](https://www.youtube.com/watch?v=w5bPBMt6yJ4). Układ i zasada zasilania zostały dostosowane do fantastycznego stylu; koszty stanowią balans tego prototypu.

## Ukończone etapy

| Etap | Co działa |
| --- | --- |
| 1 — rozgrywka | FPS, WASD, mysz, pointer lock, miecz, HP, śmierć, pauza i restart. |
| 2 — materiały | Wood i Iron, liczniki, źródła z HP i progami nagród. Arcane zmieniony na moc. |
| 3 — budowanie | Storehouse, Generator Arcane, Magic Tower; podgląd, obrót, koszty i walidacja bazy. |
| 4 — Storehouse | Większa pojemność materiałów; przy pełnym magazynie nagroda pozostaje w źródle. |
| 5 — moc | Generatory zwiększają moc; magazyny i wieże rezerwują jej część. |
| 6 — wieże | Wybór widocznego celu z hordy, obrót głowicy, pociski i obrażenia. |
| 6.5 — mapa | Miasto 96 × 98 m, dziesięć dzielnic, 32 skończone źródła, zbieranie mieczem. |
| 7 — zombie | Losowe spawny, dzienne patrole, nocne hordy i nawigacja przez miasto. |
| 8 — dzień/noc | Przygotowania, zmierzch, oblężenie, świt po oczyszczeniu fali i zachowanie stanu. |
| Serwer | ASP.NET Core 8, SQLite, API, walidacja, zapis, wczytywanie i historia wyników. |

## Jak wygląda próba

1. Dzień trwa **150 sekund**. Cztery patrole krążą po mieście i atakują pobliskiego gracza; ubytki są uzupełniane co 20 sekund.
2. Zbierasz materiały poza bazą i wracasz z nimi, korzystając ze strzałki. Najpierw budujesz generator, później magazyn i wieże. **N przy Shelterze** rozpoczyna noc wcześniej.
3. Noc uzupełnia falę do 8 przeciwników; każda kolejna noc zwiększa ją o 4, do 64. Spawny co 2 sekundy, maksymalnie 24 żywych naraz.
4. Pozycje są losowane w dziesięciu strefach, co najmniej 10 m od gracza, z dostępną trasą. Zombie omijają ruiny, źródła i budynki.
5. Po minimum **45 sekundach**, wyczerpaniu kolejki spawnu i zabiciu wszystkich wrogów zaczyna się następny dzień. HP, zasoby, konstrukcje i wyczerpane źródła pozostają.
6. Zabicie jednego zombie nie kończy gry. Śmierć gracza lub zniszczenie Shelteru oznacza przegraną.

HUD pokazuje dzień, czas, zombie, spawny i zabójstwa. Oświetlenie oraz mgła zmieniają się płynnie. Pauza zatrzymuje symulację, AI, fale i zegar.

## Mapa, materiały i konstrukcje

Dzielnice: Schronienie, Cmentarz, Stare Miasto, Rynek, Świątynia, Slumsy, Kuźnia, Las, Brama i Kopalnie. Żelazo wygląda jak nieregularne ciemne skały z fragmentami rudy. Geometria jest nadal prototypowa.

| Źródło | HP | Nagrody przy HP | Liczba | Pula mapy |
| --- | ---: | --- | ---: | ---: |
| Powalony pień | 100 | 75 / 50 / 25: po 3 Wood; 0: 5 Wood | 16 | 224 Wood |
| Złoże żelaza | 160 | 120 / 80 / 40 / 0: po 2 Iron | 16 | 128 Iron |

LPM zbiera w zasięgu 3 m. Każdy próg daje nagrodę raz; zniszczony obiekt znika i zwalnia kolizję. Nowy dzień nie odradza materiałów; robi to nowa próba. Początkowe limity: **100 Wood / 50 Iron**. Cała nagroda musi zmieścić się w magazynie.

| Konstrukcja | Koszt | Efekt |
| --- | --- | --- |
| Storehouse | 30 Wood + 10 Iron | +50 Wood i +25 Iron pojemności; zajmuje 5 mocy |
| Generator Arcane | 20 Wood + 15 Iron | +40 mocy całkowitej |
| Magic Tower | 20 Wood + 15 Iron | Zajmuje 10 mocy; zasięg 12 m |

Budowanie w zasięgu 6 m ma podgląd, obrót i powód blokady w HUD. Nieudana budowa nie pobiera zasobów. Dziesięć stanowisk opisuje dostępną przestrzeń; nie daje darmowych materiałów ani wież.

Miecz: **34 obrażenia / 0,65 s**; wieża: **25 obrażeń / 1,2 s**, lecące pociski. Gracz i zombie: **100 HP**; Shelter: **300 HP**.

## Zapis i backend

ASP.NET Core 8 + Microsoft.Data.Sqlite na **127.0.0.1:5080**. Baza **server/Data/shelter.db** powstaje automatycznie. Jeden slot checkpointu i historia 20 ostatnich wyników. Gameplay nadal jest symulowany w kliencie.

Autosave: początek/wznowienie próby, co 20 sekund, pauza i nowy dzień. Ręczny zapis jest w pauzie. Wczytanie przywraca HP, pozycję, materiały, źródła, budynki, zombie, cykl, kolejkę, losowość, cooldowny i pociski. Moc wynika z budynków. Próba pozostaje zatrzymana do przechwycenia kursora.

Przy niedostępnym API zapis działa w localStorage. Wybierany jest nowszy poprawny checkpoint. Przegrana dopisuje wynik, zachowując ostatni żywy zapis. Lokalny zapis wersji 1 pozostaje pod starym kluczem; nie jest wczytywany do zmienionej mapy. SQLite zachowuje poprzedni checkpoint do normalnego zapisu nowej próby.

Serwer waliduje wersję, granice, materiały i kompletność identyfikatorów, odrzuca zbieralny Arcane i konstrukcje poza bazą. SQLite używa WAL i zapytań parametryzowanych. Multiplayer i autorytatywna symulacja wymagają dalszego etapu.

## Technika i sprawdzenie

TypeScript + Babylon.js + Vite, HUD HTML/CSS, bez Reacta. Modele oddzielone od renderera. Symulacja **30 Hz**, decyzje AI i dobór celu wież **5 Hz**. Wspólna siatka uwzględnia aktualne przeszkody; zwłoki znikają po 3 sekundach.

Wspólne dane: **shared/survival.json**, **harvesting.json**, **resources.json** i **shelter.json**. Określają fale, harvesting, 32 źródła oraz bazę i moc; te same pliki są kopiowane do serwera.

Weryfikacja: **64 testy klienta i 16 kontroli HTTP/SQLite przechodzą**. Build TypeScript/Vite i .NET przechodzi. Vite nadal ostrzega o rozmiarze pakietu Babylon.js.

Testy obejmują wejście i wyjście przy rzeczywistych kolizjach Babylon, budowę 10 wież bez odcięcia tras, bramy, moc bez osobnego materiału, wskaźnik bazy, ostrzał ponad murem, fale, walkę, harvesting i zapis. Testy serwera korzystają z osobnej SQLite i potwierdzają trwałość po restarcie.

Dziedziniec z wieżami, wejście, wnętrze i wskaźnik zostały sprawdzone w przeglądarce. Podgląd testowy przesuwa zegar przyciskami, ma własne finansowanie demonstracyjnych konstrukcji i nie trafia do produkcyjnego builda. Sterowanie FPS z pointer lock wymaga próby w Chrome/Edge, ponieważ przeglądarka Codex może je blokować.

## Sterowanie i dalsze prace

WASD + mysz; LPM: miecz/harvesting; **B**: budowanie; **1/2/3**: Storehouse/Generator/Wieża; **Q**: obrót; PPM: anulowanie; **N** przy bazie: wcześniejsza noc; **Escape**: pauza; **R**: nowa próba. Utrata fokusu zatrzymuje grę.

Kolejne etapy: ulepszenia Shelteru, drzewka Combat/Survival/Builder, naprawianie i niszczenie konstrukcji, ekonomia dłuższych prób, typy wrogów, animacje/audio oraz multiplayer i symulacja serwerowa.

Uruchomienie i architektura: [README.md](README.md). API: [server/README.md](server/README.md).