/* ===== Obecné utility ===== */
"use strict";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

/* Datum jako 'YYYY-MM-DD' v lokálním čase */
function dateStr(d) {
  d = d || new Date();
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function todayStr() { return dateStr(new Date()); }

function parseDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return dateStr(d);
}

const CZ_MONTHS = ["leden","únor","březen","duben","květen","červen","červenec","srpen","září","říjen","listopad","prosinec"];
const CZ_DOW = ["Po","Út","St","Čt","Pá","So","Ne"];

function fmtDate(s) {
  const d = parseDate(s);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}

/* Pondělí aktuálního týdne pro dané datum */
function mondayOf(s) {
  const d = parseDate(s);
  const shift = (d.getDay() + 6) % 7; // Po=0 … Ne=6
  d.setDate(d.getDate() - shift);
  return dateStr(d);
}

function fmtNum(n, dec = 0) {
  if (n == null || isNaN(n)) return "–";
  return Number(n).toLocaleString("cs-CZ", { maximumFractionDigits: dec, minimumFractionDigits: 0 });
}

function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

function debounce(fn, ms) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

/* ===== Jednotky ===== */
const KG_PER_LB = 0.45359237;

function weightUnit() { return Settings.get().weightUnit || "kg"; }

/* kg (interní) -> zobrazovaná hodnota */
function kgOut(kg) {
  if (kg == null) return null;
  return weightUnit() === "lb" ? kg / KG_PER_LB : kg;
}
/* zadaná hodnota -> kg (interní) */
function kgIn(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return null;
  return weightUnit() === "lb" ? n * KG_PER_LB : n;
}
function fmtWeight(kg, withUnit = true) {
  const v = kgOut(kg);
  if (v == null) return "–";
  return fmtNum(v, 1) + (withUnit ? " " + weightUnit() : "");
}

/* Odhad 1RM (Epleyho vzorec) */
function est1RM(weightKg, reps) {
  if (!weightKg || !reps) return 0;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}
