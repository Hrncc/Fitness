# Fitness Log — kontext projektu

Osobní PWA pro zápis silových a kardio tréninků a stravy. **Jeden uživatel** (Martin),
žádná registrace, žádný vlastní backend. UI je celé česky.

## Tech a zásady

- **Vanilla HTML/CSS/JS, žádný build step, žádný framework.** Skripty se načítají
  přímo v `index.html` v daném pořadí — nový soubor je nutné přidat i do
  `SHELL` pole v `sw.js`.
- Appka musí zůstat **self-contained** (žádné CDN). Proto je QR generátor
  (`js/qr.js`) psaný od nuly. Písmo je od v4.0 systémové (SF Pro / SF Pro
  Rounded) — žádné soubory písma (Barlow z v3.0 i složka `fonts/` jsou pryč).
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
| `js/data.js` | stav `S`, `save()`, `replaceState()`, PR logika a **rekordy čtyř druhů** (`exerciseRecords()`), plán cviku v šabloně (`tplPlan()`), druhy cviků (`exKind()`), milníky, plán trenéra, barvy partií (`CAT_COLOR`, `CAT_ORDER`, `sessionCatSets()`, `dayCatColors()`) |
| `js/sync.js` | cloud sync + `mergeStates()` (slévání podle id) |
| `js/foodapi.js` | OFF (cz → world), USDA, Claude vision (etiketa / jídlo), čárový kód |
| `js/ui.js` | ikony `ic()`, sekce `sec()`/`secHead()`/`secLink()`, iOS seznam `listGroup()`/`lgLink()`/`lgField()`/`lgSwitch()`, segmenty `segHtml()`, čísla `statHtml()`, české tvary `plural()`, data `fmtShort()`/`relDay()`, `fmtVolume()`, `fmtFixed()`, toast (i s akcí), sheet (+ zavření stažením `SheetDrag`), výběr cviku `openExPicker()`, kalendář, SVG grafy (`lineChart`, `columnChart`, `sparklineHtml`) + dotykový readout `ChartTip`, rest timer `Rest` + zamčený timer `Dock`, nezhasínání obrazovky `KeepAwake`, `dayNavHtml()` |
| `js/view-today.js` | **Dnes** — seznam dne (váha · trénink · jídlo · check-in), týden s listováním, pokrok v kostce |
| `js/view-workout.js` | **Trénink** — start (šablona na řadě, ostatní, kardio, čerstvost partií, poslední tréninky), gym mód (plán, supersety, stopky, menu cviku ⋯, kotouče, RIR), shrnutí po tréninku, stránky Historie a Rekordy, detail tréninku |
| `js/view-progress.js` | **Pokrok** — segmenty Trénink · Tělo · Strava; segment Trénink (index síly, 30 dní, týdny, pravidelnost, partie, rekordy) |
| `js/view-checkin.js` | Pokrok → **Tělo** (váha, check-in, fotky, obvody, historie) + stránka formuláře check-inu |
| `js/view-summary.js` | Pokrok → **Strava**, detail dne `openDaySummary()`, `movingAvgAt()`, stav kalendáře `SV` |
| `js/view-food.js` | stránka **Jídlo** (denní log) + přidání jídla (hledání, foto, oblíbené, ručně) |
| `js/view-menu.js` | stránka **Více** (`renderMore()`) + stránky Knihovna cviků, Šablony tréninků (+ editor plánu `openPlanModal()`), Knihovna jídel, Záloha a export (+ CSV sérií `buildSetsCsv()`), Nastavení, O aplikaci; fotky (`PV`) |
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
  jinak se smazaná věc vrátí ze syncu z druhého zařízení. Od v4.1 snapshot přežije
  i obnovení stránky (`sessionStorage`, `restorePendingUndo()`) a velké ztráty
  (zrušení i smazání tréninku, import zálohy) mají okno 12 s (`withUndo(msg, fn, 12000)`).
- **Desetinná čísla:** vstupy jsou `type="text" inputmode="decimal"` a parsují se
  přes `parseDec()`. `type="number"` na iOS zahazuje českou desetinnou čárku.
- **Barevná logika — dvě vrstvy** (v1.16, ve v2.0 zúžená; nesahat bez důvodu):
  - **Stav** = co se právě děje. Vždy jako *výplň* nebo plný text.
    volt = **hlavní akce obrazovky** (jedno volt tlačítko na obrazovku), splněno
    (fajfky, odcvičený den) a zlepšení (šipka nahoru, progres k cíli),
    zlatá = **jen rekordy** (od v4.1 — varování „něco ti utíká" jako Minule uteklo,
    Bez série, dlouho netrénovaná partie nebo kotouče jsou bílý text se šedou
    ikonou ⚠, `.warn-text` / `.td-warn`), červená = chyby, mazání,
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

`bodyLog`: `{date, weightKg, at}` — `at` (v2.2) = kdy se váha zapsala; ukazuje se
přesné datum vážení „po 5. 10. · 7:12" (`weightStamp()`, `fmtDayDate()`), čas jen
když zápis padl do stejného dne (`timeOnDay()`) — u zpětného zápisu by nic neříkal.

`dayLog` (v1.17): `{date, foodRating: "under"|"ok"|"over", proteinOk}` — rychlý
zápis dne dvěma klepnutími. Slévá se podle `date` jako `bodyLog`.
`effectiveDayRating(date)` dává přednost podrobnému `foodLog`, když pro den
existuje; ruční odhad ho nepřepíše. `adherence(from, to)` z toho počítá
dodržování pro check-in — nezapsaný den se nepočítá ani do jmenovatele.

