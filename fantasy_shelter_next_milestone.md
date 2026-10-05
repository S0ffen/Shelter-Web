# Prompt do agenta — Milestone 6.5: Exploration & Harvesting

Pracujemy nad projektem **Fantasy Shelter** — przeglądarkową grą 3D inspirowaną trybem Shelter z Counter-Strike Nexon: Zombies, ale osadzoną w klimacie dark fantasy.

Aktualny stack projektu:

- TypeScript
- Babylon.js
- Vite
- HTML/CSS do prostego HUD/UI
- bez Reacta
- lokalna symulacja po stronie klienta
- backend ASP.NET Core + SignalR planowany później

Aktualny projekt ma ukończone milestone’y 1–6:

- FPS movement
- miecz
- zombie
- Shelter z HP
- Wood i Iron
- budowanie Storehouse
- budowanie Arcane Core
- budowanie Magic Tower
- Arcane Power
- automatyczne atakowanie zombie przez Magic Tower

Przed implementacją fal zombie chcemy wykonać **Milestone 6.5 — Exploration & Harvesting**.

Nie implementuj jeszcze Milestone 7 ani systemu dnia/nocy.

---

# Główny cel

Chcemy odejść od obecnego systemu zbierania gotowych paczek Wood/Iron przyciskiem `E`.

Docelowo zasoby mają być zdobywane poprzez **fizyczne niszczenie obiektów w świecie**, podobnie jak w Nexon Zombies Shelter.

Gracz:

```text
widzi obiekt zasobowy
↓
podchodzi
↓
uderza go mieczem / narzędziem
↓
obiekt traci HP
↓
gracza otrzymuje zasób
↓
po całkowitym zniszczeniu obiekt znika
```

Jednocześnie chcemy rozwinąć mapę w kierunku większego, swobodnie eksplorowanego miasta dark fantasy.

---

# 1. Większa mapa / open world

Nie chodzi o ogromny open world w stylu Skyrim.

Chcemy jedną większą, ciągłą mapę bez ekranów ładowania, którą gracz może swobodnie eksplorować.

Mapa nadal ma zachować klimat Nexon Zombies Shelter:

- ruiny miasta
- labiryntowe uliczki
- wąskie przejścia
- place
- zaułki
- skróty
- różne drogi powrotne
- charakterystyczne landmarki
- Shelter mniej więcej w centrum świata

Mapa NIE powinna być dużym, pustym, otwartym polem.

Struktura powinna bardziej przypominać:

```text
Cemetery
    |
Old Town --- Market --- Temple
    |          |          |
 Slums ----- Shelter ---- Forge
    |          |          |
 Forest ----- Gate ------ Mines
```

Pomiędzy tymi sektorami mają znajdować się kręte uliczki i przejścia.

Mapa ma sprawiać wrażenie labiryntu, ale być możliwa do nauczenia.

Na obecnym etapie nadal używaj prostych placeholderów / brył Babylon.js.

Nie poświęcaj czasu na finalne modele.

---

# 2. Resource Nodes

Wprowadź nowy system `ResourceNode`.

ResourceNode jest obiektem świata posiadającym:

- typ zasobu
- aktualne HP
- maksymalne HP
- ilość zasobu
- pozycję
- collider / hit detection
- stan zniszczenia

Typy zasobów na MVP:

```text
Wood
Iron
Arcane
```

Kod powinien być zaprojektowany tak, aby później łatwo było dodać kolejne typy.

Preferowany model:

```ts
enum ResourceType {
    Wood,
    Iron,
    Arcane
}
```

oraz wspólna klasa/model np.:

```text
ResourceNode
├── resourceType
├── health
├── maxHealth
├── reward
├── position
└── isDestroyed
```

Nie twórz trzech całkowicie niezależnych systemów dla Wood, Iron i Arcane.

---

# 3. Wood

Wood nie powinien już występować głównie jako gotowa paczka do podniesienia.

Na mapie umieść obiekty takie jak:

- powalone drzewa
- sterty drewna
- stare drewniane wozy
- drewniane barykady
- fragmenty zniszczonych konstrukcji

Na MVP wystarczy jeden prosty model placeholderowy, np. powalony pień.

Przykładowe zachowanie:

```text
Fallen Tree

HP: 100

co określony próg obrażeń:
+ Wood

po całkowitym zniszczeniu:
bonus Wood
```

Przykładowe wartości:

```text
100 HP

co 25 damage:
+3 Wood

po zniszczeniu:
+5 Wood
```

Wartości mogą być skonfigurowane w jednym miejscu zamiast być zakodowane w wielu klasach.

---

