# Fantasy Shelter — MVP

## Założenie

Przeglądarkowa gra survivalowa inspirowana trybem Shelter z Counter-Strike Nexon: Zombies, ale osadzona w klimacie dark fantasy.

Core loop:

```text
DZIEŃ
↓
eksploracja ruin miasta
↓
zbieranie surowców
↓
powrót do Shelteru
↓
budowanie / ulepszanie
↓
NOC
↓
fala zombie
↓
obrona bazy
↓
kolejny dzień
```

---

## 1. Shelter

- Centralny punkt bazy.
- Ma własne HP.
- Zombie próbują go zniszczyć.
- Można go ulepszać:
  - Level 1
  - Level 2
  - Level 3
- Ulepszenia zwiększają HP i mogą odblokowywać kolejne możliwości.

---

## 2. Surowce

Na MVP używamy trzech podstawowych zasobów:

- Wood
- Iron
- Arcane

Gracz eksploruje ruiny miasta i zbiera materiały potrzebne do rozbudowy bazy.

---

## 3. Storehouse

- Możliwość wybudowania magazynu.
- Storehouse zwiększa maksymalną ilość przechowywanych surowców.
- Kolejne ulepszenia magazynu zwiększają limity.

Przykład:

```text
Bez magazynu:
Wood: 100
Iron: 50

Storehouse Lv.1:
Wood: 150
Iron: 75
```

---

## 4. Arcane Core

- Fantasy odpowiednik generatora energii z Nexon Shelter.
- Zapewnia Arcane Power potrzebne do działania magicznych konstrukcji.
- Można go później ulepszać.

Przykład:

```text
Arcane Core Lv.1
Power: 50

Arcane Core Lv.2
Power: 100
```

---

## 5. Magic Tower

Na MVP tylko jeden typ wieży.

- Automatycznie wykrywa zombie.
- Atakuje je magicznymi pociskami.
- Wymaga materiałów do budowy.
- Zużywa Arcane Power.

Przykład:

```text
Magic Tower

Koszt:
20 Wood
15 Iron

Wymagane:
10 Arcane Power
```

Mechanicznie działa podobnie jak turret w Nexon Zombies Shelter.

---

## 6. Budowanie

Gracz może budować:

- Storehouse
- Arcane Core
- Magic Tower

Podstawowy system:

```text
wybór konstrukcji
↓
preview budynku
↓
wybór miejsca
↓
postawienie budynku
```

---

## 7. Zombie

Na MVP tylko jeden podstawowy typ zombie.

Zombie:

- pojawiają się podczas nocy,
- poruszają się w stronę Shelteru,
- mogą atakować gracza,
- mogą atakować konstrukcje,
- z każdą kolejną nocą pojawia się ich więcej.

---

## 8. Dzień i noc

### Dzień

- eksploracja miasta,
- zbieranie surowców,
- budowanie,
- ulepszanie Shelteru.

### Noc

- rozpoczyna się fala zombie,
- gracz i wieże bronią Shelteru,
- po pokonaniu wszystkich zombie rozpoczyna się kolejny dzień.

---

## 9. Drzewka umiejętności

Brak sztywnych klas.

Każdy gracz zaczyna tak samo i sam tworzy swoją specjalizację poprzez rozdawanie punktów.

### Combat

- Sword Damage
- Attack Speed
- Heavy Attack

### Survival

- Movement Speed
- Resource Yield
- Inventory Size

### Builder

- Build Cost
- Repair Speed
- Reinforced Structures

Na MVP łącznie 9 umiejętności.

---

## 10. Walka

- Widok first person.
- Podstawową bronią jest miecz.
- Zwykły atak.
- Zombie mają HP.
- Gracz ma HP.

Na MVP bez:

- combo,
- parry,
- wielu rodzajów broni,
- rozbudowanego systemu staminy.

---

## 11. Mapa

Mapa to małe ruiny miasta fantasy.

Główne założenia:

- labiryntowa struktura,
- wąskie uliczki,
- place,
- ślepe zaułki,
- skróty,
- kilka charakterystycznych punktów,
- Shelter mniej więcej w centrum.

Mapa powinna dawać poczucie eksploracji i zagubienia podobne do Nexon Zombies Shelter.

---

## Przykładowy stan gry

```text
DAY 3

Wood:   73 / 150
Iron:   31 / 75
Arcane: 40 / 60

Shelter Lv.2
HP: 1350 / 1500

Storehouse Lv.1
Arcane Core Lv.1

Magic Towers:
2

Skill Points:
2

Night begins in:
02:37
```

Noc:

```text
NIGHT 3

Zombies remaining: 34

Zombie → Magic Towers → Player → Shelter
```

---

## Poza MVP

Na początku NIE dodajemy:

- multiplayera,
- proceduralnej mapy,
- bossów,
- wielu typów zombie,
- wielu typów wież,
- craftingu broni,
- wielu rodzajów broni,
- rozbudowanej magii,
- rozbudowanego systemu klas.

Najpierw sprawdzamy, czy podstawowy loop:

```text
zbieranie → budowanie → obrona → ulepszanie
```

jest po prostu przyjemny.
