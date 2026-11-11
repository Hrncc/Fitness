# Fitness Log — PWA

Osobní deník silových a kardio tréninků a stravy (kalorie + makra). Jeden uživatel, bez registrace, bez vlastního backendu. Tmavý i světlý režim podle systému, mobile-first, funguje offline.

## Spuštění

PWA potřebuje HTTP server (service worker nefunguje z `file://`). Lokálně:

```bash
cd Fitness_app
python3 -m http.server 8080
# → http://localhost:8080
```

Pro použití na mobilu nasaď obsah složky na libovolný statický hosting s HTTPS (GitHub Pages, Netlify, Cloudflare Pages…), otevři v prohlížeči a přidej na plochu („Přidat na plochu" / „Add to Home Screen").

## Struktura

```
index.html            shell aplikace
manifest.json, sw.js  PWA (instalace, offline cache)
css/styles.css        design systém (dark mode, barevná paleta)
js/util.js            pomocné funkce, jednotky, e1RM
js/data.js            datový model, localStorage, PR logika
js/sync.js            cloud sync (Google Apps Script)
js/foodapi.js         Open Food Facts + USDA FoodData Central
js/ui.js              komponenty (modal, toast, kalendář, SVG grafy)
js/engine.js          adaptivní plán (cíle sérií, návrhy úprav)
js/anim.js            animace cviků (vlastní kreslená figurka)
js/health.js          Apple Health (data ze Zkratky)
js/view-*.js          obrazovky (Přehled, Trénink, živý trénink, Trenér, Pokrok, Jídlo, Profil)
js/app.js             router, akce, inicializace
apps-script/Code.gs   backend pro cloud sync (vkládá se do Google Sheets)
icons/                ikony PWA
```

## Co umí (v5.0)

- **Trénink jako tabulka sérií** (minule · kg · opakování · ✓) přes celou
  obrazovku, zahřívací série, supersety, pauza, kotouče, RIR.
- **Plán se přizpůsobuje výsledkům** — váhy a opakování na příště počítá appka
  z minulého tréninku a vždy řekne proč; úpravy plánu navrhuje k potvrzení.
- **Animace u každého cviku** — vlastní kreslená figurka, nic se nestahuje.
- **Apple Health / Apple Watch** přes Zkratku na iPhonu — viz `SETUP_HEALTH.md`.
- **Trenér** — Claude přímo v appce na tvém API klíči; vidí tréninky, plán
  a data z hodinek, navrhuje změny, které potvrzuješ.
- Strava, váha, check-in s fotkami, rekordy, statistiky, export.

## Cloud sync (Google Sheets)

Podrobný návod krok za krokem: **[SETUP_SYNC.md](SETUP_SYNC.md)**. Ve zkratce:

1. Vytvoř nový Google Sheet.
2. **Rozšíření → Apps Script**, vlož obsah `apps-script/Code.gs`, ulož.
3. **Nasadit → Nové nasazení → Webová aplikace**: Spustit jako **Já**, přístup **Kdokoli**.
4. Zkopíruj URL webové aplikace (`…/exec`) a vlož ji v appce do **Více → Záloha a export → Cloud sync**.

Data se ukládají při každé změně a načítají při startu. Změny z více zařízení se **slévají podle záznamů** (nic se nepřepíše), smazané položky hlídají tombstony. Skript navíc drží **denní zálohy** za posledních 7 dní (skryté listy `SNAP_…`). Indikátor stavu je tečka v horní liště: volt = ok, šedá blikající = probíhá, červená = offline/chyba.

> ⚠️ Exec URL funguje jako přístupový klíč — ukládá se jen lokálně v zařízení, nikam ji nesdílej a nedávej do veřejného repozitáře.

## Databáze potravin

- **Open Food Facts** — balené/značkové produkty, bez klíče.
- **USDA FoodData Central** — základní potraviny. Bez klíče se používá `DEMO_KEY` (30 dotazů/hod). Vlastní klíč zdarma na <https://fdc.nal.usda.gov/api-key-signup.html> → vlož v appce do Nastavení.
- **Foto etikety (Claude)** — vyfoť nutriční tabulku a Claude z ní přečte hodnoty na 100 g; ty je zkontroluješ, zadáš snědené gramy a appka makra přepočítá. Vyžaduje Claude API klíč z <https://console.anthropic.com> (Nastavení → Claude API klíč; ukládá se jen lokálně). Jeden sken stojí zlomek centu (model Haiku).
- Ruční zápis jako fallback (Jídlo → Přidat jídlo → Ručně).

## Zálohy

Více → **Záloha a export**: JSON (kompletní data, lze importovat zpět) + Markdown souhrn, včetně systémového sdílení.
