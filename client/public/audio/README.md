# Oryginalne dźwięki CSNZ

Pliki odczytane z instalacji przekazanej przez gracza: `D:/steam/steamapps/common/CSNZ/Data/cstrike.nar`.

| Zdarzenie | Wpis w archiwum | Asset klienta |
| --- | --- | --- |
| Zdobycie materiałów | `/cstrike/sound/shelter/zsh_resouceget.wav` | `client/src/assets/audio/resource-get.wav` |

WAV jest identyczny bajtowo z plikiem w archiwum. Mono, PCM 8-bit, 22050 Hz. Bez cięcia, zmiany wysokości, filtrów lub syntetycznej nakładki. Vite nadaje assetowi hash zawartości. Raport SHA-256: `verification/csnz-audio/resource-cue-only.json`.

Przy zbieraniu Wood i Iron odtwarzany jest wyłącznie sygnał zdobycia materiału, po faktycznym przyznaniu zasobów. Uderzenia w źródła są bez dźwięku. Poprzedni odgłos `axe_hitwall.wav` pozostaje jedynie materiałem porównawczym w `verification/csnz-audio/` i nie trafia do buildu klienta.

Znaleziono także muzykę i pozostałe odgłosy Shelteru. Ambient i muzyka pozostają wyłączone zgodnie z prośbą gracza. Dźwięki są odtwarzane wyłącznie po zdarzeniach gry i po odblokowaniu audio gestem użytkownika.

Czytnik archiwum działa tylko do odczytu i wydobywa wskazane pliki do katalogu projektu. Opis formatu sprawdzono w [NARTools](https://github.com/SmilexGamer/NARTools). Instalacja gry pozostaje niezmieniona.

```powershell
python scripts/read-csnz-nar.py 'D:\steam\steamapps\common\CSNZ\Data' --match 'zsh_resouceget\.wav$' --extract
Copy-Item verification/csnz-audio/zsh_resouceget.wav client/src/assets/audio/resource-get.wav
```

Poprzednią próbkę z [gameplayu od 04:31](https://www.youtube.com/watch?v=w5bPBMt6yJ4&t=271) zachowano w `verification/audio-reference/previous-video-harvest.wav`. Skrypt wycinający nagranie zapisuje teraz wyłącznie materiał porównawczy i nie zastępuje assetu z instalacji.
