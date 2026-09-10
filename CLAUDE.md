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
  `api.anthropic.com` (čtení etiket a odhad jídla z fotky). Klíč je uživatelův,
  v `localStorage` toho zařízení — každé volání jde z jeho kreditu.

## Mapa souborů

| Soubor | Obsah |
|---|---|
| `js/util.js` | datum, formátování, jednotky, `parseDec()` (desetinná **čárka i tečka**), e1RM |
| `js/exercise-db.js` | `EXERCISE_DB` — 90 cviků knihovny s vysvětlivkami, `EXERCISE_NAME_EN` — anglické názvy všech 142 cviků |
| `js/qr.js` | QR generátor (ISO 18004, byte mode, EC L, v1–13, výběr masky) |
| `js/photos.js` | fotky postupu v IndexedDB + zmenšení na JPEG |
| `js/data.js` | stav `S`, `save()`, `replaceState()`, PR logika, milníky, plán trenéra, barvy partií (`CAT_COLOR`, `CAT_ORDER`, `sessionCatSets()`, `dayCatColors()`) |
| `js/sync.js` | cloud sync + `mergeStates()` (slévání podle id) |
| `js/foodapi.js` | OFF (cz → world), USDA, Claude vision (etiketa / jídlo), čárový kód |
| `js/ui.js` | toast (i s akcí), modal, kalendář, SVG grafy, rest timer |
| `js/view-*.js` | obrazovky: today, workout, food, summary, checkin, menu |
| `js/report.js` | `buildCoachReport(range)` — textový report pro Clauda |
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
- **Barevná logika — dvě vrstvy** (nesahat bez důvodu, v1.16):
  - **Stav** = co se právě děje. Vždy jako *výplň* nebo plný text.
    volt = akce a cíle (tlačítka, aktivní prvky, progres k cíli, splněno),
    zlatá = rekordy a varování „něco ti utíká", červená = chyby, mazání,
    překročení, bílá/šedá = data a grafy, neutrální štítek = typové popisky
    a pending stavy. Makra jsou odstíny `--mac1` (bílkoviny) → `--mac3` (tuky).
  - **Identita** = čeho se to týká. Vždy jako *úzký proužek* (`.p-stripe`),
    *tečka* (`.p-dot`) nebo tenká linka — nikdy jako výplň tlačítka.
    Sedm svalových partií `--p-ramena` … `--p-nohy`, odstín jde po těle shora
    dolů (teplá → studená) a celý pás vynechává žlutozelený výsek, kde bydlí
    volt a zlatá. Barvu vrací `catColor(cat)` / `exColor(exerciseId)` z `data.js`.
    Kardio není partie, ale identitu má taky: `--p-cardio` (tmavší sytá červená
    — odlišuje se od růžového hrudníku i od signální červené) a v proužcích
    kalendáře se od bloku partií odsazuje třídou `.cardio`.
  - Pořadí zobrazení partií je `CAT_ORDER` (podle těla), ne `EX_CATEGORIES`.
- Fotky postupu **nesmí** jít do `S` ani do JSON zálohy (rozbily by sync).

## Datový model (`S`)

`exercises`, `templates`, `sessions`, `foods`, `foodLog`, `bodyLog`, `dayLog`,
`recipes`, `checkins`, `milestones`, `deletedIds`, `goal`, `activeSession`.

`dayLog` (v1.17): `{date, foodRating: "under"|"ok"|"over", proteinOk}` — rychlý
zápis dne dvěma klepnutími. Slévá se podle `date` jako `bodyLog`.
`effectiveDayRating(date)` dává přednost podrobnému `foodLog`, když pro den
existuje; ruční odhad ho nepřepíše. `adherence(from, to)` z toho počítá
dodržování pro check-in — nezapsaný den se nepočítá ani do jmenovatele.

Sessions: `{id, date, type: "weights"|"cardio", templateUsed, templateName, entries, rating, note}`.
U silových `entries[] = {exerciseId, sets: [{reps, weight, note}]}` — váhy vždy
interně v **kg**, na výstup přes `kgOut()`/`fmtWeight()`.

Sync slévá kolekce **podle `id`** (ne last-write-wins), tombstony v `deletedIds`.

## Nasazení

Repo `Hrncc/Fitness` se publikuje na GitHub Pages. Od **6. 9. 2026** je nasazení
přes **`git push`** — token je v klíčence macOS, historie je s remote srovnaná.
(Do té doby se nahrávalo ručně přes web; z toho zbyly duplikáty souborů v kořeni,
které jsme při srovnání smazali. Do kořene patří jen `sw.js` kvůli scope
service workeru.)

**Pushuj jen na výslovný pokyn uživatele** — je to publikace navenek, ne rutina
po každé úpravě. Commituj lokálně průběžně.

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
  tvarování postavy**.
