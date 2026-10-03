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
| `js/ui.js` | ikony `ic()`, sekce `sec()`/`secHead()`/`secLink()`, segmenty `segHtml()`, čísla `statHtml()`, české tvary `plural()`, data `fmtShort()`/`relDay()`, `fmtVolume()`, `fmtFixed()`, toast (i s akcí), sheet, výběr cviku `openExPicker()`, kalendář, SVG grafy (`lineChart`, `columnChart`, `sparklineHtml`) + dotykový readout `ChartTip`, rest timer `Rest` + zamčený timer `Dock`, `dayNavHtml()` |
| `js/view-today.js` | **Dnes** — seznam dne (váha · trénink · jídlo · check-in), týden s listováním, pokrok v kostce |
| `js/view-workout.js` | **Trénink** — start (šablona na řadě, ostatní, kardio, poslední tréninky), gym mód, stránky Historie a Rekordy, detail tréninku |
| `js/view-progress.js` | **Pokrok** — segmenty Trénink · Tělo · Strava; segment Trénink (index síly, 30 dní, týdny, pravidelnost, partie, rekordy) |
| `js/view-checkin.js` | Pokrok → **Tělo** (váha, check-in, fotky, obvody, historie) + stránka formuláře check-inu |
| `js/view-summary.js` | Pokrok → **Strava**, detail dne `openDaySummary()`, `movingAvgAt()`, stav kalendáře `SV` |
| `js/view-food.js` | stránka **Jídlo** (denní log) + přidání jídla (hledání, foto, oblíbené, ručně) |
| `js/view-menu.js` | sheet **Více** + stránky Exercise Library, Workout Templates, Food Library, Export & Backup, Nastavení, O aplikaci; fotky (`PV`) |
| `js/report.js` | `buildCoachReport(range)` — textový report pro Clauda |
| `js/app.js` | router + velký titulek (`pageHead()`), delegace akcí (`ACTIONS`), `withUndo()`, start |
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
- **Barevná logika — dvě vrstvy** (v1.16, ve v2.0 zúžená; nesahat bez důvodu):
  - **Stav** = co se právě děje. Vždy jako *výplň* nebo plný text.
    volt = **hlavní akce obrazovky** (jedno volt tlačítko na obrazovku), splněno
    (fajfky, odcvičený den) a zlepšení (šipka nahoru, progres k cíli),
    zlatá = rekordy a varování „něco ti utíká", červená = chyby, mazání,
    překročení, **bílá = výběr** (chip, segment, navigace, zvolená odpověď),
    bílá/šedá = data a grafy, neutrální štítek = typové popisky a pending stavy.
    Makra jsou odstíny `--mac1` (bílkoviny) → `--mac3` (tuky).
    Sekundární akce jsou neutrální kapsle (`.btn`), ne volt — ve v1 byly
    tónované (`.btn.tonal` zůstal jen jako alias neutrální).
  - **Identita** = čeho se to týká. Vždy jako *úzký proužek* (`.p-stripe`),
    *tečka* (`.p-dot`), tenká linka nebo vlastní malá řada v grafu — nikdy jako
    výplň tlačítka a **nikdy jako barva textu** (v1 barvila název partie v hlavičce
    cviku; ve v2 nese identitu jen tečka vedle šedého textu).
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

Sessions: `{id, date, type: "weights"|"cardio", templateUsed, templateName, core, entries, rating, note}`.
`core` (v1.23) = ruční „core ano/ne" z přepínače v tréninku (jde změnit i zpětně
v detailu tréninku). Zaškrtnutý core se počítá jako pokrytá partie v counteru (✓ místo čísla),
`lastSessionGaps()`, `dayCatColors()`, `catPipsHtml(counts, core)` i v Týdnu;
počty sérií zůstávají jen skutečné série. (Starší aktivní session můžou nést
`startedAt` z v1.23–1.25 — nic ho už nečte.)
U silových `entries[] = {exerciseId, sets: [{reps, weight, note, failure?}]}` — váhy vždy
interně v **kg**, na výstup přes `kgOut()`/`fmtWeight()`. `failure: true` (v1.27) =
mini check „do selhání" **u série** — štítek mezi váhou a křížkem, objeví se na
sérii hned po přidání (`failChipHtml()`, akce `w-set-fail`). Ukládá se jen zapnutý;
oprava čísel série ho nemění. Sbalený cvik ukazuje „do selhání N×", detail štítek
u série, report a export „(do selhání)".

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
- Check-in a fotky (v1.24 sloučené, ve v2.0 v **Pokrok → Tělo**) slouží teď jemu samému
  — sledování změny postavy.
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
- `catPipsHtml()` (`ui.js`) — pokrytí jedním řádkem (Dnes, týden, seznamy
  tréninků, šablony, detail tréninku)
