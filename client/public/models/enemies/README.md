# Modele przeciwników — Pixabay

Etap 27 zakończony — trzy szkielety i dziewięć animacji. Trzy pliki dostarczone przez gracza w `models/` są aktywne w grze. Kopie do przeglądarki zostały zoptymalizowane; źródła pozostają niezmienione.

| Przeciwnik | Model / autor | Plik w grze | Wierzchołki | Trójkąty | Rozmiar |
| --- | --- | --- | ---: | ---: | ---: |
| Hollow (`normal`) | [Skeleton Warrior — PixelLabs](https://pixabay.com/3d-models/skeleton-warrior-undead-knight-4237/) | hollow-warrior.glb | 13 727 | 11 996 | 4 196 632 B |
| Armoured Knight / Fallen Guard (`tank`) | [Dark Fantasy Knight — PixelLabs](https://pixabay.com/3d-models/dark-fantasy-knight-undead-warrior-3471/) | undead-knight.glb | 14 356 | 11 998 | 4 404 492 B |
| Feral (`fast`) | [Bigfoot Ghoul — HauntSync](https://pixabay.com/3d-models/bigfoot-ghoul-horror-creature-1716/) | feral-ghoul.glb | 66 846 | 41 507 | 6 167 020 B |

Łącznie: **14 768 144 B**, zamiast **81 491 888 B** źródeł. Każdy GLB zawiera trzy tekstury 1024 × 1024: kolor, normalne i metal/roughness. Nie ma zewnętrznych tekstur, Draco, Meshopt ani pobierania dekoderów z CDN. Dodano tangenty MikkTSpace; poprawiono 39 nieprawidłowych normalnych w Feral i tangenty zdegenerowanych UV. Wszystkie pliki: **glTF Validator 0 błędów / 0 ostrzeżeń**.

Importer zachowuje proporcje i tekstury źródeł, ustawia stopy na podłożu i normalizuje wysokość do 1,9 m / 2,3 m / 1,8 m. Etap 27 utrwala osie w geometrii: przód +Z, stopy Y=0, wysokość 1. Runtime nadaje docelową wysokość. Skorygowano rzeczywisty kierunek twarzy Hollow; nie potrzebuje dodatkowego obrotu w manifestcie. Geometria i tekstury są współdzielone; trafienie ma niezależny flash danego przeciwnika. Modele wczytują się wcześniej, a w czasie wczytywania lub przy błędzie pozostaje dotychczasowy wygląd. Restart usuwa aktorów i zachowuje cache dla sceny; zamknięcie sceny zwalnia cache.

Oryginalne pliki gracza nie zawierają szkieletów ani animacji. Kopie używane w grze mają teraz **17 kości oraz trzy klipy: Walk, Run i Attack**. Poruszają się nogi, ręce, tułów i głowa; broń i pazury mają przygotowane przypisania. Rycerz ma cięższy chód i zamach, Hollow atakuje toporem, Feral uderza pazurami. Animacje są proste: bez IK stóp i symulacji tkanin. Śmierć nadal wykorzystuje proceduralny upadek całego modelu; bossowie zachowują własne modele.

Każdy aktor ma osobny szkielet i cele animacji, wspólnie korzystając z geometrii oraz tekstur. Runtime wybiera Walk/Run według rzeczywistej prędkości, z uwzględnieniem nocnego przyspieszenia, a Attack odtwarza po rozpoczęciu ataku. Przejścia trwają 0,12 s; pauza zatrzymuje odtwarzanie, bezruch przywraca pozę spoczynkową. Stała większa obwiednia renderowania obejmuje zamach broni, bez zmiany hitboxa.

Wagi są normalizowane, współdzielone w miejscach szwów UV i wygładzane po siatce trójkątów. To usuwa ostre rozciąganie na granicy broni, kończyn i tkanin. Testy obejmują deformację przy ataku oraz zachowanie tekstur, UV, indeksów i proporcji. Weryfikacja wszystkich trzech GLB po rigowaniu: 0 błędów i 0 ostrzeżeń.

Źródła sprawdzono 8 października 2026 r. Licencja: [Pixabay Content License](https://pixabay.com/service/license-summary/). Modele są wykorzystane i dostosowane jako element Fantasy Shelter. Autorzy otrzymują kredyt powyżej.

## Odtworzenie optymalizacji

W katalogu projektu:

```powershell
npm ci --prefix scripts/model-tools
pwsh -NoProfile -File scripts/prepare-enemy-models.ps1
```

Skrypt optymalizuje GLB, następnie wywołuje `scripts/model-tools/rig-enemies.mjs`, korzystający z `rig-profiles.json`. Samo ponowne wygenerowanie rigów: `node scripts/model-tools/rig-enemies.mjs`; używa kopii statycznych w `verification/27-enemy-animation/` i nie nakłada szkieletu ponownie. Skrypt używa lokalnych źródeł z `models/`, nie pobiera modeli i sprawdza, że ich SHA-256 nie zmienia się. Raporty z hashami, wymiarami tekstur i walidacją: `verification/pixabay-models/*-asset.json`. GLB Transform 4.5.1, MikkTSpace 1.1.1; wersje zależności utrwala lockfile narzędzi. Narzędzia offline nie są potrzebne do uruchomienia gry.

## Kontrola

35 testów modeli/animacji obejmuje rzeczywiste GLB, skinning, kości i macierze bind pose, wszystkie dziewięć klipów, niezależność szkieletów, poprawność wag i ich zgodność na szwach, niezmienione UV/tekstury/proporcje, normalizację wysokości, culling oraz rozciąganie trójkątów przy ataku. Mieszana horda 48 aktorów współdzieli geometrię i tekstury.

Podglądy CPU i animowane GIF-y: `verification/27-enemy-animation/*-animation-review.png` i `*-animations.gif`. Renderują faktyczny skinning i tekstury z GLB; są kontrolą assetów, nie zrzutami gry. Interfejs przeglądarki pozostaje niedostępny z błędem Windows helper; nie wykonano pomiaru GPU/FPS.

Cały etap: **262 testy klienta / 43 pliki**, **98 kontroli HTTP/SQLite**, oba buildy poprawne. Checkpoint nadal **v17**, schema SQLite **v2**. Istniejący zapis ma identyczny hash przed i po weryfikacji, a źródłowe pliki w `models/` są niezmienione. Raport: `verification/27-enemy-animations.json`. Wszystkie trzy animowane GLB są w `dist` i odpowiadają plikom serwowanym przez Vite HTTP 200.
