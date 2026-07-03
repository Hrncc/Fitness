/* ===== UI komponenty: modal, toast, kalendář, progress bary, SVG grafy ===== */
"use strict";

/* ---- Toast ---- */
let _toastTimer;
function toast(msg, kind = "") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast show" + (kind ? " " + kind : "");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---- Modal (bottom sheet) ---- */
function openModal(html) {
  document.getElementById("modal").innerHTML = html;
  document.getElementById("modal").classList.add("open");
  document.getElementById("modalBackdrop").classList.add("open");
}
function closeModal() {
  document.getElementById("modal").classList.remove("open");
  document.getElementById("modalBackdrop").classList.remove("open");
}
function modalTitle(text) {
  return `<div class="modal-title"><span>${esc(text)}</span>
    <button class="iconbtn" data-act="modal-close">✕</button></div>`;
}

/* Jednoduché potvrzení */
function confirmModal(text, actName, dataAttrs = "", label = "Smazat") {
  openModal(`${modalTitle("Potvrzení")}
    <p style="margin:0 0 18px">${esc(text)}</p>
    <div class="row">
      <button class="btn ghost grow" data-act="modal-close">Zrušit</button>
      <button class="btn danger grow" data-act="${actName}" ${dataAttrs}>${esc(label)}</button>
    </div>`);
}

/* ---- Progress bar ---- */
function barHtml(value, target, color, mini = false) {
  const pct = target > 0 ? clamp(value / target * 100, 0, 100) : 0;
  const over = target > 0 && value > target * 1.05;
  return `<div class="bar${mini ? " mini" : ""}">
    <div style="width:${pct.toFixed(1)}%;background:var(--${over ? "red" : color})"></div>
  </div>`;
}

/* ---- Kalendář ----
   decorate(dateStr) → { cls: 'hit'|'miss'|'', mark: '✓'|'' } nebo null */
function calendarHtml(year, month, decorate, clickAct) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startShift = (first.getDay() + 6) % 7; // Po=0
  const today = todayStr();

  let cells = CZ_DOW.map(d => `<div class="cal-dow">${d}</div>`).join("");
  for (let i = 0; i < startShift; i++) cells += `<div class="cal-day empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = dateStr(new Date(year, month, d));
    const info = decorate(ds) || { cls: "", mark: "" };
    cells += `<div class="cal-day ${info.cls}${ds === today ? " today" : ""}"
      data-act="${clickAct}" data-date="${ds}">
      <span>${d}</span><span class="mark">${info.mark || ""}</span>
    </div>`;
  }
  return `
  <div class="cal-head">
    <button class="btn sm ghost" data-act="cal-nav" data-dir="-1">‹</button>
    <b>${CZ_MONTHS[month]} ${year}</b>
    <button class="btn sm ghost" data-act="cal-nav" data-dir="1">›</button>
  </div>
  <div class="cal-grid">${cells}</div>`;
}

/* ---- SVG grafy (bez knihoven) ---- */

/* Sloupcový graf: data = [{label, value}] */
function barChart(data, { color = "orange", height = 170, unit = "" } = {}) {
  if (!data.length || data.every(d => !d.value)) return `<div class="empty-note">Zatím žádná data</div>`;
  const W = 600, H = height, padB = 24, padT = 16;
  const max = Math.max(...data.map(d => d.value)) || 1;
  const bw = W / data.length;
  let bars = "", labels = "";
  data.forEach((d, i) => {
    const h = (d.value / max) * (H - padB - padT);
    const x = i * bw + bw * 0.18, y = H - padB - h;
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${Math.max(h, 2).toFixed(1)}" rx="4" fill="var(--${color})" opacity="0.9"/>`;
    if (d.value) bars += `<text x="${(i * bw + bw / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle" font-size="11" fill="var(--text2)">${fmtNum(d.value)}</text>`;
    labels += `<text x="${(i * bw + bw / 2).toFixed(1)}" y="${H - 7}" text-anchor="middle" font-size="11" fill="var(--text3)">${esc(d.label)}</text>`;
  });
  return `<div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${bars}${labels}</svg></div>`;
}

/* Spojnicový graf: series = [{date, value}], volitelná cílová linka */
function lineChart(series, { color = "cyan", height = 180, goal = null } = {}) {
  const pts = series.filter(p => p.value != null);
  if (pts.length < 2) return `<div class="empty-note">Potřebuji alespoň 2 záznamy pro graf</div>`;
  const W = 600, H = height, padL = 8, padR = 8, padT = 14, padB = 22;
  const vals = pts.map(p => p.value).concat(goal ? [goal] : []);
  const min = Math.min(...vals) * 0.92, max = Math.max(...vals) * 1.05 || 1;
  const x = i => padL + (i / (pts.length - 1)) * (W - padL - padR);
  const y = v => padT + (1 - (v - min) / (max - min || 1)) * (H - padT - padB);

  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  let extra = "";
  if (goal) {
    extra += `<line x1="${padL}" y1="${y(goal).toFixed(1)}" x2="${W - padR}" y2="${y(goal).toFixed(1)}"
      stroke="var(--green)" stroke-width="1.5" stroke-dasharray="6 5" opacity="0.7"/>
      <text x="${W - padR}" y="${(y(goal) - 5).toFixed(1)}" text-anchor="end" font-size="11" fill="var(--green)">cíl ${fmtNum(goal)}</text>`;
  }
  const dots = pts.map((p, i) =>
    `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="3.2" fill="var(--${color})"/>`).join("");
  const firstLbl = pts[0].date ? fmtDate(pts[0].date) : "";
  const lastLbl = pts[pts.length - 1].date ? fmtDate(pts[pts.length - 1].date) : "";
  return `<div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${extra}
    <path d="${path}" fill="none" stroke="var(--${color})" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    <text x="${padL}" y="${H - 6}" font-size="11" fill="var(--text3)">${firstLbl}</text>
    <text x="${W - padR}" y="${H - 6}" text-anchor="end" font-size="11" fill="var(--text3)">${lastLbl}</text>
  </svg></div>`;
}

/* ---- Zdrojový badge potraviny ---- */
function sourceBadge(source) {
  return {
    openfoodfacts: `<span class="badge cyan">OFF</span>`,
    usda: `<span class="badge green">USDA</span>`,
    custom: `<span class="badge purple">vlastní</span>`
  }[source] || "";
}

/* ---- Badge typu jídla ---- */
const MEAL_TYPES = [
  { id: "breakfast", name: "Snídaně" },
  { id: "lunch", name: "Oběd" },
  { id: "dinner", name: "Večeře" },
  { id: "snack", name: "Svačina" }
];
function mealName(id) {
  const m = MEAL_TYPES.find(m => m.id === id);
  return m ? m.name : "Nezařazeno";
}
