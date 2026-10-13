# Tekstury Fantasy Shelter — 9 października 2026

## Aktualne materiały otoczenia — etap 28

Cztery zestawy dostarczone przez gracza z katalogu `models/` zastępują wcześniejsze materiały głównych powierzchni:

| Zestaw | Zastosowanie |
| --- | --- |
| `medieval_wall_02` | Elewacje starych domów, kamienne elementy Shelteru, obramowania i mury pita |
| `roof_slates_02` | Spadziste dachy domów, Shelteru i magazynów, iglice |
| `weathered_planks` | Drewniane belki, drzwi, okiennice, depozyt, barykady i magazyny |
| `cobblestone_01` | Bruk ulic oraz podłoże Shelteru |

Każdy zestaw używa albedo, oryginalnej mapy normalnych i oryginalnej mapy szorstkości. Pliki EXR przekonwertowano do liniowych danych 8-bit; wektory normalnych przeskalowano i znormalizowano. Wersje gry mają 2048 × 2048 px: albedo WebP jakość 92, normalne/szorstkość WebP bezstratne. Łącznie 12 map, **35,64 MiB**. Oryginały 4K i pliki `.blend` pozostały nietknięte.

Renderer wykorzystuje PBR: albedo sRGB, normalne i roughness liniowe, brak metaliczności. Szorstkość czytana jest z zielonego kanału; normalne OpenGL mają odwrócony Y materiału dla proceduralnych brył Babylon. [Referencja kierunku normalnych](https://doc.babylonjs.com/features/featuresDeepDive/materials/using/normalMaps).

Mapy są współdzielone przez całą scenę i warianty kolorystyczne; mipmapy, filtrowanie trójliniowe i anizotropowe ×8. Powtórzenie wynosi 2 m. Bruk zachowuje ciągłe UV w przestrzeni świata, deski biegną wzdłuż dłuższego wymiaru elementu, a rzędy dachówek wzdłuż kalenicy. Dekoracje PBR nadal łączone są według materiału i odbierają cienie.

Pliki: `client/public/textures/environment/<zestaw>/{albedo,normal,roughness}.webp`. Manifest zawiera rozmiary i SHA-256 źródeł/wyników: `environment/manifest.json`. Odtworzenie: `python scripts/prepare-environment-textures.py` (numpy, Pillow/WebP, OpenCV/OpenEXR). Weryfikacja: `verification/28-environment-textures.json` oraz `verification/28-environment-textures/assets.json`. Zmiana nie modyfikuje mapy, kolizji ani formatu checkpointu v17.

## Wcześniejsze atlasy

Wygenerowane wcześniej narzędziem **imagegen** materiały pozostają dla ziemi, metalu, źródeł surowców oraz proceduralnych nieumarłych/bossów. Główne powierzchnie miasta korzystają już z zestawów gracza.

## Pliki gry

- `client/public/textures/environment-atlas.webp`: kamień, bruk, drewno, łupek, ziemia i metal; układ 3 × 2, źródło 1536 × 1024 px.
- `client/public/textures/undead-atlas.webp`: martwa skóra, szorstki len, skorodowany pancerz i kość; układ 2 × 2, źródło 1254 × 1254 px.
- Oryginały PNG: `reference-assets/generated-textures/`. Oryginały narzędzia pozostawiono również w katalogu wygenerowanych obrazów Codex.

Kopie dla gry zakodowano jako WebP, jakość 90; razem około 1,4 MB. Renderer wycina regiony atlasów do współdzielonych tekstur 512 px, tworzy mapy normalnych z luminancji, używa mipmap i filtrowania anizotropowego ×8. Skala materiałów na bryłach wynosi 2 m na powtórzenie; drobne elementy nieumarłych mają mniejsze powtórzenie. Barwy i flash trafienia są oddzielne dla każdego wroga, a mapy pozostają wspólne po usunięciu zwłok.

## Finalne prompty

### Materiały miasta

Use case: stylized-concept. Asset type: production 3D game diffuse texture atlas for a gritty dark fantasy ruined medieval city, realistic worn materials, inspired by the aged detailed textures of an early Counter Strike survival map but medieval. EXACT atlas layout: three equally sized columns and two equally sized rows, six square texture tiles edge-to-edge, absolutely no margins or gaps. Top-left: weathered pale gray beige limestone masonry, irregular smaller hand-cut stone blocks, dark recessed lime mortar, tiny chips and sparse moss. Top-middle: street paving with small irregular gray cobblestones, dirt in seams and subtle damp patches, no plank pattern. Top-right: dark rough oak timber planks, visible wood fibers and scratches, no large nails. Bottom-left: worn charcoal blue gray overlapping roof slate tiles, chipped edges, subtle lichen. Bottom-middle: rough dark dirt and small rocks, muted olive moss. Bottom-right: weathered forged iron plates, fine pits, dark rust along irregular scratches, no symbols. Each square tile is a flat seamless tiling albedo texture, consistent scale and equal lighting, straight orthographic surface scan, no perspective, no directional cast shadows, no baked specular highlights, no objects, no text or labels, no borders, no watermark. High tactile detail, believable medieval materials, muted desaturated palette, readable small grains, avoid cartoony smooth surfaces and repetitive perfect rectangles. Atlas landscape 3:2.

### Materiały nieumarłych

Use case: stylized-concept. Asset type: production 3D game diffuse material atlas for dark fantasy undead enemies. EXACT atlas layout: two equal columns and two equal rows, four seamless square material textures, edge-to-edge with absolutely no gaps, labels or borders. Top-left: pallid gray green dead skin, extremely fine cracked leathery texture and faint bruised veins, dry and ancient, subtle scars, not gore, no face or body silhouette. Top-right: rough tattered dark umber woven linen with tiny frayed fibers, small worn patches and dusty threads, dense material texture not clothing silhouette. Bottom-left: oxidized black iron armor, pitted forged metal, desaturated reddish brown rust in cuts, fine chipped edges and scratches, no heraldry or glyphs. Bottom-right: aged yellowish ivory bone texture with fine porous grains, hairline fissures and subtle gray dirt, no recognizable bones or skull silhouette. All tiles have realistic texture detail fit for undead peasants, ragged ghouls and cursed armored knights in a dark medieval city. Flat orthographic uniformly lit diffuse albedo surfaces, no directionally baked light, no highlight, no 3D scene, no objects, no text, no watermarks. Each region must independently tile seamlessly. Muted earthy dark fantasy palette, detailed but readable, avoid bright plastic and oversized markings. Square 1:1 atlas.
