# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Jediný uživatel: Martin.** Trénuje sám, od ~července 2026 bez trenéra (dřív online
  coaching). Cíl: nabrat svalovou hmotu a vytvarovat postavu.
- Používá **jen iPhone**: appka je přidaná na plochu (PWA, na celou obrazovku, na výšku).
- Hlavní situace: **posilovna, zápis živě mezi sériemi**. Běží pauza, timer je zamčený
  nad navigací a obrazovka nezhasíná.
- Vedlejší situace: mimo posilovnu ranní váha, rychlé hodnocení dne v jídle, přehled
  pokroku a týdenní check-in s fotkou.

## Product Purpose

Osobní deník silových a kardio tréninků, postavy a stravy. Tři úkoly v tomto pořadí:

1. **Zapsat trénink, aby to v posilovně nezdržovalo.**
2. **Ukázat, jestli roste:** index síly a odhad 1RM, objem, pokrytí sedmi partií,
   rekordy a pravidelnost.
3. **Strava a váha na pár klepnutí.** To je slabé místo dat: skoro se nezapisují.

Úspěch: trénink je zapsaný pokaždé, přehled odpoví na otázku „rostu?" a zápis stravy
a váhy je dost rychlý na to, aby se opravdu dělal.

## Positioning

- Appka na míru jednomu člověku, bez účtu, bez vlastního backendu a bez předplatného.
- Data zůstávají v telefonu a v Martinově vlastním Google Sheetu. Sync slévá záznamy
  podle id a drží 7 denních záloh.
- Postavená kolem jeho plánu: Full Body A/B/C po trenérovi a vlastní šablona D.
  Řídí se jeho pravidly, ne obecným fitness trhem.
- Žádné sociální funkce, veřejné rutiny ani žebříčky.

## Operating Context

- **Gym mód** se šablonou, plánem sérií, supersety, pauzou, kalkulačkou kotoučů
  a volitelným RIR. Hotový trénink končí shrnutím s rekordy.
- **Rady si bere od Clauda v chatu.** „Report pro Clauda" (Záloha a export) zkopíruje
  přehled tréninků, progrese, váhy a stravy za zvolené období. Martin ho vkládá do chatu
  s Claudem a je to jeho kanál pro rady k tréninku i stravě, takže se má dál zlepšovat.
- **Check-in a fotky postupu** slouží jemu samému ke sledování změny postavy; adresát
  z doby trenéra odpadl.
- Kalorický cíl a makra z doby trenéra platí dál (hodnoty jsou v Nastavení).
- Nasazení přes GitHub Pages z repozitáře `Hrncc/Fitness`. Push na main je publikace,
  takže jen na jeho výslovný pokyn.

## Capabilities and Constraints

- Vanilla HTML/CSS/JS bez build kroku a frameworku. Appka je self-contained: žádné CDN,
  systémové písmo, PWA s offline cache.
- Externí volání jdou jen na Google Apps Script (sync), Open Food Facts, USDA
  a `api.anthropic.com` (etiketa a jídlo z fotky). Klíč i kredit jsou jeho vlastní.
- Stav je v `localStorage` zařízení a synchronizuje se do Sheetu. Fotky postupu jsou
  jen v IndexedDB, nikdy ve stavu ani v JSON záloze.
- Celé UI je česky, tyká a čte desetinnou čárku i tečku.
- Mazání bez potvrzovacích dialogů; místo „Opravdu?" nabízí hláška Vrátit.
- **Rozhodnuto, že ne:**
  - streak;
  - AI kouč uvnitř appky (postavený ve v1.20, na jeho žádost smazaný);
  - sociální feed;
  - časovač délky tréninku;
  - zahřívací série;
  - zvuk na konci pauzy;
  - cardio „phases" a stretch library;
  - animované ukázky cviků, vedený režim „jeden cvik na obrazovku" a dotaz na váhu
    při startu (v3.1, vráceno);
  - procenta regenerace partií.
- **Otevřené** (navržené, zatím nevybrané):
  - trénink přes celou obrazovku;
  - tabulka sérií ve stylu Strong/Hevy;
  - nativní SwiftUI appka;
  - drobnosti z kritiky v4.1 (seznam je v CLAUDE.md).
- Limity webu na iPhonu: Safari nevibruje a PWA nemá Live Activities ani pauzu
  na zamčené obrazovce.

## Brand Commitments

- Název **Fitness Log**. Tón je věcný a krátký, tyká.
- Martin si ve v4.0 výslovně zvolil **vzhled podle Apple Human Interface Guidelines**.
  Vizuální systém popisuje CLAUDE.md (sekce Vzhled), sem nepatří.

## Evidence on Hand

- **Reálná data** jsou v jeho Google Sheetu `Fitness sync`, list `DATA` (JSON po 45k
  blocích), a jdou stáhnout přes Drive konektor. Testy jinde běží na vymyšleném seedu.
- **Plán trenéra** s poznámkami k technice je `COACH_PLAN` v `js/data.js`. Knihovna cviků
  s českými popisy techniky a anglickými názvy je v `js/exercise-db.js`.
- **Tabulka trenéra** na Drivu: „ONLINE COACHING – OBECNÁ TABULKA".
- **Výsledky kritiky a polish v4.1** (Impeccable, 28/40) jsou shrnuté v CLAUDE.md.
- **Chybí:** tep, spánek, regenerace a data z hodinek (žádné Apple Health). Appka nesmí
  předstírat přesnost, kterou z těchto dat nemá.

## Product Principles

1. **Zápis nesmí zdržovat.** V posilovně se každé klepnutí navíc musí obhájit. U stravy
   a váhy vyhrává řešení, které zápis zkracuje na pár klepnutí.
2. **Nic netrestá volno.** Žádný streak; týdenní cíl platí jen pro tento týden a nic
   se nepřenáší.
3. **Přesnost jen tam, kde ji data mají.** Raději počet dní od poslední série než
   vymyšlená procenta regenerace.
4. **Appka nemyslí za něj.** Uvnitř žádný AI kouč; rady přes report v chatu s Claudem,
   kde rozhoduje on.
5. **Bez dialogů, ale nic nevratně.** Vrátit místo potvrzování. Velké ztráty mají delší
   okno a druhé klepnutí.

## Accessibility & Inclusion

- Žádná konkrétní potřeba zatím nezazněla. Appka přesto drží:
  - Dynamic Type (Velikost textu na iOS, ověřeno do 34 px základu);
  - světlý i tmavý režim podle systému;
  - kontrast textu aspoň 4,5:1 a dotykové plochy aspoň 44 px;
  - sheety ovladatelné klávesnicí i čtečkou;
  - respekt k omezení pohybu.
- Záměrná odchylka: zoom stránky je vypnutý kvůli pocitu nativní appky. Velký text
  zajišťuje Dynamic Type.
