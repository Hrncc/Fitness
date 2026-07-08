# Zprovoznění cloud syncu (Google Sheets)

Appka umí automaticky zálohovat a synchronizovat data mezi zařízeními přes tvůj vlastní Google Sheet. Nepotřebuješ žádný server ani platit — jen Google účet. Nastavení zabere ~5 minut a dělá se jednou.

## Jak to funguje

- Data appky (tréninky, jídla, váha, recepty…) se ukládají jako JSON do listu `DATA` v tvém Sheetu.
- V Sheetu běží malý skript (Google Apps Script) nasazený jako „webová aplikace" — appka na jeho URL posílá a čte data obyčejným požadavkem, bez přihlašování.
- Změny ze dvou zařízení se **slévají** (nová jídla z mobilu + trénink z počítače se neztratí), smazané záznamy se nevrací.
- Skript navíc při prvním zápisu každého dne uloží **denní zálohu** (skryté listy `SNAP_…`, drží se posledních 7 dní).

## Krok za krokem

### 1. Vytvoř Google Sheet

1. Jdi na <https://sheets.new> (přihlášený svým Google účtem).
2. Pojmenuj ho třeba **Fitness Log Sync**. Nic dalšího v něm nevyplňuj.

### 2. Vlož skript

1. V Sheetu otevři menu **Rozšíření → Apps Script** (Extensions → Apps Script).
2. Otevře se editor s ukázkovým souborem `Kód.gs` — **smaž celý jeho obsah**.
3. Vlož místo něj celý obsah souboru [`apps-script/Code.gs`](apps-script/Code.gs) z tohoto repozitáře.
4. Ulož (ikona diskety nebo Ctrl/Cmd+S).

### 3. Nasaď jako webovou aplikaci

1. Vpravo nahoře klikni **Nasadit → Nové nasazení** (Deploy → New deployment).
2. Klikni na ozubené kolečko vedle „Vyberte typ" a zvol **Webová aplikace** (Web app).
3. Nastav:
   - **Spustit jako** (Execute as): **Já** (Me)
   - **Kdo má přístup** (Who has access): **Kdokoli** (Anyone)
4. Klikni **Nasadit**.

> **Proč „Kdokoli"?** Appka se neumí přihlásit Googlu — URL nasazení funguje jako tajný klíč. Kdo URL nezná, data nenajde; proto ji nikam nedávej a nesdílej (a nedávej ji do veřejného repozitáře).

### 4. Povol oprávnění

1. Google se zeptá na autorizaci — klikni **Povolit přístup** (Authorize access) a vyber svůj účet.
2. Objeví se varování **„Google tuto aplikaci neověřil"** — to je v pořádku, je to tvůj vlastní skript. Klikni **Rozšířené** (Advanced) → **Přejít na … (nezabezpečené)** (Go to … (unsafe)) → **Povolit** (Allow).

### 5. Zkopíruj URL do appky

1. Po nasazení se zobrazí **URL webové aplikace** — končí na `/exec`. Zkopíruj ji.
2. V appce otevři **☰ menu → Nastavení → Apps Script Web App URL**, URL vlož a klikni **Uložit nastavení**.
3. Klikni **↑ Uložit do cloudu**. Tečka v horní liště zezelená a v Sheetu se v listu `DATA` objeví data.

Na druhém zařízení pak stačí otevřít appku, vložit **stejnou URL** do Nastavení a kliknout **↓ Načíst z cloudu**.

## Aktualizace skriptu (když se změní Code.gs)

1. Rozšíření → Apps Script → nahraď obsah novou verzí → ulož.
2. **Nasadit → Spravovat nasazení** (Manage deployments) → tužka ✎ → **Verze: Nová verze** → **Nasadit**.

> Důležité: uprav **stávající** nasazení (URL zůstane stejná). Kdybys vytvořil „Nové nasazení", dostaneš novou URL a musel bys ji měnit v appce.

## Obnova ze zálohy

Kdyby se data pokazila (např. omylem smazaná a nevrácená):

1. V Sheetu zobraz skryté listy: pravé tlačítko na záložky listů dole → **Zobrazit** → vyber `SNAP_<datum>`.
2. Zkopíruj celý sloupec A ze snapshotu do listu `DATA` (nejdřív v `DATA` smaž obsah).
3. V appce: Nastavení → **↓ Načíst z cloudu**.

## Řešení potíží

| Příznak | Příčina a řešení |
|---|---|
| Tečka svítí červeně, v Nastavení „chyba" | Zkontroluj, že URL končí na `/exec` a nasazení má přístup **Kdokoli**. Zkus URL otevřít v prohlížeči — měl by se zobrazit JSON `{"ok":true,…}`. |
| V prohlížeči URL vrací „Stránka nenalezena" | Nasazení bylo smazané nebo je URL z „testovacího nasazení" (`/dev`). Vytvoř nové nasazení a novou URL vlož do appky. |
| Po úpravě skriptu se nic nezměnilo | Zapomněl jsi nasadit novou **verzi** (viz Aktualizace skriptu). |
| Tečka žlutě bliká dlouho | Sheet je pomalejší (~1–3 s na zápis je normální). Zápisy se slučují — appka posílá stav nejdřív 1,8 s po poslední změně. |
| Data z druhého zařízení nevidím | Na druhém zařízení dej Nastavení → ↓ Načíst z cloudu (při startu appky se to děje automaticky). |

## Bezpečnostní poznámky

- **URL = klíč.** Ukládá se jen v prohlížeči tvého zařízení a posílá jen na `script.google.com`. Nikomu ji neposílej.
- Data leží v tvém vlastním Google Sheetu pod tvým účtem — nikdo jiný k nim nemá přístup.
- Kdyby URL unikla: Nasadit → Spravovat nasazení → **Archivovat** staré nasazení a vytvoř nové (nová URL).
