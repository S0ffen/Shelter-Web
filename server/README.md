# Fantasy Shelter — serwer prototypu

ASP.NET Core 8 + Microsoft.Data.Sqlite. Serwer zapisuje próby i historię w SQLite, udostępnia wspólną konfigurację i sprawdza strukturę oraz granice danych. Symulacja walki, ruchu i dnia/nocy nadal działa w kliencie. API jest fundamentem do późniejszego przeniesienia autorytetu gry na serwer i dodania SignalR.

## Uruchomienie

W katalogu głównym projektu:

```powershell
dotnet restore server/FantasyShelter.Server.csproj
dotnet run --project server/FantasyShelter.Server.csproj --no-launch-profile
```

Adres: `http://127.0.0.1:5080`. Baza **server/Data/shelter.db** powstaje automatycznie. Nie potrzebuje konta, hasła ani zewnętrznej usługi. Zapis jest wspólny dla lokalnej instalacji — jeden slot aktualnej próby.

Klient domyślnie korzysta z tego adresu. Jeśli serwer jest niedostępny, zapisuje w localStorage tej przeglądarki. Zapis automatyczny: początek/wznowienie próby, co 20 sekund, pauza i początek kolejnego dnia. W pauzie jest przycisk „Zapisz próbę”; w menu startowym „Wznów zapis”. Przy uruchomieniu wybierany jest nowszy poprawny zapis z przeglądarki albo SQLite. Załadowanie zatrzymuje zegar do przechwycenia kursora. Wynik przegranej jest dopisywany do historii, bez nadpisywania ostatniego żywego checkpointu.

Adres API można zmienić przez `VITE_API_URL` w środowisku Vite. Katalog bazy: parametr `--DataDirectory <ścieżka>`. Wspólne dane są w `shared/survival.json`, `shared/harvesting.json` , `shared/resources.json` i `shared/shelter.json`. Podczas build/publish są kopiowane do serwera.

## API

| Metoda | Endpoint | Działanie |
| --- | --- | --- |
| GET | /api/health | Stan serwera, typ bazy, wersja schematu bazy i checkpointu |
| GET | /api/config | Parametry survivalu, bazy i mocy |
| GET | /api/checkpoint | Aktualny zapis lub 204, jeśli go nie ma |
| PUT | /api/checkpoint | Walidacja i atomowe zastąpienie checkpointu |
| POST | /api/runs | Wynik próby, bez duplikatów przy ponowieniu |
| GET | /api/runs | Ostatnie 20 wyników |

Checkpoint wersji 2 zawiera gracza, Shelter, zasoby, HP wszystkich źródeł, budynki, zombie, cykl dnia/nocy, kolejkę spawnu, stan generatora losowego, cooldown miecza, wieże i pociski. Drogi przez ruiny są wyznaczane ponownie po wczytaniu. Materiały obejmują tylko Wood i Iron; moc Arcane wynika z konstrukcji. Serwer odrzuca zasób Arcane i konstrukcje poza granicami bazy. Zapis wersji 1 wymaga rozpoczęcia nowej próby, ponieważ zmienił się układ mapy; istniejący checkpoint pozostaje w SQLite do zapisu nowej próby. Nie są zapisywane meshe ani dane renderera.

SQLite używa WAL, parametryzowanych zapytań i tabel Checkpoints, Runs oraz SchemaInfo. Warstwa RunStore oddziela bazę od endpointów. Zmiana na PostgreSQL będzie wymagać drugiego adaptera i migracji danych, bez zmiany formatu checkpointu.

Serwer domyślnie nasłuchuje na loopback; CORS dopuszcza lokalny Vite i preview. To lokalny prototyp bez kont i uwierzytelniania. Wyniki oraz stan przysyła klient, więc nie stanowią wiarygodnego rankingu multiplayer. Przed udostępnieniem serwera poza komputerem trzeba wdrożyć sesje, uprawnienia do zapisów i serwerową walidację komend gameplayu.

## Weryfikacja

```powershell
dotnet build server/FantasyShelter.Server.csproj
./server/tests/Smoke.Tests.ps1
```

Wszystkie **16 kontroli integracyjnych** przechodzą. Test wymaga PowerShell 7. Uruchamia własny serwer na 5081, korzysta z odrębnej bazy w server/test-results, sprawdza zapis/odczyt, odrzucanie błędnych danych, brak duplikatów historii i trwałość po restarcie. Nie zmienia bazy gry na 5080.

Dokumentacja użytych API: [Minimal APIs](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/minimal-apis?view=aspnetcore-8.0), [Microsoft.Data.Sqlite](https://learn.microsoft.com/en-us/dotnet/standard/data/sqlite/).