# 4. Iron

Iron również ma pochodzić z obiektów świata.

Przykładowe fantasy źródła:

- Iron Deposit
- stara krata
- porzucona zbroja
- metalowy złom
- pozostałości kuźni
- elementy kopalni

Na MVP użyj prostego `Iron Deposit`.

Przykład:

```text
Iron Deposit

HP: 160

co 40 damage:
+2 Iron
```

Po całkowitym zniszczeniu obiekt znika.

---

# 5. Arcane

Aktualnie Arcane istnieje jako zasób w HUD/systemie, ale nie ma jeszcze sposobu jego zdobywania.

Dodaj:

```text
Arcane Crystal
```

Gracz może rozbijać kryształ tak samo jak pozostałe Resource Nodes.

Przykład:

```text
Arcane Crystal

HP: 120

co określony próg obrażeń:
+ Arcane
```

Arcane pozostaje osobnym zasobem od `Arcane Power`.

Nie zmieniaj istniejącego znaczenia:

```text
Arcane = surowiec
Arcane Power = moc infrastruktury generowana przez Arcane Core
```

---

# 6. Atakowanie zasobów

Obecnie miecz może trafiać zombie.

Rozszerz istniejący system trafień tak, aby ten sam atak mógł również trafić `ResourceNode`.

Nie twórz całkowicie osobnego systemu input/raycast tylko dla surowców, jeżeli można rozszerzyć aktualny system walki.

Preferowane zachowanie:

```text
LPM
↓
raycast / hit detection
↓
co zostało trafione?

Zombie
→ damage zombie

ResourceNode
→ damage resource node
```

Na obecnym etapie miecz może służyć do zbierania wszystkich zasobów.

Nie dodawaj jeszcze:

- siekiery
- kilofa
- nowych slotów ekwipunku
- craftingu narzędzi

Chcemy najpierw sprawdzić gameplay.

W przyszłości możliwe będzie dodanie:

```text
Axe
→ bonus damage przeciw Wood

Pickaxe
→ bonus damage przeciw Iron
```

ale NIE implementuj tego teraz.

---

# 7. Zdobywanie zasobów

Nie chcemy sytuacji, w której ResourceNode po prostu daje cały zasób jednym kliknięciem.

Gracz powinien musieć go kilka razy uderzyć.

Zasoby mogą być przyznawane:

- przy przekraczaniu określonych progów HP
- oraz dodatkowo po całkowitym zniszczeniu

Przykład:

```text
Tree: 100 HP

75 HP
→ +3 Wood

50 HP
→ +3 Wood

25 HP
→ +3 Wood

0 HP
→ +5 Wood
→ node destroyed
```

System powinien pilnować, aby ten sam próg nie mógł przyznać nagrody wielokrotnie.

---

# 8. Zniszczenie ResourceNode

Po spadku HP do 0:

- ResourceNode przestaje przyjmować obrażenia
- znika ze świata lub odtwarza prosty efekt zniszczenia
- przestaje blokować gracza, jeśli miał collider
- nie może ponownie przyznać nagrody

Nie implementuj jeszcze respawnu zasobów.

Na tym etapie Resource Nodes są skończone dla danego runu.

---

# 9. Ograniczona ilość zasobów

To ważny element gameplayu.

Zasoby na mapie mają być ograniczone.

Gracz powinien stopniowo wyczerpywać miejsca blisko Shelteru i być zmuszony eksplorować coraz dalsze części miasta.

Docelowy feeling:

```text
początek runu
→ zasoby bardzo blisko Shelteru

później
→ najbliższe miejsca są wyeksploatowane
→ trzeba iść dalej w ruiny

jeszcze później
→ wyprawa po materiały staje się ryzykiem
```

Nie implementuj jeszcze pełnej ekonomii dnia/nocy, ale struktura mapy i rozmieszczenie Resource Nodes powinny pozwalać na taki gameplay później.

---

# 10. Rozmieszczenie zasobów

Nie rozmieszczaj wszystkiego losowo bez kontroli.

Na prototypie ręcznie ustaw Resource Nodes w różnych częściach mapy.

Przykład:

```text
okolice Shelteru:
dużo Wood
mało Iron

Forge:
więcej Iron

Cemetery / Temple:
Arcane Crystals

Forest:
dużo Wood

Mines:
dużo Iron
```

Nie musimy jeszcze blokować sektorów ani tworzyć systemu levelowania obszarów.

Chodzi o to, aby eksploracja miała sens.

---

# 11. HUD

Zachowaj istniejące liczniki:

```text
Wood
Iron
Arcane
```

