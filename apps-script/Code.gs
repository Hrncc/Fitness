/**
 * Fitness Log — cloud sync backend (Google Apps Script)
 * =====================================================
 * Ukládá celý stav aplikace jako JSON do listu "DATA" aktivního Sheetu.
 * JSON se dělí na 45k znakové bloky do sloupce A (limit buňky je 50k znaků).
 *
 * NASAZENÍ (jednorázově):
 * 1. Vytvoř nový Google Sheet (název libovolný).
 * 2. Rozšíření → Apps Script, smaž ukázkový kód a vlož obsah tohoto souboru.
 * 3. Ulož. Vpravo nahoře: Nasadit → Nové nasazení → typ „Webová aplikace".
 *    - Spustit jako: „Já"
 *    - Přístup má: „Kdokoli" (anonymně — URL funguje jako tajný klíč)
 * 4. Potvrď oprávnění a zkopíruj URL webové aplikace (končí na /exec).
 * 5. URL vlož v appce do Nastavení → Apps Script Web App URL.
 *
 * Pozn.: URL nikomu nesdílej — kdo ji zná, může číst i zapisovat data.
 */

var SHEET_NAME = "DATA";
var CHUNK_SIZE = 45000;

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  return sheet;
}

function readState_() {
  var sheet = getSheet_();
  var last = sheet.getLastRow();
  if (last < 1) return null;
  var values = sheet.getRange(1, 1, last, 1).getValues();
  var json = values.map(function (r) { return r[0]; }).join("");
  if (!json) return null;
  try { return JSON.parse(json); } catch (e) { return null; }
}

function writeState_(jsonString) {
  // validace, ať se do Sheetu nedostane nesmysl
  JSON.parse(jsonString);
  var sheet = getSheet_();
  var chunks = [];
  for (var i = 0; i < jsonString.length; i += CHUNK_SIZE) {
    chunks.push([jsonString.substring(i, i + CHUNK_SIZE)]);
  }
  sheet.clearContents();
  if (chunks.length) sheet.getRange(1, 1, chunks.length, 1).setValues(chunks);
  sheet.getRange(1, 2).setValue(new Date()); // čas posledního zápisu (info)
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Načtení stavu: GET → { ok: true, state: {...} | null } */
function doGet() {
  try {
    return json_({ ok: true, state: readState_() });
  } catch (e) {
    return json_({ ok: false, error: String(e) });
  }
}

/** Uložení stavu: POST s JSON tělem → { ok: true } */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    if (!e || !e.postData || !e.postData.contents) {
      return json_({ ok: false, error: "Prázdné tělo požadavku" });
    }
    writeState_(e.postData.contents);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}
