# Fitness Log — kontext projektu

Osobní PWA pro zápis silových a kardio tréninků a stravy. **Jeden uživatel** (Martin),
žádná registrace, žádný vlastní backend. UI je celé česky.

## Tech a zásady

- **Vanilla HTML/CSS/JS, žádný build step, žádný framework.** Skripty se načítají
  přímo v `index.html` v daném pořadí — nový soubor je nutné přidat i do
  `SHELL` pole v `sw.js`.
- Appka musí zůstat **self-contained** (žádné CDN). Proto je QR generátor
  (`js/qr.js`) psaný od nuly.
- Externí volání jen na: Google Apps Script (sync), Open Food Facts, USDA,
  `api.anthropic.com` (čtení etiket a odhad jídla z fotky).

## Mapa souborů

| Soubor | Obsah |
|---|---|
| `js/util.js` | datum, formátování, jednotky, `parseDec()` (desetinná **čárka i tečka**), e1RM |
| `js/qr.js` | QR generátor (ISO 18004, byte mode, EC L, v1–13, výběr masky) |
| `js/photos.js` | fotky postupu v IndexedDB + zmenšení na JPEG |
| `js/data.js` | stav `S`, `save()`, `replaceState()`, PR logika, milníky, plán trenéra |
| `js/sync.js` | cloud sync + `mergeStates()` (slévání podle id) |
| `js/foodapi.js` | OFF (cz → world), USDA, Claude vision (etiketa / jídlo), čárový kód |
| `js/ui.js` | toast (i s akcí), modal, kalendář, SVG grafy, rest timer |
| `js/view-*.js` | obrazovky: today, workout, food, summary, checkin, menu |
| `js/report.js` | `buildCoachReport(range)` — textový report pro Clauda/trenéra |
| `js/app.js` | router, delegace akcí (`ACTIONS`), `withUndo()`, start |
| `apps-script/Code.gs` | backend syncu v Google Sheetu + 7 denních záloh |

## Konvence, které je nutné dodržet

- **Akce přes delegaci:** `data-act="neco"` v HTML → klíč v `ACTIONS` v `app.js`.
  Změny selectů přes `data-change` v `document.addEventListener("change", …)`.
- **Mutace stavu:** změň `S` → `save()` → `render()`. `save()` sám persistuje,
  kontroluje milníky a plánuje sync.
- **Mazání bez potvrzovacích dialogů** — používej `withUndo("Hláška", () => {…})`,
  které udělá snapshot a nabídne v toastu „Vrátit". U záznamů volej `markDeleted(id)`,
  jinak se smazaná věc vrátí ze syncu z druhého zařízení.
- **Desetinná čísla:** vstupy jsou `type="text" inputmode="decimal"` a parsují se
  přes `parseDec()`. `type="number"` na iOS zahazuje českou desetinnou čárku.
- **Barevná logika** (nesahat bez důvodu): volt = akce a cíle (tlačítka, aktivní
  prvky, progres k cíli), bílá/šedá = data a grafy, zlatá = rekordy a pending,
  červená = chyby, neutrální šedý štítek = typové popisky. Makra jsou odstíny
  `--mac1` (bílkoviny) → `--mac3` (tuky).
- Fotky postupu **nesmí** jít do `S` ani do JSON zálohy (rozbily by sync).

## Datový model (`S`)

`exercises`, `templates`, `sessions`, `foods`, `foodLog`, `bodyLog`, `recipes`,
`checkins`, `milestones`, `deletedIds`, `goal`, `activeSession`.

Sessions: `{id, date, type: "weights"|"cardio", templateUsed, templateName, entries, rating, note}`.
U silových `entries[] = {exerciseId, sets: [{reps, weight, note}]}` — váhy vždy
interně v **kg**, na výstup přes `kgOut()`/`fmtWeight()`.

Sync slévá kolekce **podle `id`** (ne last-write-wins), tombstony v `deletedIds`.

## Nasazení — POZOR

Uživatel nahrává soubory **ručně přes web GitHubu** (Add file → Upload files) do
repa `Hrncc/Fitness`, které se publikuje na GitHub Pages. Lokální git historie je
kvůli tomu **rozejitá s remote — `git push` neprojde a není to chyba.** Commituj
lokálně normálně a na konci uživateli napiš, **které soubory má nahrát**.

Při každé změně kódu zvyš **obojí**:
- `APP_VERSION` v `js/view-menu.js`
- `CACHE` v `sw.js` (service worker je network-first, takže se to projeví samo
  a appka nabídne toast „Obnovit")

`apps-script/Code.gs` se mění zřídka — když ano, uživatel musí v Apps Scriptu
nasadit **novou verzi stávajícího nasazení**, ne nové nasazení (jinak se změní URL).

## Testování

Preview server je v `.claude/launch.json` (`preview_start` s `name: "fitness-app"`).
Testuje se přes `javascript_tool` — volání akcí přes `document.querySelector(
"[data-act='…']").click()` a kontrola stavu `S`. **Po testu vždy `localStorage.clear()`**,
ať uživateli nezůstanou testovací data. Reálná data jdou stáhnout z jeho Sheetu
(Drive konektor, soubor `Fitness sync`, list `DATA` = JSON po 45k blocích).

## Kontext uživatele

- 23 let, 182 cm, start 12. 6. 2026 na 77 kg. Cíl: **nabrání svalové hmoty /
  tvarování postavy**. Má **skutečného online trenéra** — programové změny patří
  jemu, appka a já děláme měření a vyhodnocení.
- Cíl od trenéra: **2 200 kcal, B 180 / S 230 / T 60**, kardio „chůze, začátečnický
  běh do 5 km".
- Tréninkový plán trenéra (Full Body A/B/C s poznámkami k technice) je
  naimportovaný v `data.js` jako `COACH_PLAN` (id `cp-*`), migrace běží jednou
  přes flag `coachPlanV1`.
- Sdílená tabulka trenéra na Drivu: **ONLINE COACHING – OBECNÁ TABULKA**
  (záložky Tréninkový plán, Strava, Check-in).
- Slabé místo v datech: **skoro nezapisuje stravu a váhu** — u návrhů preferuj
  řešení, která zapisování zkracují na pár klepnutí.

## Záměrně neimplementováno

Streak počítadlo (trestá plánovaná volna), cardio „phases", stretch library.
Rest timer původně taky vyloučen, ale uživatel si ho později vyžádal (v1.10).