Jeżeli ResourceNode jest trafiony, nie potrzebujemy rozbudowanego panelu.

Opcjonalnie można wyświetlić prosty feedback:

```text
+3 Wood
```

lub krótki floating text.

Nie buduj skomplikowanego UI.

---

# 12. Usunięcie / ograniczenie starego systemu paczek

Obecny projekt posiada paczki Wood i Iron podnoszone klawiszem `E`.

Po wprowadzeniu Resource Nodes:

- przestań używać paczek jako podstawowego sposobu zdobywania Wood i Iron
- usuń je z aktualnej mapy albo pozostaw system kodowo tylko jeśli jest nadal wykorzystywany przez inne testy

Preferowane jest uproszczenie projektu i usunięcie niepotrzebnego kodu, jeśli stare rozwiązanie nie będzie już używane.

Nie zostawiaj dwóch równoległych głównych systemów zbierania tych samych zasobów bez powodu.

---

# 13. Architektura

Zachowaj istniejący podział projektu:

```text
domain
core
player
enemies
shelter
resources
building
world
ui
```

Resource Nodes powinny trafić przede wszystkim do modułu:

```text
resources
```

Mapa/sektory do:

```text
world
```

Nie mieszaj logiki przyznawania zasobów bezpośrednio z rendererem Babylon.js.

Model gameplayowy powinien wiedzieć:

```text
node dostał damage
node przekroczył próg
gracza dostał X Wood
```

Renderer powinien przede wszystkim:

```text
pokazać obiekt
pokazać trafienie
usunąć mesh po zniszczeniu
```

---

# 14. Testy

Dodaj testy dla logiki Resource Nodes.

Minimum:

1. trafienie zmniejsza HP noda
2. node nie może mieć HP poniżej 0
3. przekroczenie progu przyznaje odpowiedni resource
4. ten sam próg nie przyznaje nagrody dwukrotnie
5. zniszczenie przyznaje bonus końcowy tylko raz
6. zniszczony node nie przyjmuje kolejnych obrażeń
7. Wood trafia do licznika Wood
8. Iron trafia do Iron
9. Arcane trafia do Arcane
10. limity Storehouse nadal obowiązują

Jeżeli aktualny system przechowywania pozostawia nadmiar materiału na mapie, dostosuj nowe Resource Nodes tak, aby zachowanie było logiczne i nie powodowało utraty zasobów bez informacji dla gracza.

---

# 15. Czego NIE robić w tym milestone

Nie implementuj teraz:

- ZombieSpawner
- fal zombie
- cyklu dnia i nocy
- Shelter Level 2/3
- skill tree
- multiplayera
- ASP.NET Core
- SignalR
- PostgreSQL
- proceduralnego generowania świata
- respawnu Resource Nodes
- narzędzi Axe/Pickaxe
- nowych broni
- finalnych modeli
- finalnych animacji
- ogromnego open worlda

Trzymaj zakres mały.

---

# Kryteria ukończenia Milestone 6.5

Milestone uznajemy za ukończony, gdy:

1. gracz może swobodnie eksplorować większy fragment ruin miasta,
2. mapa zachowuje labiryntowy charakter,
3. na mapie istnieją Wood, Iron i Arcane Resource Nodes,
4. można trafić je mieczem,
5. mają HP,
6. kilka uderzeń daje zasób,
7. po zniszczeniu znikają,
8. zasoby trafiają do istniejącego ResourceManagera,
9. Storehouse nadal poprawnie ogranicza pojemność,
10. Magic Tower, Arcane Core i pozostałe istniejące systemy nadal działają,
11. wszystkie testy przechodzą,
12. build produkcyjny działa bez błędów.

---

# Sposób pracy

Najpierw przeanalizuj istniejący kod.

Nie przepisuj działających systemów bez potrzeby.

W szczególności sprawdź:

- aktualny system walki mieczem,
- ResourceManager,
- paczki zasobów,
- limity Storehouse,
- World / map generation,
- raycasty,
- collision system.

Następnie wykonuj zmiany małymi krokami.

Po każdej większej zmianie:

- uruchom testy,
- uruchom build,
- sprawdź błędy TypeScript,
- upewnij się, że istniejące funkcje nie zostały zepsute.

Preferuj prosty, czytelny kod nad overengineeringiem.

Najważniejszy cel tego milestone to:

```text
eksploruję większe ruiny
↓
znajduję zasób
↓
uderzam go
↓
zdobywam materiał
↓
wracam do Shelteru
↓
wykorzystuję materiał do budowy
```

To ma stać się podstawą dalszej rozgrywki przed dodaniem fal zombie i pełnego systemu dnia/nocy.
