# Fantasy Shelter — serwer zapisu

ASP.NET Core 8 + Microsoft.Data.Sqlite. Serwer przechowuje checkpoint i historię wyników, udostępnia konfiguracje i waliduje format oraz granice danych. Rozgrywka pozostaje symulowana w kliencie.

## Uruchomienie

Z katalogu głównego:

```powershell
dotnet restore server/FantasyShelter.Server.csproj
dotnet run --project server/FantasyShelter.Server.csproj --no-launch-profile --urls http://127.0.0.1:5080
```

Baza `server/Data/shelter.db` powstaje automatycznie. Katalog zmienisz przez `--DataDirectory <ścieżka>`, adres klienta przez `VITE_API_URL`. Dane shared/*.json są kopiowane do katalogu build/publish.

Jeden slot lokalnej instalacji. Bez API klient używa localStorage i wybiera nowszy poprawny checkpoint. Aktywny run czeka na przechwycenie kursora; zakończony pokazuje wynik. Autosave: start/wznowienie, 20 s, pauza, świt, perki, strażnik i zakończenie.

## API

| Metoda | Endpoint | Działanie |
| --- | --- | --- |
| GET | /api/health | Stan, SQLite, schemaVersion 2, checkpointVersion 17 |
| GET | /api/config | Survival, ekonomia, Skażenie, perki, budynki, mapa, bossowie, noce i obrona |
| GET | /api/checkpoint | JSON slotu lub 204 |
| PUT | /api/checkpoint | Walidacja i atomowe zastąpienie |
| POST | /api/runs | Wynik won/lost, idempotentny według RunId |
| GET | /api/runs | Ostatnie 20 wyników z Outcome |

Limit żądania: 256 KiB. CORS: lokalne Vite/preview 5173/4173. Błędny checkpoint/wynik zwraca 400.

## Checkpoint v17 i SQLite v2

Zapis obejmuje gracza, poziom/HP/cooldown naprawy rdzenia, bank i plecak Wood/Iron, Skażenie i timer obrażeń, punkty i rangi 33 perków z wymaganiami poziomów oraz aktywne umiejętności, konstrukcje z HP i poziomem (generator I–IV, pozostałe I), 48 źródeł, zombie z trybem, spowolnieniem i przygotowaniem ataku; stan zamkniętej areny, cel/cooldown/trwanie szarży i timery przywołań bossa, cykl, spawny, losowość, miecz, wieże, pociski, strażników i wynik active/won/lost. Moc Arcane wynika z konstrukcji. Meshe nie są zapisywane; trasy są odtwarzane po wczytaniu.

Walidacja odrzuca aktywną arenę bez żywego bossa, gracza poza pitem albo na poziomie ulicy podczas aktywnej walki i szarżę zwykłego zombie. Walidacja sprawdza wersję, komplet źródeł, granice mapy/bazy, stanowiska generatorów, bank/plecak, perki i punkty zgodne z dniem, HP/cooldowny wynikające z rozwoju, typy zombie, ataki bossów i zgodność wyniku z HP/flagą bossa. Zbieralny Arcane i fałszywe zwycięstwo są odrzucane. Wersja obu aplikacji wynika z `shared/checkpoint.json`.

Zapis obejmuje `player.respawnRemaining` i `player.protectionRemaining`. Aktywny run może mieć HP gracza równe zero tylko z trwającym odliczaniem odrodzenia. Żywy gracz nie może mieć odliczania, martwy nie może mieć ochrony. Wynik lost wymaga zniszczonego rdzenia; sama śmierć gracza nie jest przegraną. Parametry odrodzenia są dostępne przez `/api/config.player` i pochodzą ze wspólnego `player.json`.

Zapisy v1–v13 wymagają nowej próby. Stary checkpoint pozostaje w SQLite do normalnego zapisu nowego runu. Zakończenie nadpisuje slot stanem terminalnym, aby odświeżenie nie wznawiało zakończonej próby; wynik trafia także do historii.

SQLite używa WAL i zapytań parametryzowanych. Tabele: Checkpoints (slot 1), Runs (wyniki), SchemaInfo (migracje). Schemat v2 automatycznie i powtarzalnie dodaje Outcome, z lost dla wcześniejszych wyników, zachowując historię i checkpointy. RunStore oddziela bazę od endpointów.

API nasłuchuje lokalnie, bez kont i uwierzytelniania. Wyniki przysyła klient; nie są autorytatywnym rankingiem. Multiplayer wymaga sesji i serwerowej walidacji rozgrywki.

## Weryfikacja

Pełna kontrola, PowerShell 7, z katalogu głównego:

```powershell
pwsh -NoProfile -File scripts/Verify-Milestone.ps1 -Stage manual-check
```

Sam serwer, przy wyłączonym procesie używającym zwykłego katalogu builda:

```powershell
dotnet build server/FantasyShelter.Server.csproj
pwsh -NoProfile -File server/tests/Smoke.Tests.ps1
```

**98 kontroli HTTP/SQLite przechodzi.** Osobny serwer na 5081 i baza w server/test-results. Sprawdzono checkpoint v17, indywidualne poziomy i HP generatorów, odrzucanie błędnych wartości, odrodzenie i ochronę, perki/HP, bossów, wynik, idempotencję, trwałość po restarcie oraz migrację starej SQLite v1 → v2. Testy nie zmieniają bazy gry na 5080. Test migracji wymaga Node z node:sqlite (zweryfikowano Node 24).

Verify-Milestone.ps1 kompiluje do verification/server, więc nie koliduje z działającą grą. Logi wszystkich 12 etapów są w verification/.


Etap 23: klient migruje checkpoint v14 do v15 z zachowaniem procentu HP i całego postępu. GET zwraca istniejący zapis; klient przekształca go przed przywróceniem, a następny PUT zapisuje v15. Walidator nowych zapisów korzysta ze wspólnych `defense.json` i `buildings.json`: rdzeń 1000/2000/3500 HP, konstrukcje 500/800/600 HP. Przeciwnicy w trybie siege są poprawni również podczas dnia — ocalałe zombie nie znikają o świcie. Schemat SQLite pozostaje v2; stary zapis i wyniki nie są usuwane. Kopia sprzed zmiany: `server/Data/backups/before-checkpoint-v15-20261007-221815.db`.


Etap 24: klient migruje v14 i v15 do v16 bez resetu postępu, zachowując procent HP i wcześniejszą moc generatorów. Nowe checkpointy zapisują indywidualny `buildings[].level`; walidator respektuje HP tego tieru, premie Engineer i poziom technologiczny rdzenia. Rdzeń może mieć cztery poziomy. Bardzo małe dodatnie HP po migracji jest poprawne i nie usuwa żywej konstrukcji. Dane budynków pochodzą z odzyskanych tabel oryginalnego klienta. SQLite pozostaje w schema v2; GET nie nadpisuje ani nie usuwa starego checkpointu.


Etap 25: klient migruje v14/v15/v16 do v17. Zapis obejmuje `player.height`, `player.verticalVelocity`, `zombies[].pursuitElapsed` i `zombies[].returning`. Granice fizyki pochodzą z `player.json`, poziomy pita z `encounters.json`. Kolejka/fala może liczyć 128 jednostek; tablica przeciwników do 128 wpisów mieści żywych, strażników i zwłoki. Walidator odrzuca zbyt głęboki gracz, niepoprawną prędkość spadania, stan pod ziemią poza areną, aktywną walkę na krawędzi oraz błędny timer powrotu. GET/config zwraca także lokalne korekty mapy w `mapAdjustments`.

Bieżąca kolejka fali i rozwój pozostają, a wcześniejsze domyślne ustawienia hord są aktualizowane przed następną nocą. Legacy gracz w aktywnej arenie trafia na jej dno; zapisani aktorzy wewnątrz nowych barykad są przesuwani miejscowo. Kopia sprzed zmiany: `server/Data/backups/before-checkpoint-v17-20261008-194516.db`. SQLite nadal schema v2; migracja checkpointu odbywa się w kliencie, bez nadpisywania danych przez GET.
