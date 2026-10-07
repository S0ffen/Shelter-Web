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
| GET | /api/health | Stan, SQLite, schemaVersion 2, checkpointVersion 13 |
| GET | /api/config | Survival, ekonomia, Skażenie, perki, budynki, mapa, bossowie, noce i obrona |
| GET | /api/checkpoint | JSON slotu lub 204 |
| PUT | /api/checkpoint | Walidacja i atomowe zastąpienie |
| POST | /api/runs | Wynik won/lost, idempotentny według RunId |
| GET | /api/runs | Ostatnie 20 wyników z Outcome |

Limit żądania: 256 KiB. CORS: lokalne Vite/preview 5173/4173. Błędny checkpoint/wynik zwraca 400.

## Checkpoint v13 i SQLite v2

Zapis obejmuje gracza, poziom/HP/cooldown naprawy rdzenia, bank i plecak Wood/Iron, Skażenie i timer obrażeń, punkty i rangi 33 perków z wymaganiami poziomów oraz aktywne umiejętności, konstrukcje z HP, 48 źródeł, zombie z trybem, spowolnieniem i przygotowaniem ataku; stan zamkniętej areny, cel/cooldown/trwanie szarży i timery przywołań bossa, cykl, spawny, losowość, miecz, wieże, pociski, strażników i wynik active/won/lost. Moc Arcane wynika z konstrukcji. Meshe nie są zapisywane; trasy są odtwarzane po wczytaniu.

Walidacja odrzuca aktywną arenę bez żywego bossa, gracza poza zamkniętą areną i szarżę zwykłego zombie. Walidacja sprawdza wersję, komplet źródeł, granice mapy/bazy, stanowiska generatorów, bank/plecak, perki i punkty zgodne z dniem, HP/cooldowny wynikające z rozwoju, typy zombie, ataki bossów i zgodność wyniku z HP/flagą bossa. Zbieralny Arcane i fałszywe zwycięstwo są odrzucane. Wersja obu aplikacji wynika z `shared/checkpoint.json`.

Zapisy v1–v12 wymagają nowej próby. Stary checkpoint pozostaje w SQLite do normalnego zapisu nowego runu. Zakończenie nadpisuje slot stanem terminalnym, aby odświeżenie nie wznawiało zakończonej próby; wynik trafia także do historii.

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

**55 kontroli HTTP/SQLite przechodzi.** Osobny serwer na 5081 i baza w server/test-results. Sprawdzono checkpoint v13, odrzucanie błędnych wartości, perki/HP, bossów, wynik, idempotencję, trwałość po restarcie oraz migrację starej SQLite v1 → v2. Testy nie zmieniają bazy gry na 5080. Test migracji wymaga Node z node:sqlite (zweryfikowano Node 24).

Verify-Milestone.ps1 kompiluje do verification/server, więc nie koliduje z działającą grą. Logi wszystkich 12 etapów są w verification/.