Sessions: `{id, date, type: "weights"|"cardio", templateUsed, templateName, core, entries, rating, note}`.
`core` (v1.23) = ruční „core ano/ne" z přepínače v tréninku (jde změnit i zpětně
v detailu tréninku). Zaškrtnutý core se počítá jako pokrytá partie v counteru (✓ místo čísla),
`lastSessionGaps()`, `dayCatColors()`, `catPipsHtml(counts, core)` i v Týdnu;
počty sérií zůstávají jen skutečné série.
`startedAt` (v2.2) = časová značka, kdy se trénink zapnul — jen u živého tréninku
s dnešním datem (`beginWorkout`, `repeatSession`); zpětný zápis ho nemá, úprava
ho nemění. Ukazuje se jen **čas začátku** („od 18:42", `startedLabel()`, `fmtTime()`)
v titulku gym módu, v docku, na Dnes, ve shrnutí, v detailu, v řádcích tréninků,
v CSV a reportu — **žádný běžící časovač ani délka tréninku** (v1.26 platí dál).
(Aktivní session z v1.23–1.25 ho můžou nést taky — teď se ukáže jako začátek.)
U silových `entries[] = {exerciseId, sets: [{reps, weight, note, failure?, rir?}]}` — váhy vždy
interně v **kg**, na výstup přes `kgOut()`/`fmtWeight()`. `failure: true` (v1.27) =
mini check „do selhání" **u série** — štítek mezi váhou a křížkem, objeví se na
sérii hned po přidání (`failChipHtml()`, akce `w-set-fail`). Ukládá se jen zapnutý;
oprava čísel série ho nemění. Sbalený cvik ukazuje „do selhání N×", detail štítek
u série, report a export „(do selhání)". `rir` (v4.0, 0–4, 4 = „4+") = opakování
v záloze; zapisuje se jen se zapnutým Nastavení → Zapisovat RIR (`rirMode`),
RIR 0 nastaví i `failure`. Ukazuje se u série („· RIR 2"), v detailu, v CSV
(sloupec `rir`), v Markdownu a reportu.

**v2.1 — plán, supersety, druhy cviků:**
- Cvik: `kind` = `"weight"` (výchozí) | `"bw"` (vlastní váha + volitelná zátěž,
  `weight` = zátěž, 0 = bez) | `"time"` (výdrž; **sekundy se ukládají do `reps`**,
  `weight` 0). Výchozí druhy pro plank, kliky, shyby, dipy… doplní migrace
  `applyExerciseKinds()` (flag `kindsV1`, `KIND_DEFAULTS`); ve formuláři cviku jde
  změnit. `pin` = připnutá poznámka ke cviku (nastavení stroje, úchop) — patří
  cviku, ne tréninku, ukazuje se v každém tréninku.
- Šablona: `plan = {[exerciseId]: {sets, lo, hi, rest, link}}` — série, rozsah
  opakování (u výdrže sekund), pauza v s (`null` = výchozí z Nastavení) a superset
  s dalším cvikem. Bez vlastního plánu čte `tplPlan()` série a rozsah z popisu
  cviku („3× 8–12 — …", mají ho cviky trenéra; „2× 12/10/8" ani „3× 10 / 20–30 s"
  se záměrně nečtou). Editor plánu bez existujícího plánu nechá rozsah prázdný —
  samotný superset nebo pauza nesmí potichu založit rozsah (spustil by návrhy
  progrese).
- Aktivní session: `entry.target` (cíl ze šablony při startu, `null` = bez plánu),
  `entry.link` (superset s dalším). Uložená session nese jen `link` — a jen když
  se odcvičil i ten další cvik (jinak by se po vynechání prázdných spojil s jiným).

**Rekordy (v2.1)** — `exerciseRecords(id)` → `{events, state, best}`, cache podle
revize dat (`_dataRev` z `persist()`). Čtyři druhy (`REC_LABEL`, pořadí `REC_ORDER`):
odhad 1RM, nejtěžší váha, **opakování** (víc než kdykoli při stejné nebo vyšší váze)
a nejlepší série (váha × opakování). Rekord vyžaduje předchozí sérii cviku — první
trénink nového cviku nic nesbírá. Události se **slévají na jednu za cvik a trénink**
(sjednocené druhy, `sets` = všechny série s rekordem jako `[k, j]`) — jinak by
každá další lepší série v tom samém tréninku byla další „rekord" a počty by
nafoukly. Živě v tréninku hlásí toast každou sérii (`liveRecordTypes()`).
Počty v Dnes / Pokrok / Rekordy / reportu jdou přes `recordEventsInRange()`.
`currentPR()` (e1RM) zůstal pro nápovědy v gym módu a hodnoty v seznamu Rekordů.

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

Od v4.0 testuj **v obou režimech** (`prefers-color-scheme` light i dark) a s **větším
textem** (`document.documentElement.style.fontSize = "23px"` / `"28px"` simuluje iOS
Velikost textu, až `"34px"`) — nic nesmí přetékat do strany **ani z karty či sheetu**
(od v4.1 se kontroluje i vnitřní přetečení — prvek proti nejbližší kartě, seznamu
nebo sheetu —, samotné `scrollWidth` ho nepozná). SF Pro mimo Apple zařízení
není; na Linuxu podobné metriky dává Inter (v testech se podstrčí přes `--font`).

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
Sbalený je **pruh** se sériemi (v posilovně je místo na obrazovce nejcennější);
partie bez série je obrys s **písmenem partie** a barevnou linkou dole (v4.1 —
dřív šedá „0" bez barvy, partie šla poznat jen podle pozice), každá buňka má `aria-label`. Rozbalený
má při velkém textu jeden sloupec.
klepnutím (`w-counter`) se rozbalí na **cviky · série** u každé partie —
série samy nerozliší „tři série na jednom cviku" od „tři cviky po jedné".
Pořadí je pevné podle těla (`CAT_ORDER`), ať se buňky pod prstem nepřeskupují.

- `sessionCatSets()` / `sessionCatExercises()` — série a cviky na partii
- `catPipsHtml()` (`ui.js`) — pokrytí jedním řádkem (Dnes, týden, seznamy
  tréninků, šablony, detail tréninku)
- `lastSessionGaps()` — co uteklo v posledním tréninku; 0 sérií = vynechaná,
  1 série = odbytá, u tréninku ze šablony i porovnání cviků proti plánu.
  Zobrazuje se řádkem s ikonou ⚠ „Minule uteklo" v kartě šablony na řadě (Dnes
  i Trénink).
- `nextTemplate()` — rotace jen přes `activeTemplates()`, tedy šablony použité
  za posledních 42 dní; volný trénink rotaci neposouvá. Martin jede vlastní
  šablonu D a A/B/C po trenérovi nechal ležet — bez tohohle filtru by mu
  „na řadě" navrhovalo plán, který opustil.

Všechny tři šablony trenéra pokrývají všech 7 partií, takže „N ze 7" je reálný
cíl každého tréninku, ne teoretické skóre.

## v4.1 — kritika a polish podle skillu Impeccable

Martin chtěl „critique a polish" skillem **Impeccable**.
Kritika = dva nezávislé posudky (designová recenze + detektor a prohlížeč),
skóre 28/40; snapshot leží lokálně v `.impeccable/critique/` (v `.git/info/exclude`,
do repa nepatří). Martin vybral všechny čtyři oblasti (váha série a nevratné
ztráty, gym mód, přístupnost a kontrast, drobnosti), **rekord jako hlavní moment**
konce tréninku, zrušení tréninku **druhým klepnutím + delší Vrátit** a **české
názvy stránek** (Knihovna cviků, Šablony tréninků, Knihovna jídel, Záloha a export).

- **Zlatá jen pro rekordy**, varování jsou neutrální s ikonou ⚠ (viz Barevná logika).
- **Žádný štítek nad nadpisem** (eyebrow / kicker): `.td-eyebrow`, `.page-head .eyebrow`
  i `.ex-cat` jsou pryč, doplňující údaj jde **pod** nadpis (Dnes: datum pod „Dnes",
  šablona na řadě: „Na řadě · …" pod názvem, cvik: partie pod anglickým názvem).
- **Nevratné ztráty:** Vrátit přežije obnovení stránky (`fitapp_undo` v `sessionStorage`),
  12 s u zrušení / smazání tréninku a importu; odebrání cviku ze šablony (`tpl-rm`)
  jde přes `withUndo`; **fotka se maže měkce** — `deletePhoto()` ji schová
  (`PV.pendingDel`), z IndexedDB ji smaže až po 8 s, `ph-undo` ji vrátí.
- **Přístupnost:** sheet je `role="dialog"` + `aria-modal` + `aria-labelledby="modalTitle"`,
  při otevření jde fokus do sheetu (křížek) a po zavření zpět (`_modalReturn`),
  Escape zavře. Toast je `role="status"` `aria-live="polite"`. `a11yActs(root)`
  (volá ho `render()` i `openModal()`) dá prvkům s `data-act` bez nativní role
  `tabIndex = 0` + `role="button"`, Enter / mezerník je spustí. Prstenec fokusu
  jen z klávesnice (`:focus-visible`) — po klepnutí prstem nesvítí.
- **Kontrast:** budoucí dny týdne bez `opacity` (dřív 1,5:1), štítek „selhání" bez
  `opacity`, tečky legendy s obrysem `--hair2` (volt na bílé zmizel).
- **Velký text:** toast má `width: max-content` (s `left: 50%` měl strop na půlce
  obrazovky a lámal „42,5 / kg"), jednotky čísel v `em`, container queries:
  čerstvost partií 4 sloupce, rozbalený counter 1 sloupec, kroužek týdenního cíle
  nad čísly (`.period-stats`), logo v O aplikaci se láme (`<wbr>`).
- **Gym mód:** živý titulek menší (`.page-head.live`), hlášky nahoře, chyba u pole,
  písmena v counteru, váha další série podle dneška (viz Gym mód).
- **Drobnosti:** editor plánu nabízí výchozí pauzu jen jednou („výchozí 2:00")
  a prázdný rozsah ukazuje „od" / „do"; navigátor dne „před N dny" místo
  opakovaného data; `isOwnExercise(e)` — štítek „vlastní" jen u Martinových cviků
  (`cp-*` mají `isCustom` z importu); migrace `applyExerciseKindsV2()` (flag
  `kindsV2`) dá cvikům trenéra `cp-a1`, `cp-b1` druh vlastní váha; pohár v detailu
  tréninku ukazuje stejný počet jako seznam (`sessionPRCount()`).
- **Plochy prohlížeče** z palety: `::selection` (`--select-bg`), `caret-color`
  a `accent-color` = `--green-ink`.
- Detektor po polish hlásí jen `pulsing-dot` — tečka živého tréninku v docku.
  **Záměrná výjimka**: ukazuje skutečně živý stav a s omezeným pohybem stojí.

## Vzhled v4.0 — Apple (HIG) podle skillů apple-design a swiftui-pro

Martin dal skilly [apple-design](https://github.com/dickwu/apple-design-skill)
(recenze podle Apple Human Interface Guidelines) a
[swiftui-agent-skill](https://github.com/twostraws/swiftui-agent-skill) (psaní
SwiftUI — pro webovou appku platí jen jeho designová pravidla) a chtěl „Apple
vzhled + menší funkce". Z návrhu vybral: systémové písmo + Dynamic Type, světlý
i tmavý režim, iOS seznamy, sheety stažením, Více jako stránka; kotouče, RIR,
čerstvost partií. **Nevybral (zatím):** trénink přes celou obrazovku, tabulku
sérií ve stylu Strong/Hevy, nativní SwiftUI appku — viz Záměrně neimplementováno.

- **Písmo:** `--font` = `-apple-system` (SF Pro; nadpisy Safari sám přepne na SF
  Pro Display), `--font-num` = `ui-rounded` (SF Pro Rounded, jako Apple Fitness
  a Zdraví) na samostatná čísla (`.hero-fig`, `.stat-v`, `.step-val`, dock, čísla
  dnů…). Prostrkání nechává na systému — **žádné záporné letter-spacing**.
- **Dynamic Type:** `html { font-size: 17px; font: -apple-system-body; }` — na iPhonu
  dá základ podle Nastavení → Velikost textu, jinde zůstane 17 px. **Všechny
  velikosti písma jsou v `rem`** (px ÷ 17), takže při výchozí velikosti vypadají
  stejně jako dřív v px. Pole `max(16px, …)` (kvůli zoomu iOS). Textové prvky mají
  `min-height` místo `height`, mřížky `minmax(0, 1fr)`, velká čísla `min(…rem, …vw)`.
  Ověřeno bez přetečení až do 34 px základu — přes okraj obrazovky i uvnitř karet
  a sheetů (to druhé až od v4.1; dřív se hlídal jen okraj a uvnitř se věci tloukly).
  **Jednotky u velkých čísel v `em`** (`.stat-v small` …): číslo má strop ve `vw`,
  jednotka v `rem` by ho při velkém textu přerostla a vylezla z karty.
- **Světlý režim** (`@media (prefers-color-scheme: light)`, výchozí zůstává tmavý):
  iOS plochy `--bg #F2F2F7`, karty bílé. Volt zůstává **výplní** s tmavým textem;
  jako **text nebo tenká čára** je `--green-ink` (tmavý režim = volt, světlý
  #3F6E0A). Zlatá a červená ve světlém ztmavené. **Výběr** je `--sel`/`--on-sel`
  (tmavý: bílá s černým textem, světlý: černá s bílým) — nepoužívat `var(--text)`
  + `#000`. Stisk `--press`, podbarvení `--tint`, palec segmentu `--thumb`,
  stíny `--sheet-shadow`/`--shadow-float`, Pravidelnost `--hm1–3`. Natvrdo
  dané barvy v pravidlech nepoužívat. Všechny textové role ≥ 4,5:1 na `--s1`,
  `--s2` i `--bg` v obou režimech (t0 to hlídá).
- Stavový řádek `apple-mobile-web-app-status-bar-style: default` (řídí se
  režimem; `black-translucent` má vždy bílý text) a `theme-color` pro oba režimy.
- **Více je záložka se stránkou** (`TABS.more`, `renderMore()`) — HIG: záložky
  navigují, nespouštějí akce. Stránky z ní mají zpět na Více.
- **iOS seznam** (`listGroup()` + `lgLink`/`lgField`/`lgSwitch`, třídy `.lg*`):
  Více a Nastavení. **Nastavení se ukládá hned po změně** (`data-change="set-field"`
  → `saveSettings()`), tlačítko Uložit není; jednotka je segment kg/lb (`set-unit`).
- **Sheet stažením dolů** (`SheetDrag` v `ui.js`): když je obsah nahoře, tah dolů
  sheet táhne; zavře od 110 px nebo rychlým švihem, jinak se vrátí. Pole, chipy
  `.chips.scroll`, grafy s readoutem a `.no-sheet-drag` tah nezačínají.

## Vzhled v3.0 — podle skillu UI/UX Pro Max (nad základem v2.0)

Martin chtěl appku předělat podle skillu [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill).
Z jeho návrhu pro fitness tracker se vzal styl (Minimalism + Dark Mode OLED — sedí
na v2.0), písmo a pravidla přístupnosti. **Nevzala** se jeho paleta (oranžová +
zelená na břidlicové) — kolidovala by s identitou partií (Ramena) a zlatou pro
rekordy a zrušila OLED černou. Jeho vzor „Feature-Rich Showcase" je pro landing
page, ne pro appku.

- ~~**Písmo:**~~ (v4.0 nahrazeno systémovým, viz výš) text `Barlow` (`--font`), čísla a nadpisy `Barlow Condensed`
  (`--font-display`: velký titulek, nadpisy sekcí a sheetů, hlavní čísla, steppery,
  dock, čísla dnů, názvy cviků) a úzké verzálky u štítků (`.td-eyebrow`, `.ex-cat`,
  `.h3`). Úzké písmo je o stupeň větší než dřív. Základ těla 16 px, záporné
  prostrkání z v2.0 (laděné na SF) je na třetině. Jen řezy 400/500/600/700 (text)
  a 600/700 (Condensed) — jiné váhy v CSS nepoužívat.
- **Kontrast:** `--text3` (ztlumený **text**) je `#86868C` = 5,3:1 na kartě
  (dřív #626268 = 3,2:1, pod WCAG AA). Na čistou dekoraci (tečky, úchyty, linky)
  je `--text4` (#626268) — na text ji nepoužívat.
- **Text nikdy pod 12 px** (ani popisky grafů v SVG).
- **Dotykové plochy ≥ 44 px:** malé ovládací prvky dostávají neviditelný přesah
  `::before` (vzhled se nemění), u sousedů blíž než 8 px jen svisle. `.iconbtn.sm`
  36 px, chipy a kapsle 36 px. Nový malý prvek = přidat ho do bloku „dotykové
  plochy" na konci CSS (t0 to hlídá).
- **Fokus:** `:focus-visible` = 2px volt prstenec (`--ring`); pole mají vlastní stav.
- **Tokeny:** sémantické role `--primary/--on-primary/--muted-fg/--border/--ring`
  (mapují se na stávající paletu), mezery `--sp-1…8` (rytmus 4/8; karty 16 px,
  okraj stránky `--pad` 16 px), pohyb `--dur-fast` 120 ms (odezva na klepnutí),
  `--dur`, `--dur-slow`.
- **Ikony místo znaků:** toast „ok" kreslí SVG fajfku a koncové „✓" z textu sám
  odstraní; fajfky v counteru partií a u jídla jsou `ic("check")`.
- **Grafy:** Pravidelnost má stupnici s čísly („1–8 · 9–16 · 17+ sérií"), ne jen
  sytost barvy. `fmtNum()` nevrací „-0".
- **Záměrná odchylka od skillu:** zoom zůstává vypnutý (viz Zamčená obrazovka) —
  skill to bere jako chybu přístupnosti, Martin chce pocit nativní appky.

## Vzhled (v2.0 — přestavba od nuly)

Minimalistický, typografický, černý. Martinovo zadání: moderní a čisté, ale stejně
silné jako dřív — a hlavně **super přehled o tréninku a progresu**.

- **Čistá černá** stránka (`--bg`), plochy `--s1`/`--s2`/`--s3` bez přechodů a záře,
  vlasové linky `--hair`. Karty mají jen tenký rámeček; hierarchii nese typografie,
  ne ikony v dlaždicích (ty z v1.23 zmizely, `cardHead()` zůstal jen jako
  kompatibilní stub bez ikony).
- **Sekce = nadpis nad obsahem**: `sec(title, body, {sub, right})` — 20px nadpis,
  šedý podtitulek, vpravo odkaz `secLink("Vše", …)` nebo nástroje.
- **Čísla:** od v4.0 SF Pro Rounded (`--font-num`, viz Vzhled v4.0). Velká samostatná čísla
  (`.hero-fig`, `.stat-v`) mají proporcionální číslice; `tabular-nums` (`.num`) jen
  tam, kde čísla stojí ve sloupci nebo se mění pod prstem (série, stepper, dock).
  Jedno hlavní číslo (`.hero-fig`) na obrazovku.
- **Tlačítka jsou kapsle**: `.btn` neutrální, `.btn.primary` volt (jedno na
  obrazovku), `.btn.ghost` obrys, `.btn.text` odkaz, `.btn.danger`. Řada tlačítek
  `.btn-row` (`.fit` = nerozpínat).
- Výběr = bílá: `.chip.on`, `.seg-btn.on` (palec segmentu), `.opt.on` (rychlá
  odpověď), `.scale-chip.on`, aktivní položka navigace.
- **Velký titulek** (iOS large title) — `pageHead()` v `app.js`, obrazovka může
  dodat `{title, sub, right, below, cls}` (štítek nad titulkem je od v4.1 pryč). Top bar je průhledný; po odscrollování
  zesklovatí a ukáže malý titulek. Stránky mají v top baru šipku zpět (`page-back`).
- **Ikony** jsou inline SVG přes `ic(name)` (tah 1,9) — žádné znaky ✕ ✎ ⇄ ‹ ›.
- Grafy podle dataviz pravidel: sloupce ≤ 22 px se zaobleným vrcholem, čára 2 px,
  koncový bod s prstencem v barvě plochy, plocha pod čarou jako 16% přechod,
  vlasová mřížka na „hezkých" hodnotách, text nikdy v barvě série.

### Navigace (v2.0)

Dole **Dnes · Trénink · Pokrok · Více** (Více je od v4.0 záložka se stránkou, ne sheet). Stránky se otevírají nad aktuální kartou
(`goPage(page)` → `App.route = {tab, page}`), navigace drží zvýrazněnou kartu,
ze které přišly. Stránky: `food`, `history`, `records`, `checkin`, `exlib`,
`templates`, `foodlib`, `export`, `settings`, `about` (mapa `PAGES` v `app.js`).
Bývalá karta Týden (tři podzáložky) je rozpuštěná: týden a měsíční kalendář
jsou na Dnes, analytika v Pokroku, kalendář s proužky partií v Historii, strava
v Pokrok → Strava. **Kalendář musí být vidět** — ve v2.0–2.1 byl jen v Historii
za odkazem a Martin ho postrádal; v2.1.1 ho dala na Trénink, v2.2 na jeho přání
na Dnes, sloučený s „Tento týden" (Více → „Kalendář a historie" vede do Historie).

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
- **Týden a kalendář** (`weekSectionHtml()`, v2.2) — jedna sekce: pás 7 dní se
  přepínačem **Měsíc ⌄** (`td-cal`, `TV.cal`) rozbalí do celého měsíce se stejnými
  buňkami (`dayCellHtml()`; `monthSectionHtml()`, sdílí `SV.calY/calM` s Historií),
  šipky pak listují měsíce (`td-month`, ne do budoucna) a čísla i partie platí pro
  měsíc (probíhající proti stejné době minulého, uzavřený proti celému předchozímu;
  kroužek týdenního cíle jen v týdnu). Zpět na týden ukáže týden konce měsíce.
  Buňka: volt kolečko = silový trénink, červený prstenec = kardio, dvě tečky =
  váha · jídlo, klepnutí → detail dne. Týdenní pás:
  čísla tréninky · série · objem se změnou a pokrytí partií za týden („Bez série:
  …" s ikonou ⚠). Šipkami se listuje do minulých týdnů (`TV.weekOff`). Probíhající týden
  se srovnává **se stejnou dobou minulého týdne**, uzavřený s celým předchozím.
  Rekap minulého týdne je řádek nad kartou (klepnutí = ukáže minulý týden,
  křížek = schovat do dalšího pondělí, `recapDismissed`).
  **Týdenní cíl** (v2.1, Nastavení → `weeklyGoal`, výchozí 3, 0 = vypnuto):
  první číslo týdne je kroužek „N / cíl" (`goalStatHtml()`), volt fajfka po splnění.
  **Není to streak** — počítá jen tenhle týden, nic se nepřenáší, volno nic nestojí.
- **Pokrok v kostce** — index síly za 90 dní (graf + „N z M cviků roste") a tři
  dlaždice: Rekordy za 30 dní, Váha Ø 7 dní se změnou za týden, Týdně (Ø tréninků
  za 8 týdnů). Dlaždice vedou do Pokroku / Rekordů.

### Trénink (`view-workout.js`)

- **Start** (v2.1.2 — na Martinovo „kompaktnější, víc minimalismu"): jedna nízká
  karta `.next-card` — název šablony na řadě a pod ním „Na řadě · N cviků ·
  naposledy …" (`lastTemplateSession()` — datum **té šablony**, do v4.1 to bylo
  datum posledního tréninku vůbec) s volt **Začít** vpravo, případně řádek ⚠ „Minule uteklo",
  pod linkou ostatní volby jako malé kapsle `.start-opt` bez ikon (ostatní
  šablony, Volný, Kardio s tečkou). Seznam cviků šablony na startu záměrně není.
  Pod ní **Čerstvost partií** (v4.0, `freshnessHtml()` z `partLastTrained()`):
  dny od poslední série na partii v pořadí `CAT_ORDER` — dnes/včera šedě
  (regeneruje), přes 14 dní bíle s ikonou ⚠; při velkém textu 4 sloupce místo 7
  (container query na `.fr-wrap`). Záměrně jen dny, žádné % regenerace (jako
  Fitbod) — předstíralo by přesnost, kterou z dat neznáme.
  Kalendář tu od v2.2 není (je na Dnes). Pak **Naposledy** — 3 tréninky (`sessionRowHtml()` — datum,
  čísla, partie, počet rekordů `sessionPRCount()`) s odkazem Historie, a dole
  jedna řada kapslí Rekordy · Templates · Library (`.quick-links`).
  Den zápisu je **pilulka s datem v titulku** (`w-date`, `w-date-today`) — trénink
  se tak zapíše i zpětně; vybraný den ukáže své zapsané tréninky.
- **Historie** (stránka `history`, i z Více → Kalendář a historie): kalendář měsíce (`SV.calY/calM`, proužky partií,
  tečka = kalorie v cíli) + čísla měsíce + tréninky měsíce. Klepnutí na den →
  `openDaySummary()` se zápisem do toho dne.
- **Rekordy** (stránka `records`): počty za 30 / 90 dní, cviky podle posledního
  rekordu, klepnutí → `openPRHistory()` — dlaždice nejlepších hodnot podle druhu,
  opakování podle váhy, historie překonaných rekordů, Graf progresu.
- **Detail tréninku**: PR štítky u sérií, superset, **Zopakovat** (`repeatSession()`
  — stejné cviky a supersety, dnešní datum, cíle z šablony nebo počet sérií)
  a **Nová šablona** (`openSaveTemplateModal()` → `templateFromSession()` — plán
  z odcvičeného: počet sérií a rozsah min–max opakování).
- **Gym mód** viz níž; po **Hotovo** se otevře další neodcvičený cvik (nejdřív za
  ním, pak od začátku) — o klepnutí méně u každého cviku.

### Zamčený timer (`Dock` v `ui.js`)

Pilulka nad plovoucí navigací, **viditelná na každé obrazovce**: běží-li pauza,
ukazuje odpočet s kroužkem, −30/+30 a zrušení; když pauza neběží a probíhá
trénink, ukazuje počet sérií (`workoutSetsLabel()`) a bílé tlačítko pro ruční
start pauzy. **Časovač celého tréninku není** — v1.26 na Martinovu žádost
odstraněn, nevracet.
Vedle názvu tréninku je čas začátku („· od 18:42"). Délka pauzy jde z plánu otevřeného cviku (`currentRestSeconds()` / `entryRest()`),
jinak z Nastavení. Po doběhnutí pauzy 5 s svítí volt „Pauza skončila". Zvuk na
konci pauzy byl ve v2.1 nabídnutý a Martin ho nechtěl. Klepnutí vrací na Trénink
(`dock-open`). Při otevřeném sheetu (`body.modal-open`) se přesune nahoru, aby ho
sheet nezakryl — proto má `.modal` max. výšku `100dvh − 76 px`. Stav se odvozuje
z `Rest` a `S.activeSession`; `render()` volá `Dock.sync()`.
`body.has-dock` přidá `--dock-h` do spodního odsazení stránky. Hlášky (toast) jsou
během tréninku **nahoře** pod top barem (v4.1) — dole by kryly steppery a Přidat sérii.
**Obrazovka nezhasne** během živého silového tréninku (`KeepAwake` — Screen Wake
Lock, synchronizuje ho `Dock.sync()`; ne v úpravě uloženého tréninku). Zámek drží
jen viditelná stránka, po návratu do appky se vyžádá znovu. Vypínač je v Nastavení
(`keepAwake`). `sync()` pouští jednu žádost naráz — `render()` ho volá často.

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
  přes 14 dní bíle tučně — `partLastTrained()`), Souhrn = série a objem za rozsah
  Týden / Měsíc / Vše / Vlastní (`SV.catRange`). Záměrně ne skládaný sloupec:
  sedm barev partií od sebe v jednom sloupci spolehlivě rozeznat nejde.
  Za sloupci je šedé **pásmo 10–20 sérií týdně** (`.cw-band`, měřítko aspoň do 22),
  Ø v pásmu je volt — běžné doporučení pro růst svalů, ne tvrdý cíl.
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

**Záloha a export** má i **CSV sérií** (`exp-csv`, `buildSetsCsv()`) — jedna série
na řádek (sloupec `zacatek` = čas začátku tréninku), středník a desetinná čárka (česká tabulka ho otevře rovnou do sloupců),
BOM kvůli diakritice.

**Cloud sync** je v Záloze a exportu (ne v Nastavení): URL se ukládá hned po
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
Knihovna cviků má totéž hledání v lepkavém panelu pod top barem (`.sticky-bar`,
sklo dostane až po přilepení — třída `.stuck` z `updateTopbar()`).

## Gym mód (aktivní trénink)

- Probíhající trénink nese název a průběh ve velkém titulku (hotové cviky / série,
  tenký volt pruh). Nad cviky counter partií (viz Pokrytí partií).
- Sbalené cviky jsou **řádky na pozadí** oddělené linkou (proužek partie, číslo /
  volt fajfka, souhrn sérií, „do selhání N×", úchyt); otevřený cvik je karta.
  V kartě: název, anglický název, pod nimi partie (tečka + šedý text) · pořadí
  (`.ex-meta`; do v4.1 štítek nad názvem), výměna a menu ⋯, **Technika** jako `<details>` (popis cviku), nápovědy jako řádky
  s ikonou — rekord (zlatě), minule, návrh progrese (volt), blízko rekordu (zlatě).
  Série: číslo, hodnota, PR štítek, mini check „do selhání", křížek. Steppery
  opakování a váhy, **poznámka k sérii** schovaná v `<details>` (rozbalí se sama,
  když opravovaná série poznámku má), Přidat sérii (volt) + Hotovo.
- **Plán cviku (v2.1)**: pod názvem řádek `.ex-plan` („3 × 8–12 · pauza 2:00 ·
  superset s dalším"), v hlavičce „1/3 série"; nezapsané série plánu jsou tlumené
  řádky `.set-row.ghost` s cílem a minulou hodnotou té série. Po splnění počtu
  sérií je volt **Hotovo** a „Série navíc" neutrální. Návrh progrese (double
  progression, `progressionSuggestion()`): minule všechny série na horní hranici
  rozsahu → předvyplní +2,5 kg a spodek rozsahu; u výdrže a bez rozsahu se nenavrhuje.
- **Supersety**: `entry.link` = jde se hned na další cvik bez pauzy; po sérii
  posledního cviku skupiny pauza (podle jeho plánu) a zpět na první. Sbalené řádky
  mají štítek „superset" a svislou linku v levém okraji (`.ss`, `.ss-prev/.ss-next`).
- **Menu cviku ⋯** (`openExerciseMenu()`, místo koše v hlavičce): superset
  s dalším, připnutá poznámka (`openPinModal()`, zobrazí se jako první nápověda,
  klepnutím se upraví), progres a rekordy, video na YouTube (`youtubeUrl()` —
  hledání podle anglického názvu + „technique"; odkaz je i v Technice a v Library),
  odebrat z tréninku (`withUndo`).
- **Druhy cviků**: výdrž = stepper „Výdrž · s" + **stopky** (`toggleStopwatch()`,
  `WV.sw`; druhé klepnutí zapíše sekundy do pole), vlastní váha = „Zátěž" (prázdná
  = 0). Zápis série čte pole podle druhu (`readSetInputs()`).
- **Kotouče** (v4.0): u cviků s osou nebo strojem na kotouče (`usesPlates()` —
  `PLATE_RE`/`NO_PLATE_RE` nad názvem, jednoručky a kladky ne) je u pole Váha
  odkaz Kotouče → sheet (`openPlatesModal()`): váha s ± (mění i pole v tréninku),
  nákres jedné strany osy a „Na každou stranu 20 + 1,25 kg", co složit nejde,
  neutrálně s ikonou ⚠. Kotouče kg 25…1,25 / lb 45…2,5, hladově. Osa 20/15/10/bez (lb 45/35/25)
  se pamatuje u cviku jen v zařízení (`Settings.plateBars`).
- **RIR** (v4.0, Nastavení → Zapisovat RIR, výchozí vypnuto): pod poli řada
  0 · 1 · 2 · 3 · 4+; volba se přepíná na místě (`w-rir`, bez překreslení —
  rozepsaná pole zůstanou) a čte ji `readSetInputs()`. Oprava série volbu načte.
- **Smazání série má undo** (`withUndo("Série smazána")`) a rekordy cviku se
  přepočtou (`refreshEntryRecords()`). Pozor: schovaný toast musí vrátit
  `pointer-events: none` — jinak neviditelné „Vrátit" blokuje tlačítka pod sebou.
- **Shrnutí po dokončení** (`openWorkoutSummary()`, místo samotného hodnocení):
  titulek „Hotovo · šablona" (v4.1), **nejlepší rekord jako hlavní blok** (pohár,
  hodnota zlatě velkým číslem; pořadí podle druhu `REC_ORDER`, pak e1RM), ostatní
  rekordy jako řádky stejně jako v Pokroku (druh šedě, hodnota zlatě; „a N dalších"
  až od dvou — jeden by zabral stejně místa jako jeho řádek), pak
  cviky · série · objem se změnou proti minulému tréninku **stejné šablony**,
  pokrytí partií, karta „Trénink se lišil od šablony" (přidané /
  vyřazené cviky, pořadí, supersety → `updateTemplateFromFinish()` z `WV.lastFinish`),
  u volného tréninku „Uložit jako šablonu" přímo v kartě, pak hodnocení 1–10
  a poznámka. **Délka tréninku záměrně ne** — časovač v appce není (v1.26).
- Pod cviky Přidat cvik, přepínač **Core ano/ne** (`coreCardHtml()`; se zapsanými
  sériemi core je zapnutý sám), Dokončit trénink (volt) a Zrušit (textově červeně,
  odsazené od Dokončit). Se zapsanými sériemi chce Zrušit **druhé klepnutí**
  (v4.1 — „Klepni znovu — zahodí N sérií", červeně podbarvené, po 4 s se vrátí)
  a pak nabídne Vrátit na 12 s, i po obnovení stránky. Bez sérií zruší hned.
- **Předvyplnění další série** (v4.1): váha jde podle dneška — když dnešní série
  šla o +5 kg nad minulou, další dostane minulou hodnotu *té* série + 5 kg (dřív
  minulou váhu, takže po těžší první sérii nabízela lehčí). Opakování z minula.
- Chybějící opakování / váha při zápisu = červený rámeček pole + `aria-invalid`
  (`flagField()`), zmizí psaním nebo po 4 s; hláška jde nahoru (viz Dock).
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
- **pole mají písmo aspoň 16 px** (od v4.0 `max(16px, …rem)`) — pod 16 px iOS
  při klepnutí do pole přiblíží stránku. Nezmenšovat.
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
Ve v2.1 (inspirace Hevy) nabídnuté a odmítnuté: **zahřívací série** a **zvuk
na konci pauzy** — nestavět bez výslovné žádosti.
**v3.1 (inspirace opengym) postavená a vrácená:** animované ukázky cviků (vlastní
SVG piktogramy), vedený režim „jeden cvik na obrazovku" a dotaz na váhu při
startu tréninku. Martinovi to nesedlo („clunky") — revert. Nestavět znovu bez
výslovné žádosti. (Cizí média stejně nejdou: opengym je AGPL, animace Gym visual
bez licence, fotky free-exercise-db nejasného původu.)
**Navržené ve v4.0, zatím nevybrané:** trénink přes celou obrazovku (bez
navigace a docku, zmenší se do lišty), tabulka sérií ve stylu Strong/Hevy
(předvyplněné řádky, ✓ = zapsáno + pauza), nativní SwiftUI appka (pauza na
zamčené obrazovce / Dynamic Island, vibrace, Apple Health, widget, Watch — za
cenu přepisu, Xcode a vývojářského účtu). Webová appka na iPhonu nevibruje
(`navigator.vibrate` Safari nemá), takže konec pauzy je jen vizuální.
**Z kritiky v4.1 zatím neudělané** (Martin je nevybral nebo patří jinam): tečka
stavu syncu bez popisku, dvě různá kódování v kalendářích (proužky vs tečky),
přeskupení cviků jen tažením (bez alternativy), víc způsobů zobrazení pokrytí
partií, „Nedávné" ve výběru cviku, zopakování série jedním klepnutím, výraznější
stav po konci pauzy, stupně rekordů (malý vs velký).
