// i18n.js
// Tiny runtime for UI strings. UI language ONLY — it does not change the language
// of the filed RTI body (that defaults to English; Hindi also accepted).
//
// Fallback chain: requested lang → English → the raw key (never blank).
// Persistence is the caller's job (app.js reads/writes storage LOCAL_KEYS.LANG and
// calls setLang); this module keeps the current code in memory + notifies subs.
//
// TRANSLATION POLICY (decision #2): en.js is the complete reference. hi/bn/te/mr/
// ta are filled by HUMAN translators — never machine-translated. Until filled they
// are empty objects and every key falls back to English. Dropping in a translation
// is pure data: no code change.

import en from "./strings/en.js";
import hi from "./strings/hi.js";
import bn from "./strings/bn.js";
import te from "./strings/te.js";
import mr from "./strings/mr.js";
import ta from "./strings/ta.js";

const TABLES = { en, hi, bn, te, mr, ta };

export const LANGS = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "bn", label: "বাংলা" },
  { code: "te", label: "తెలుగు" },
  { code: "mr", label: "मराठी" },
  { code: "ta", label: "தமிழ்" }
];

let current = "en";
const subs = [];

export function getLang() {
  return current;
}

export function setLang(code) {
  current = TABLES[code] ? code : "en";
  for (const fn of subs) {
    try { fn(current); } catch (_e) { /* a subscriber error must not break others */ }
  }
  return current;
}

export function onLangChange(fn) {
  if (typeof fn === "function") subs.push(fn);
}

// t(key, vars?) → localized string with {var} interpolation and English fallback.
export function t(key, vars) {
  const s = (TABLES[current] && TABLES[current][key]) ?? (TABLES.en && TABLES.en[key]) ?? key;
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

// Which languages have at least a partial table beyond English (for a future
// "translation coverage" indicator). Not used in Stage 1.
export function coverage() {
  const out = {};
  for (const code of Object.keys(TABLES)) {
    out[code] = code === "en" ? 1 : Object.keys(TABLES[code] || {}).length / Object.keys(TABLES.en).length;
  }
  return out;
}