- **Trénuje sám — od ~července 2026 už nemá trenéra** (dřív online coaching).
  Plán A/B/C po trenérovi jede dál, ale nikdo ho neaktualizuje. Části appky
  postavené kolem trenéra (check-in, „report pro trenéra") tím ztratily
  adresáta — než na ně sáhneš, ověř s ním, čemu mají sloužit teď.
- Kalorický cíl (původně od trenéra, jede dál): **2 200 kcal, B 180 / S 230 / T 60**,
  kardio „chůze, začátečnický běh do 5 km".
- Tréninkový plán trenéra (Full Body A/B/C s poznámkami k technice) je
  naimportovaný v `data.js` jako `COACH_PLAN` (id `cp-*`), migrace běží jednou
  přes flag `coachPlanV1`.
- Knihovna cviků má 140 položek: 25 ze `seedExercises()` (`ex-*`), 27 z plánu
  trenéra (`cp-*`) a 90 z `EXERCISE_DB` (`xd-*`, migrace `applyExerciseDb()`
  přes flag `exerciseDbV1`). Popisy v `EXERCISE_DB` jsou **technika a častá
  chyba, ne série a opakování**. (Původní důvod bylo „programování patří
  trenérovi"; ten padl, ale rozhodnutí drží — rozsahy u 90 cviků by spustily
  automatické návrhy progrese tam, kde je nikdo nezvolil.) Migrace
  nepřepisuje vlastní cviky se stejným názvem. `exercise-db.js` se v
  `index.html` načítá **před** `data.js`, protože migrace běží na úrovni modulu.
- Anglické názvy: `EXERCISE_NAME_EN` (mapa podle id) → pole `nameEn`, migrace
  `applyExerciseNamesEn()` přes flag `nameEnV1` je doplní i do cviků, které
  uživatel už ve stavu má. Vykresluje je `exNameEn()` jako `.name-en` pod
  českým názvem — vrací prázdno u vlastních cviků a tam, kde by se název jen
  zopakoval (Plank, Leg press, Face pull…); tam zůstává kategorie.
- Sdílená tabulka trenéra na Drivu: **ONLINE COACHING – OBECNÁ TABULKA**
  (záložky Tréninkový plán, Strava, Check-in).
- Slabé místo v datech: **skoro nezapisuje stravu a váhu** — u návrhů preferuj
  řešení, která zapisování zkracují na pár klepnutí.

## Pokrytí partií

`catCounterHtml()` (`view-workout.js`) drží nad cviky po celou dobu tréninku.
Sbalený je **pruh** se sériemi (v posilovně je místo na obrazovce nejcennější),
klepnutím (`w-counter`) se rozbalí na **cviky · série** u každé partie —
série samy nerozliší „tři série na jednom cviku" od „tři cviky po jedné".
Pořadí je pevné podle těla (`CAT_ORDER`), ať se buňky pod prstem nepřeskupují.

- `sessionCatSets()` / `sessionCatExercises()` — série a cviky na partii
- `catPipsHtml()` (`ui.js`) — pokrytí jedním řádkem (Dnes, hotové tréninky, Týden)
- `lastSessionGaps()` — co uteklo v posledním tréninku; 0 sérií = vynechaná,
  1 série = odbytá, u tréninku ze šablony i porovnání cviků proti plánu.
  Zobrazuje se nad volbou tréninku (`lastGapsHtml()`) a na Dnes.
- `nextTemplate()` — rotace jen přes `activeTemplates()`, tedy šablony použité
  za posledních 42 dní; volný trénink rotaci neposouvá. Martin jede vlastní
  šablonu D a A/B/C po trenérovi nechal ležet — bez tohohle filtru by mu
  „na řadě" navrhovalo plán, který opustil.

Všechny tři šablony trenéra pokrývají všech 7 partií, takže „N ze 7" je reálný
cíl každého tréninku, ne teoretické skóre.

## Struktura obrazovek (v1.17)

Navigace je **Dnes · Trénink · Týden · Více** — podle toho, co děláš, ne podle
typu dat. „Více" otevírá drawer (hamburger v topbaru zmizel), Jídlo je obrazovka
pod Dnes.

- **Dnes** = seznam toho, co dnes dlužíš: váha → trénink → jídlo. Hotová položka
  se sbalí na řádek (`dayItemDone()`), rámeček (`.item-hero`) nese **jen první
  nedokončená** — tři hrdinové naráz o pozornost soupeří. Nahoře týdenní pás
  (`weekStripHtml()`) se třemi tečkami na den: váha · jídlo · trénink.
- **Trénink** = gym mód: steppery místo klávesnice (`stepperHtml()`, pole zůstává
  editovatelné), partie barevně v hlavičce cviku, pauza i pod cvikem
  (`restInlineHtml()`) — plovoucí lišta se pak skryje třídou `hidden-by-inline`.
  `addSet()` musí volat `Rest.start()` **před** `render()`, jinak se inline pauza
  vykreslí do stavu „neběží".
- **Týden** = tři odpovědi (dodržování, váha, odcvičený plán) + tlačítko
  check-inu. Vzniklo, když měl trenéra; adresát teď chybí. Původních osm karet Souhrnu žije v podzáložce
  **Přehled** (`SV.sub`).

## Záměrně neimplementováno

Streak počítadlo (trestá plánovaná volna), cardio „phases", stretch library.
Sociální feed a veřejné rutiny (appka je jednouživatelská, bez backendu).
AI kouč nad vlastními daty — postavený ve v1.20, na Martinovu žádost hned
zase smazaný (v1.21). Nestavět znovu, dokud si o to výslovně neřekne.
Rest timer původně taky vyloučen, ale uživatel si ho později vyžádal (v1.10).
