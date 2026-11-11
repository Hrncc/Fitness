# Apple Health a Apple Watch → Fitness Log

Fitness Log je webová appka. Na iPhonu se webová appka k Apple Health sama
nedostane — HealthKit Apple zpřístupňuje jen appkám z App Storu. Data z hodinek
proto jednou denně pošle **Zkratka** (appka Zkratky je v iPhonu od Applu).
Putují na stejnou adresu jako sync (tvůj Google Sheet, list `HEALTH`) a appka
si je vezme při dalším otevření.

**Co se přenáší:** klidový tep, variabilita tepu (HRV), spánek, kroky, aktivní
energie, váha a tréninky zapsané hodinkami (druh, začátek, délka, kalorie,
průměrný tep).
**Co touhle cestou nejde:** živý tep během tréninku a cokoli v reálném čase —
Zkratka posílá jen souhrny.

> Postup byl ověřený na serverové straně (simulací Apps Scriptu) a v appce,
> **Zkratka sama zatím nebyla vyzkoušená na skutečném telefonu.** Názvy akcí se
> mezi verzemi iOS mírně liší — kdyby některý krok neseděl, uprav ho podle toho,
> co Zkratky nabízejí; důležitý je jen tvar dat v kroku 3.

## 1. Nová verze skriptu v Google Sheetu

1. Otevři Sheet se syncem → **Rozšíření → Apps Script**.
2. Nahraď obsah `Code.gs` souborem `apps-script/Code.gs` z tohoto repa.
3. **Nasadit → Spravovat nasazení → tužka u stávajícího nasazení → Verze: Nová
   verze → Nasadit.** Ne „Nové nasazení" — změnila by se adresa.

Nový skript přidává list `HEALTH` a pojistku: do listu `DATA` (tréninky) pustí
jen skutečný stav appky, takže špatně poskládaná Zkratka data nepřepíše.

## 2. Adresa pro Zkratku

V appce **Profil → Apple Health a hodinky → Zkopírovat adresu pro Zkratku**.
Je to stejná adresa jako u syncu a funguje jako klíč — nikomu ji neposílej.

## 3. Zkratka

V appce Zkratky vytvoř novou zkratku a přidej akce:

| # | Akce | Nastavení |
|---|---|---|
| 1 | **Najít zdravotní vzorky** | Typ: Klidová tepová frekvence · Datum zahájení: dnes · Řadit: nejnovější · Limit 1 |
| 2 | **Najít zdravotní vzorky** | Typ: Variabilita tepové frekvence · dnes · nejnovější · Limit 1 |
| 3 | **Najít zdravotní vzorky** | Typ: Analýza spánku · za posledních 24 hodin · pak **Vypočítat statistiku: Součet** z Trvání (hodiny) |
| 4 | **Najít zdravotní vzorky** | Typ: Kroky · dnes · pak **Vypočítat statistiku: Součet** |
| 5 | **Najít zdravotní vzorky** | Typ: Aktivní energie · dnes · Součet |
| 6 | **Najít zdravotní vzorky** | Typ: Hmotnost · nejnovější · Limit 1 (nepovinné) |
| 7 | **Najít tréninky** | Datum zahájení: za posledních 7 dní |
| 8 | **Opakovat s každým** (tréninky) | Do proměnné *Řádky* přidej text: `Typ tréninku|Datum zahájení (formát yyyy-MM-dd'T'HH:mm)|Trvání v minutách|Aktivní energie|Průměrný tep` |
| 9 | **Kombinovat text** | *Řádky*, oddělovač: nový řádek |
| 10 | **Získat obsah URL** | URL: adresa z kroku 2 · Metoda: **POST** · Tělo požadavku: **JSON** s poli níž |

Pole JSON v kroku 10:

| Klíč | Hodnota |
|---|---|
| `kind` | text `health` (povinné — podle něj server pozná, že nejde o zálohu) |
| `date` | Aktuální datum ve formátu `yyyy-MM-dd` |
| `rhr` | výsledek akce 1 |
| `hrv` | výsledek akce 2 |
| `sleep` | výsledek akce 3 (hodiny; server vezme i minuty nebo tvar `7:24`) |
| `steps` | výsledek akce 4 |
| `kcal` | výsledek akce 5 |
| `weight` | výsledek akce 6 (kg) |
| `workouts` | text z akce 9 |

Čísla můžou přijít s desetinnou čárkou i jako text. Co chybí, prostě vynech —
každé pole je nepovinné a jeden den jde poslat víckrát (ráno spánek, večer kroky),
pole se doplní.

## 4. Automatizace

Zkratky → **Automatizace → Nová → Denní doba** (třeba 7:30, denně) → Spustit
zkratku → vypni „Zeptat se před spuštěním". Při prvním běhu iPhone požádá
o přístup ke Zdraví.

## 5. V appce

Po dalším otevření (nebo **Profil → Apple Health → Načíst teď**) uvidíš:

- na **Přehledu** kartu připravenosti (HRV a klidový tep proti tvému 14dennímu
  průměru, spánek) a tréninky z hodinek,
- ve stránce **Apple Health** tabulku posledních dní,
- váha ze Zdraví doplní dny, kdy v appce žádná není (ruční zápis nepřepíše),
- **Trenér** i Report pro Clauda mají data z hodinek k dispozici.

## Bez syncu

Zkratka může JSON místo odeslání zkopírovat do schránky; v appce ho vložíš ve
stránce Apple Health → Ručně.
