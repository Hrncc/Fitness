/**
 * Fitness Log — cloud sync backend (Google Apps Script)
 * =====================================================
 * Ukládá celý stav aplikace jako JSON do listu "DATA" aktivního Sheetu.
 * JSON se dělí na 45k znakové bloky do sloupce A (limit buňky je 50k znaků).
 *
 * Denní záloha: při prvním zápisu každého dne se aktuální obsah listu DATA
 * zkopíruje do listu SNAP_YYYY-MM-DD (drží se posledních 7 záloh). Kdyby se
 * data poškodila, stačí obsah snapshotu ručně zkopírovat zpět do DATA.
 *
 * Podrobný návod na nasazení je v souboru SETUP_SYNC.md v repozitáři appky.
 * Ve zkratce: Rozšíření → Apps Script → vložit tento kód → Nasadit →
 * Nové nasazení → Webová aplikace (Spustit jako: Já, Přístup: Kdokoli) →
 * zkopírovat URL /exec do appky (Nastavení → Apps Script Web App URL).
 *
 * Pozn.: URL nikomu nesdílej — kdo ji zná, může číst i zapisovat data.
 */

var SHEET_NAME = "DATA";
var CHUNK_SIZE = 45000;
var SNAPSHOT_KEEP = 7;

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
  snapshotIfNeeded_(sheet);
  var chunks = [];
  for (var i = 0; i < jsonString.length; i += CHUNK_SIZE) {
    chunks.push([jsonString.substring(i, i + CHUNK_SIZE)]);
  }
  sheet.clearContents();
  if (chunks.length) sheet.getRange(1, 1, chunks.length, 1).setValues(chunks);
  sheet.getRange(1, 2).setValue(new Date()); // čas posledního zápisu (info)
}

/** Denní záloha: první zápis dne zkopíruje stávající DATA do SNAP_<datum>. */
function snapshotIfNeeded_(dataSheet) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = Session.getScriptTimeZone() || "Europe/Prague";
  var name = "SNAP_" + Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
  if (ss.getSheetByName(name)) return; // dnešní záloha už existuje
  var last = dataSheet.getLastRow();
  if (last < 1) return; // není co zálohovat
  var snap = ss.insertSheet(name);
  dataSheet.getRange(1, 1, last, 1).copyTo(snap.getRange(1, 1));
  snap.hideSheet();
  // úklid: drž jen posledních SNAPSHOT_KEEP záloh
  var names = ss.getSheets()
    .map(function (s) { return s.getName(); })
    .filter(function (n) { return n.indexOf("SNAP_") === 0; })
    .sort();
  while (names.length > SNAPSHOT_KEEP) {
    ss.deleteSheet(ss.getSheetByName(names.shift()));
  }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ===== Apple Health (v5.0) =====
 * Zkratka na iPhonu posílá jednou denně POST s tělem
 *   { "kind": "health", "date": "2026-11-11", "rhr": 52, "hrv": 64, "sleep": 7.4,
 *     "steps": 8400, "kcal": 610, "weight": 78.2,
 *     "workouts": "Běh|2026-11-10T17:05|32|310|148\nSilový trénink|2026-11-11T18:40|62|420|121" }
 * Ukládá se do listu HEALTH: sloupec A klíč (d:<datum> / w:<id>), B JSON, C čas.
 * Čísla smí přijít i jako text s desetinnou čárkou. Stav appky (list DATA)
 * se tímhle nikdy nepřepíše. */
var HEALTH_SHEET = "HEALTH";
var HEALTH_KEEP = 400;

function healthSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(HEALTH_SHEET);
  if (!sheet) sheet = ss.insertSheet(HEALTH_SHEET);
  return sheet;
}
function num_(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  var s = String(v).replace(/\s/g, "");
  var hm = /^(\d+):(\d{1,2})$/.exec(s);
  if (hm) return Number(hm[1]) + Number(hm[2]) / 60;
  var n = parseFloat(s.replace(",", "."));
  return isFinite(n) ? n : null;
}
function readHealth_() {
  var sheet = healthSheet_();
  var last = sheet.getLastRow();
  var out = { days: {}, workouts: [] };
  if (last < 1) return out;
  var rows = sheet.getRange(1, 1, last, 2).getValues();
  for (var i = 0; i < rows.length; i++) {
    var key = String(rows[i][0] || "");
    var val;
    try { val = JSON.parse(rows[i][1]); } catch (e) { continue; }
    if (key.indexOf("d:") === 0) out.days[key.substring(2)] = val;
    else if (key.indexOf("w:") === 0) out.workouts.push(val);
  }
  return out;
}
function upsertHealth_(body) {
  var sheet = healthSheet_();
  var last = sheet.getLastRow();
  var keys = last ? sheet.getRange(1, 1, last, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  var now = new Date();
  var saved = 0;
  function put(key, obj) {
    var at = keys.indexOf(key);
    var row = at < 0 ? keys.push(key) : at + 1;
    sheet.getRange(row, 1, 1, 3).setValues([[key, JSON.stringify(obj), now]]);
    saved++;
  }
  var tz = Session.getScriptTimeZone() || "Europe/Prague";
  var date = /^\d{4}-\d{2}-\d{2}/.test(String(body.date || "")) ? String(body.date).substring(0, 10)
    : Utilities.formatDate(now, tz, "yyyy-MM-dd");
  var day = { at: now.getTime() };
  var fields = ["rhr", "hrv", "sleep", "steps", "kcal", "weight"];
  var any = false;
  for (var i = 0; i < fields.length; i++) {
    var n = num_(body[fields[i]]);
    if (n !== null && n >= 0) { day[fields[i]] = n; any = true; }
  }
  if (any) {
    // jeden den může přijít víckrát (ráno spánek, večer kroky) — pole se doplňují
    var old = {};
    var at0 = keys.indexOf("d:" + date);
    if (at0 >= 0) { try { old = JSON.parse(sheet.getRange(at0 + 1, 2).getValue()) || {}; } catch (e) { old = {}; } }
    for (var k in day) old[k] = day[k];
    put("d:" + date, old);
  }
  var ws = body.workouts;
  if (typeof ws === "string") {
    ws = ws.split(/\n+/).filter(function (l) { return l.replace(/\s/g, ""); }).map(function (l) {
      var p = l.split("|");
      return { type: p[0], start: p[1], min: p[2], kcal: p[3], hr: p[4] };
    });
  }
  if (ws && ws.length) {
    for (var j = 0; j < ws.length; j++) {
      var w = ws[j] || {};
      var start = String(w.start || w.date || "").replace(/^\s+|\s+$/g, "");
      if (!/^\d{4}-\d{2}-\d{2}/.test(start)) continue;
      var type = String(w.type || "Trénink").replace(/^\s+|\s+$/g, "").substring(0, 40) || "Trénink";
      var o = { id: start.substring(0, 16) + "|" + type, type: type, start: start.substring(0, 16) };
      var m = num_(w.min), kc = num_(w.kcal), hr = num_(w.hr);
      if (m) o.min = Math.round(m);
      if (kc) o.kcal = Math.round(kc);
      if (hr) o.hr = Math.round(hr);
      put("w:" + o.id, o);
    }
  }
  // úklid: jen posledních HEALTH_KEEP řádků
  var total = sheet.getLastRow();
  if (total > HEALTH_KEEP) sheet.deleteRows(1, total - HEALTH_KEEP);
  return saved;
}

/** Načtení: GET → { ok: true, state: {...} | null, health: { days, workouts } } */
function doGet() {
  try {
    var health = null;
    try { health = readHealth_(); } catch (ignored) {}
    return json_({ ok: true, state: readState_(), health: health });
  } catch (e) {
    return json_({ ok: false, error: String(e) });
  }
}

/** POST s JSON tělem: stav appky → list DATA, { kind: "health" } → list HEALTH */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    if (!e || !e.postData || !e.postData.contents) {
      return json_({ ok: false, error: "Prázdné tělo požadavku" });
    }
    var body = JSON.parse(e.postData.contents);
    if (body && body.kind === "health") {
      return json_({ ok: true, saved: upsertHealth_(body) });
    }
    // pojistka: do DATA smí jen skutečný stav appky — cokoli jiného (špatně
    // poskládaná Zkratka) by přepsalo všechna data
    if (!body || !(body.sessions instanceof Array) || !(body.exercises instanceof Array)) {
      return json_({ ok: false, error: "Tělo není stav appky ani data kind=health" });
    }
    writeState_(e.postData.contents);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}