- `lastSessionGaps()` — co uteklo v posledním tréninku; 0 sérií = vynechaná,
  1 série = odbytá, u tréninku ze šablony i porovnání cviků proti plánu.
  Zobrazuje se zlatým řádkem „Minule uteklo" v kartě šablony na řadě (Dnes
  i Trénink).
- `nextTemplate()` — rotace jen přes `activeTemplates()`, tedy šablony použité
  za posledních 42 dní; volný trénink rotaci neposouvá. Martin jede vlastní
  šablonu D a A/B/C po trenérovi nechal ležet — bez tohohle filtru by mu
  „na řadě" navrhovalo plán, který opustil.

Všechny tři šablony trenéra pokrývají všech 7 partií, takže „N ze 7" je reálný
cíl každého tréninku, ne teoretické skóre.

## Vzhled (v2.0 — přestavba od nuly)

Minimalistický, typografický, černý. Martinovo zadání: moderní a čisté, ale stejně
silné jako dřív — a hlavně **super přehled o tréninku a progresu**.

- **Čistá černá** stránka (`--bg`), plochy `--s1`/`--s2`/`--s3` bez přechodů a záře,
  vlasové linky `--hair`. Karty mají jen tenký rámeček; hierarchii nese typografie,
  ne ikony v dlaždicích (ty z v1.23 zmizely, `cardHead()` zůstal jen jako
  kompatibilní stub bez ikony).
- **Sekce = nadpis nad obsahem**: `sec(title, body, {sub, right})` — 20px nadpis,
  šedý podtitulek, vpravo odkaz `secLink("Vše", …)` nebo nástroje.
- **Čísla stejným písmem jako text** (žádné `ui-rounded`). Velká samostatná čísla
  (`.hero-fig`, `.stat-v`) mají proporcionální číslice; `tabular-nums` (`.num`) jen
  tam, kde čísla stojí ve sloupci nebo se mění pod prstem (série, stepper, dock).
  Jedno hlavní číslo (`.hero-fig`) na obrazovku.
- **Tlačítka jsou kapsle**: `.btn` neutrální, `.btn.primary` volt (jedno na
  obrazovku), `.btn.ghost` obrys, `.btn.text` odkaz, `.btn.danger`. Řada tlačítek
  `.btn-row` (`.fit` = nerozpínat).
- Výběr = bílá: `.chip.on`, `.seg-btn.on` (palec segmentu), `.opt.on` (rychlá
  odpověď), `.scale-chip.on`, aktivní položka navigace.
- **Velký titulek** (iOS large title) — `pageHead()` v `app.js`, obrazovka může
  dodat `{eyebrow, title, sub, right, below}`. Top bar je průhledný; po odscrollování
  zesklovatí a ukáže malý titulek. Stránky mají v top baru šipku zpět (`page-back`).
- **Ikony** jsou inline SVG přes `ic(name)` (tah 1,9) — žádné znaky ✕ ✎ ⇄ ‹ ›.
- Grafy podle dataviz pravidel: sloupce ≤ 22 px se zaobleným vrcholem, čára 2 px,
  koncový bod s prstencem v barvě plochy, plocha pod čarou jako 16% přechod,
  vlasová mřížka na „hezkých" hodnotách, text nikdy v barvě série.

### Navigace (v2.0)

Dole **Dnes · Trénink · Pokrok · Více**. Stránky se otevírají nad aktuální kartou
(`goPage(page)` → `App.route = {tab, page}`), navigace drží zvýrazněnou kartu,
ze které přišly. Stránky: `food`, `history`, `records`, `checkin`, `exlib`,
`templates`, `foodlib`, `export`, `settings`, `about` (mapa `PAGES` v `app.js`).
Bývalá karta Týden (tři podzáložky) je rozpuštěná: týden je na Dnes, analytika
v Pokroku, kalendář v Historii, strava v Pokrok → Strava.

### Dnes (`view-today.js`)

Shora dolů od nejbližšího k nejširšímu:
- **Seznam dne** (`todayListHtml()`) — jedna karta s řádky Váha · Trénink · Jídlo
  (+ Týdenní check-in, když je na řadě). Rozbalená je vždy **nejvýš jedna** položka:
  `TV.open` (ruční volba přes `td-open`, `"none"` = vše sbalené), jinak probíhající
  trénink, jinak první nedokončená (`todayOpenKey()`). Hotová položka je řádek
  s volt fajfkou. Váha: stepper po 0,1 (číslo s pevnou desetinou, `fmtFixed()`)
  + pilulka s datem (`weightDatePill()`, `TV.wDate`). Trénink: šablona na řadě
  s pokrytím partií, „Minule uteklo" a Začít. Jídlo: dvě volby (`.opts`) —
  kalorie pod / v cíli / nad a bílkoviny ne / ano; po druhé odpovědi se sbalí,
  klepnutí na hotový řádek ho otevře k opravě, „Smazat dnešní zápis" jde přes
  `withUndo`. S podrobným zápisem ukazuje řádek kalorie a vede na stránku Jídlo.
- **Týden** (`weekSectionHtml()`) — pás 7 dní (volt kolečko = silový trénink,
  červený prstenec = kardio, dvě tečky = váha · jídlo, klepnutí → detail dne),
  čísla tréninky · série · objem se změnou a pokrytí partií za týden („Bez série:
  …" zlatě). Šipkami se listuje do minulých týdnů (`TV.weekOff`). Probíhající týden
  se srovnává **se stejnou dobou minulého týdne**, uzavřený s celým předchozím.
  Rekap minulého týdne je řádek nad kartou (klepnutí = ukáže minulý týden,
  křížek = schovat do dalšího pondělí, `recapDismissed`).
- **Pokrok v kostce** — index síly za 90 dní (graf + „N z M cviků roste") a tři
  dlaždice: Rekordy za 30 dní, Váha Ø 7 dní se změnou za týden, Týdně (Ø tréninků
  za 8 týdnů). Dlaždice vedou do Pokroku / Rekordů.

### Trénink (`view-workout.js`)

- **Start**: karta šablony na řadě (seznam cviků s tečkami partií, „Minule
  uteklo", Začít), seznam Jiný trénink (ostatní šablony ▶, Volný trénink, Kardio),
  Poslední tréninky (`sessionRowHtml()` — datum, čísla, partie, počet rekordů
  `sessionPRCount()`) s odkazem na Historii, dole Rekordy / Templates / Library.
  Den zápisu je **pilulka s datem v titulku** (`w-date`, `w-date-today`) — trénink
  se tak zapíše i zpětně; vybraný den ukáže své zapsané tréninky.
- **Historie** (stránka `history`): kalendář měsíce (`SV.calY/calM`, proužky partií,
  tečka = kalorie v cíli) + čísla měsíce + tréninky měsíce. Klepnutí na den →
  `openDaySummary()` se zápisem do toho dne.
- **Rekordy** (stránka `records`): aktuální PR všech cviků, klepnutí → historie PR.
- **Gym mód** viz níž; po **Hotovo** se otevře další neodcvičený cvik (nejdřív za
  ním, pak od začátku) — o klepnutí méně u každého cviku.

### Zamčený timer (`Dock` v `ui.js`)

Pilulka nad plovoucí navigací, **viditelná na každé obrazovce**: běží-li pauza,
ukazuje odpočet s kroužkem, −30/+30 a zrušení; když pauza neběží a probíhá
trénink, ukazuje počet sérií (`workoutSetsLabel()`) a bílé tlačítko pro ruční
start pauzy. **Časovač celého tréninku není** — v1.26 na Martinovu žádost
odstraněn, nevracet.
Po doběhnutí pauzy 5 s svítí volt „Pauza skončila". Klepnutí vrací na Trénink
(`dock-open`). Při otevřeném sheetu (`body.modal-open`) se přesune nahoru, aby ho
sheet nezakryl — proto má `.modal` max. výšku `100dvh − 76 px`. Stav se odvozuje
z `Rest` a `S.activeSession`; `render()` volá `Dock.sync()`.
`body.has-dock` přidá `--dock-h` do spodního odsazení stránky i pozice toastu.

### Pokrok (`view-progress.js` + `view-checkin.js` + `view-summary.js`)

Karta se segmenty **Trénink · Tělo · Strava** (`PG.seg`, akce `pg-seg`; dlaždice
na Dnes a „Postava a check-in" ve Více skáčou rovnou na segment přes `go-progress`).

**Trénink** — od nejdůležitější odpovědi dolů:
- **Síla**: **index síly** (`strengthIndex()`) — každý cvik se vztáhne ke svému
  prvnímu tréninku v 90denním okně a bere se **medián** (jeden cvik s lehkým
  rozjezdem celek nepřebije); týdenní body ukazují, jak medián rostl. Pod grafem
  cviky (`strengthRows()`): sparkline nejlepšího výkonu v tréninku a změna první →
  poslední. Metrika e1RM, u cviků bez váhy nejvíc opakování (`exerciseSeries()`).
  Klepnutí → `openExerciseProgress()` (graf + nejlepší série po trénincích).
- **Posledních 30 dní** vs předchozích 30 (`periodStats()`): tréninky, série, objem,
  nové rekordy — šipka + číslo (`deltaHtml()`), volt = víc, pokles šedý.
- **Týden po týdnu** — `columnChart` 12 týdnů, přepínač Série / Objem (`PG.metric`).
- **Pravidelnost** — mřížka 16 týdnů × 7 dní, sytost volt podle sérií, červená
  tečka = kardio, klepnutí na den → `openDaySummary()`.
- **Partie** — přepínač (`PG.parts`): Po týdnech = small multiples (každá partie
  vlastní řádek, společné měřítko, Ø za týden a **naposledy** z celé historie,
  zlatě přes 14 dní — `partLastTrained()`), Souhrn = série a objem za rozsah
  Týden / Měsíc / Vše / Vlastní (`SV.catRange`). Záměrně ne skládaný sloupec:
  sedm barev partií od sebe v jednom sloupci spolehlivě rozeznat nejde.
- **Rekordy** — naposledy překonané, „Vše" → stránka Rekordy.

**Tělo** (`renderBody()`) — váha (7denní průměr jako hlavní číslo, změna za týden
a 30 dní, graf průměr + jednotlivá vážení, rozsah 30 / 90 dní / Vše `PG.wRange`),
check-in (stav, Nový check-in, Fotka), před a po (porovnání dvou fotek), obvody
(chipy + graf) a **historie** — check-iny a fotky podle data. Formulář check-inu
je stránka `checkin` (`openCheckinForm()` nastaví route; zpět/Zrušit vyčistí
`CV.form` i vybranou fotku). Fotku jde přidat přímo ve formuláři (`CV.photoFile`),
uloží se se stejným datem. Fotky dál jen v IndexedDB (`photos.js`, stav `PV`).
Řádek check-inu jde kopírovat ve sloupcích tabulky (ikona). Texty „pro trenéra"
jsou pryč, funkce zůstaly.

**Strava** (`foodProgressHtml()`) — tento týden (prstenec dodržování z rychlého
i podrobného zápisu, bílkoviny, váha Ø a změna), posledních 30 dní (Ø kcal, dny
v cíli, Ø makra, graf kalorií s cílem), bilance po týdnech (Ø příjem vs změna
7denního průměru váhy) a vstup do jídelníčku.

**Cloud sync** je v Export & Backup (ne v Nastavení): URL se ukládá hned po
změně pole (`data-change="set-gas"`), stav syncu překresluje jen štítek
`#syncBadge`, aby se nesmazala rozepsaná URL.

### Výběr cviku (`openExPicker()` v `ui.js`)

Společný pro přidání/výměnu v tréninku i přidání do šablony. Titulek, hledání
a chipy partií jsou v **lepkavé hlavičce sheetu** (`.sheet-sticky`) — zůstávají
nahoře, zatímco seznam scrolluje. Lepkavá hlavička má `top: −24px` (= horní
padding sheetu): prohlížeč měří sticky od content boxu, s `top: 0` by se posunula
a překryla první řádek seznamu. **Výměna cviku otevře rovnou jeho partii.**
Hledá se v českém i anglickém názvu bez diakritiky (`norm()`, `exMatches()`);
když ve vybrané partii nic není, nabídne „Hledat ve všech partiích". Cviky,
které v tréninku/šabloně už jsou, jsou vidět ztlumeně bez akce (`used(id)`).
Exercise Library má totéž hledání v lepkavém panelu pod top barem (`.sticky-bar`,
sklo dostane až po přilepení — třída `.stuck` z `updateTopbar()`).

## Gym mód (aktivní trénink)

- Probíhající trénink nese název a průběh ve velkém titulku (hotové cviky / série,
  tenký volt pruh). Nad cviky counter partií (viz Pokrytí partií).
- Sbalené cviky jsou **řádky na pozadí** oddělené linkou (proužek partie, číslo /
  volt fajfka, souhrn sérií, „do selhání N×", úchyt); otevřený cvik je karta.
  V kartě: partie (tečka + šedý text) · pořadí, název, anglický název, výměna
  a odebrání, **Technika** jako `<details>` (popis cviku), nápovědy jako řádky
  s ikonou — rekord (zlatě), minule, návrh progrese (volt), blízko rekordu (zlatě).
  Série: číslo, hodnota, PR štítek, mini check „do selhání", křížek. Steppery
  opakování a váhy, **poznámka k sérii** schovaná v `<details>` (rozbalí se sama,
  když opravovaná série poznámku má), Přidat sérii (volt) + Hotovo.
- Pod cviky Přidat cvik, přepínač **Core ano/ne** (`coreCardHtml()`; se zapsanými
  sériemi core je zapnutý sám), Dokončit trénink (volt) a Zrušit (textově červeně).
- **Zpětná úprava tréninku** (v1.25) — v detailu tréninku (`sessionDetailHtml()`,
  i z kalendáře a seznamů) je **Upravit**: `beginEditSession(id)` otevře uložený
  trénink ve stejném editoru jako živý — `S.activeSession` se stejným id
  a `editOf: id`, cviky sbalené jako hotové. Původní záznam v `S.sessions` zůstává
  nedotčený, dokud `finishWorkout()` („Uložit změny") nepřepíše jeho
  entries/datum/core (hodnocení a poznámka zůstanou); „Zahodit úpravy" ho nechá
  být. V úpravě jde změnit datum (`w-edit-date`), nespouští se pauza, dock nemá
  tlačítko pauzy a skryje se návrh progrese i „blízko rekordu". Úprava nejde,
  když běží živý trénink. Kardio se upravuje ve svém formuláři
  (`openCardioModal(id)`), hodnocení přes `openRatingModal(id, true)`.
- **Oprava série** — klepnutí na sérii v otevřeném cviku ji načte do stepperů
  (`WV.editSet`), „Uložit N. sérii" ji přepíše na místě (`saveSetEdit()`); funguje
  v živém tréninku i v úpravě. `WV.editSet` se nuluje při každé změně indexů
  (otevření/zavření cviku, smazání série či cviku, výměna, přetažení).
- **Přetahování cviků** (v1.22) — `Drag` ve `view-workout.js`, úchyt vpravo
  u sbalených řádků (`dragHandleHtml()`, `touch-action: none` jen na úchytu).
  Pointer events, pozice v souřadnicích dokumentu (autoscroll u okraje nerozhodí
  cíl), cíl = počet řádků se středem nad středem taženého — funguje i s vysokým
  otevřeným cvikem. `moveExercise()` přepočítá `WV.openIdx` a vrátí rozepsanou
  sérii do polí. Otevřený cvik úchyt nemá. Klik těsně po puštění (≤ 350 ms)
  delegace zahodí — iOS ho posílá navíc.

## Zamčená obrazovka (v1.22)

Chová se jako nativní appka — bez zoomu, bez houpání, bez skákání:

- viewport `maximum-scale=1, user-scalable=no` + `gesturestart` preventDefault
  (iOS pinch) + `touch-action: manipulation` na body (double-tap zoom)
- **pole mají písmo 16 px** — pod 16 px iOS při klepnutí do pole přiblíží
  stránku. Nezmenšovat.
- `overscroll-behavior: none` (žádné gumové houpání) a `overflow-x: clip`.
  **Ne `hidden`** — to z body udělá scroll kontejner a rozbije `window.scrollTo`
  i autoscroll při přetahování.
- `render()` skáče nahoru **jen při změně obrazovky** (nebo `render({top: true})`,
  které volají `nav` a `menu`). Dřív skákal po každém překreslení, takže přidání
  série vyhodilo obrazovku na začátek.
- **Shake to Undo** (v1.22.1): `beforeinput` s `historyUndo`/`historyRedo` se
  v `app.js` ruší, takže zatřesení nevrátí text rozepsaný v poli. Systémový
  dialog „Odvolat psaní" zablokovat nejde — vypíná ho jen nastavení iOS.
  **Ověřitelné jen na iPhonu:** `execCommand("undo")` v desktopovém prohlížeči
  `beforeinput` neposílá, takže test v preview nic nedokazuje.
- `parseDec("")` vrací **`NaN`, ne `null`** — kontroluj `Number.isFinite()`
  nebo `isNaN()`. Stepper to do v1.22.1 nedělal a u cviku bez historie
  ukázal po klepnutí na + „NaN".

## Záměrně neimplementováno

Streak počítadlo (trestá plánovaná volna), cardio „phases", stretch library.
Sociální feed a veřejné rutiny (appka je jednouživatelská, bez backendu).
AI kouč nad vlastními daty — postavený ve v1.20, na Martinovu žádost hned
zase smazaný (v1.21). Nestavět znovu, dokud si o to výslovně neřekne.
Rest timer původně taky vyloučen, ale uživatel si ho později vyžádal (v1.10).
