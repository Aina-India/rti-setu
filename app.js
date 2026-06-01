// app.js — RTI Setu v2 full-tab web app controller (ES module).
// Mode-driven, category-led wizard. Fully offline. The API key / AI modes (3 & 4)
// arrive in Stage 2; Stage 1 ships templates + self-write, both free and offline.

import { TEMPLATE_PACKS } from "./lib/templates-index.js";
import {
  listTemplates, getTemplate, categoriesOf, blankSequence, isBlankAnswered,
  resolveAuthority, renderBody, renderAsks, templateTitle, templateDescription, synthesizeIssue
} from "./lib/template-engine.js";
import { validateDetails } from "./lib/validators.js";
import { t, setLang as i18nSetLang, getLang as i18nGetLang, onLangChange, LANGS } from "./lib/i18n.js";
import {
  getDetails, saveDetails, getDraft, saveDraft, clearDraft,
  getLocal, setLocal, LOCAL_KEYS, getLang as getStoredLang, setLang as setStoredLang,
  writeFillPayload
} from "./lib/storage.js";
import { emptyProgress, buildSummary, addAwaitingRti, confirmReference, levelForXp } from "./lib/xp-engine.js";
import { inferTrack, detectStateHints, TRACKS } from "./lib/ministry-map.js";
import { checkValidity } from "./lib/validity.js";
import { DYK_CARDS, selectCard } from "./lib/dyk-cards.js";

const browserApi = (typeof browser !== "undefined") ? browser : chrome;
const $ = (id) => document.getElementById(id);
const PORTAL_URL = "https://rtionline.gov.in/request/request.php";

// ── tiny DOM helper ────────────────────────────────────────────────────────
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    // NOTE: no `html`/innerHTML branch — by design. ALL dynamic content (template
    // text, RTI body, ministry names, user input) goes in via `text` (textContent)
    // or as DOM-node children, so untrusted strings can never be parsed as markup.
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return el;
}

// ── app state ────────────────────────────────────────────────────────────────
const ui = {
  screen: "category",
  mode: "template",            // "template" | "selfwrite"
  lang: "en",
  category: null,
  template: null,
  answers: {},
  blankIdx: 0,
  authority: null,
  authorityMode: "constant",   // "constant" | "derived" | "autocomplete"
  rtiText: "",
  bpl: "no",
  verified: false,
  draftId: null,
  restored: false,
  ref: ""
};

let progress = emptyProgress();
let details = { name: "", address: "", email: "", mobile: "" };
let ministries = [];
let speaking = false;
let lastReward = null; // { gained, newBadges, rti } — drives the postgame ceremony

// Preset RTI topics for the SVG typing carousel (top bar + opening ceremony).
const TOPICS = [
  "Environmental clearance violations",
  "EIA documents · Vizag data centre",
  "PSU bank NPA write-off records",
  "NEET paper leak investigation",
  "Municipal budget · ward expenditure",
  "Forest clearance · Aravalli diversion",
  "Electoral bond recipient disclosures",
  "Police FIR registration refusals",
  "RTI on RTIs · CIC pendency data",
  "School mid-day meal fund use",
  "Section 69A account block orders",
  "Groundwater extraction approvals"
];
const REDUCED_MOTION = (typeof matchMedia === "function") && matchMedia("(prefers-reduced-motion: reduce)").matches;

// ── boot ──────────────────────────────────────────────────────────────────────
(async function init() {
  progress = (await getLocal(LOCAL_KEYS.PROGRESS)) || emptyProgress();
  details = await getDetails();
  ministries = await loadMinistries();

  const stored = await getStoredLang();
  i18nSetLang(stored || "en");
  ui.lang = i18nGetLang();
  onLangChange(() => { ui.lang = i18nGetLang(); applyStaticText(); render(); });

  wireTopbar();
  applyStaticText();
  const mark = $("tbMark"); if (mark && !mark.firstChild) mark.appendChild(buildChakra(44, false)); // the rotating wheel (SVG, not a glyph)
  runCeremony();          // plays on every page load (reduced-motion → instant)
  startTopbarCarousel();  // persistent SVG typing carousel in the header

  const draft = await getDraft();
  if (draft && draft.rtiText) {
    hydrateFromDraft(draft);
    ui.restored = true;
    go("editor");
  } else {
    // Stage 1 is English-only, so we skip the language-choice screen entirely and
    // land straight on the category picker. (The language screen returns in Stage 3.)
    go("category");
  }
})();

async function loadMinistries() {
  try {
    const res = await fetch(browserApi.runtime.getURL("lib/ministries.json"));
    const data = await res.json();
    return Array.isArray(data.ministries) ? data.ministries : [];
  } catch (_e) {
    return []; // hint only; content.js live reconciliation is the real safety net
  }
}

// ── Dharmachakra (the custom rotating wheel — a non-negotiable element) ───────
const SVG_NS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  return el;
}

// Ashoka chakra modelled on the v4 mockup wheel: 24 spokes (12 full-diameter
// lines, tiered for depth), an inner rim, a solid hub, and 8 rim studs.
// Geometry is scaled from the v4 64-unit design. If animate, it draws on.
function buildChakra(size, animate) {
  const c = size / 2;
  const k = size / 64;                       // scale from v4's 64-unit design
  const Ro = 30 * k, Ri = 22 * k, hubR = 5 * k, coreR = 3 * k;
  const svg = svgEl("svg", { width: size, height: size, viewBox: `0 0 ${size} ${size}`, fill: "none", role: "img", "aria-label": "Dharmachakra" });

  const spokes = [], dots = [];
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI;          // full-diameter line → 2 spokes
    const dx = Math.cos(ang) * Ro, dy = Math.sin(ang) * Ro;
    const main = i % 3 === 0;                 // the 4 cardinal/diagonal lines are bold
    const ln = svgEl("line", {
      x1: (c - dx).toFixed(2), y1: (c - dy).toFixed(2), x2: (c + dx).toFixed(2), y2: (c + dy).toFixed(2),
      stroke: "#e8650a", "stroke-width": ((main ? 1.2 : 0.5) * k).toFixed(2),
      "stroke-opacity": main ? 1 : (i % 2 ? 0.28 : 0.5)
    });
    if (animate) { const L = (2 * Ro).toFixed(1); ln.setAttribute("stroke-dasharray", L); ln.setAttribute("stroke-dashoffset", L); }
    svg.appendChild(ln); spokes.push(ln);
  }

  const inner = svgEl("circle", { cx: c, cy: c, r: Ri.toFixed(2), stroke: "#e8650a", "stroke-width": (0.8 * k).toFixed(2), "stroke-opacity": 0.5, fill: "none" });
  const rim = svgEl("circle", { cx: c, cy: c, r: Ro.toFixed(2), stroke: "#e8650a", "stroke-width": (1.5 * k).toFixed(2), fill: "none" });
  const hub = svgEl("circle", { cx: c, cy: c, r: hubR.toFixed(2), fill: "#e8650a" });
  const core = svgEl("circle", { cx: c, cy: c, r: coreR.toFixed(2), fill: "#080f1a" });
  if (animate) {
    for (const ci of [inner, rim]) { const L = (2 * Math.PI * Number(ci.getAttribute("r"))).toFixed(1); ci.setAttribute("stroke-dasharray", L); ci.setAttribute("stroke-dashoffset", L); }
    hub.setAttribute("opacity", "0"); core.setAttribute("opacity", "0");
  }
  svg.append(inner, rim);

  for (let i = 0; i < 12; i += 3) {            // 8 rim studs on the 4 main spokes
    const ang = (i / 12) * Math.PI, dx = Math.cos(ang) * Ro, dy = Math.sin(ang) * Ro, card = i % 6 === 0;
    for (const s of [1, -1]) {
      const d = svgEl("circle", { cx: (c + dx * s).toFixed(2), cy: (c + dy * s).toFixed(2), r: ((card ? 2 : 1.5) * k).toFixed(2), fill: "#e8650a", "fill-opacity": card ? 1 : 0.7 });
      if (animate) d.setAttribute("opacity", "0");
      svg.appendChild(d); dots.push(d);
    }
  }
  svg.append(hub, core);

  if (animate && !REDUCED_MOTION) {
    spokes.forEach((spk, i) => {
      const main = i % 3 === 0;
      setTimeout(() => { spk.style.transition = `stroke-dashoffset ${main ? 240 : 160}ms cubic-bezier(.4,0,.2,1)`; spk.style.strokeDashoffset = "0"; }, main ? i * 40 : 500 + i * 30);
    });
    setTimeout(() => { for (const ci of [inner, rim]) { ci.style.transition = "stroke-dashoffset 600ms ease"; ci.style.strokeDashoffset = "0"; } }, 1150);
    setTimeout(() => { dots.forEach((d) => { d.style.transition = "opacity .25s ease"; d.style.opacity = "1"; }); }, 1450);
    setTimeout(() => { hub.style.transition = "opacity .3s ease"; core.style.transition = "opacity .3s ease"; hub.style.opacity = "1"; core.style.opacity = "1"; }, 1550);
  }
  return svg;
}

// ── opening ceremony (overlay; every page load) ──────────────────────────────
function runCeremony() {
  const host = $("ceremony");
  if (!host) return;
  host.hidden = false;
  const wheel = h("div", { class: "cer-wheel" });
  const brand = h("div", { class: "cer-brand" },
    h("div", { class: "cer-name", text: t("brand.name") }),
    h("div", { class: "cer-tag", text: t("brand.tagline") })
  );
  const typer = h("span", { class: "cer-typer", id: "cerTyper" });
  const bar = h("div", { class: "cer-typing" }, typer, h("span", { class: "tb-cursor" }));
  host.replaceChildren(wheel, brand, bar);
  wheel.appendChild(buildChakra(96, true));

  const done = () => { host.classList.add("cer-out"); setTimeout(() => { host.hidden = true; host.replaceChildren(); }, 500); };
  if (REDUCED_MOTION) { typer.textContent = TOPICS[0]; setTimeout(done, 700); return; }
  typeInto(typer, { once: true });
  setTimeout(done, 3200);
}

// ── SVG typing carousel (persistent in the top bar) ───────────────────────────
function startTopbarCarousel() {
  const el = $("tbTyper");
  if (el) typeInto(el, {});
}

// Type the TOPICS list into `el`. Loops unless once. Stops if el detaches.
function typeInto(el, { once } = {}) {
  if (REDUCED_MOTION) { el.textContent = TOPICS[0]; return; }
  let ti = 0, ci = 0, typing = true, wait = 0;
  function tick() {
    if (!el.isConnected) return; // element re-rendered away → stop the loop
    const word = TOPICS[ti];
    if (typing) {
      ci++; el.textContent = word.slice(0, ci);
      if (ci >= word.length) { typing = false; wait = 0; }
      setTimeout(tick, 55 + Math.random() * 35);
    } else {
      wait++;
      if (wait < 30) { setTimeout(tick, 60); return; }
      ci--; el.textContent = word.slice(0, ci);
      if (ci <= 0) {
        if (once && ti >= TOPICS.length - 1) return;
        typing = true; ti = (ti + 1) % TOPICS.length;
      }
      setTimeout(tick, 26);
    }
  }
  tick();
}

function hydrateFromDraft(d) {
  ui.mode = d.mode || "template";
  ui.template = d.templateId ? getTemplate(TEMPLATE_PACKS, d.templateId) : null;
  ui.answers = d.answers || {};
  ui.authority = d.authority || null;
  ui.authorityMode = d.authority ? "constant" : "autocomplete";
  ui.rtiText = d.rtiText || "";
  ui.bpl = d.bpl || "no";
  ui.verified = !!d.verified;
  ui.draftId = d.draftId || null;
  ui.category = ui.template ? ui.template.category : null;
}

// ── static (non-screen) text ────────────────────────────────────────────────
function applyStaticText() {
  if (document.body) document.body.dataset.lang = ui.lang; // drives per-script font stack (Stage 3)
  $("brandName").textContent = t("brand.name");
  { const tag = $("brandTagline"); if (tag) tag.textContent = t("brand.tagline"); }
  $("navHistoryBtn").textContent = t("nav.history");
  $("navNewBtn").textContent = t("nav.newRti");
  $("footActLabel").textContent = t("foot.act");
  const cur = LANGS.find((l) => l.code === ui.lang);
  $("langBtnLabel").textContent = cur ? cur.label : "English";
  renderGamebar();
}

// ── top bar ──────────────────────────────────────────────────────────────────
function wireTopbar() {
  $("navHistoryBtn").addEventListener("click", () => go("history"));
  $("navNewBtn").addEventListener("click", startNew);

  const btn = $("langBtn");
  const menu = $("langMenu");
  btn.addEventListener("click", () => {
    const open = !menu.hidden;
    if (open) { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); return; }
    // Stage 1: English-only. Other languages are shown (so the ambition is visible)
    // but disabled until their human-translated string tables land in Stage 3 — we
    // never present a half-translated screen.
    menu.replaceChildren(...LANGS.map((l) => {
      const enabled = l.code === "en";
      return h("li", {
        role: "option",
        tabindex: enabled ? "0" : "-1",
        class: enabled ? "" : "disabled",
        "aria-selected": String(l.code === ui.lang),
        "aria-disabled": String(!enabled),
        onclick: enabled ? () => chooseLang(l.code) : null,
        onkeydown: enabled ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); chooseLang(l.code); } } : null
      }, enabled ? l.label : `${l.label} · ${t("lang.soon")}`);
    }));
    menu.hidden = false;
    btn.setAttribute("aria-expanded", "true");
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".lang-picker")) { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); }
  });
}

async function chooseLang(code) {
  await setStoredLang(code);
  i18nSetLang(code); // triggers onLangChange → re-render
  $("langMenu").hidden = true;
  $("langBtn").setAttribute("aria-expanded", "false");
}

function startNew() {
  Object.assign(ui, {
    mode: "template", category: null, template: null, answers: {}, blankIdx: 0,
    authority: null, authorityMode: "constant", rtiText: "", bpl: "no",
    verified: false, draftId: null, restored: false, ref: ""
  });
  go("category");
}

// ── gamebar ─────────────────────────────────────────────────────────────────
function renderGamebar() {
  const sum = buildSummary(progress);
  const top = sum.tracks[0];
  $("gbXpLabel").textContent = t("game.civicXp");
  $("gbLevelLabel").textContent = `Lv ${sum.level.level} · ${sum.level.name}`;
  requestAnimationFrame(() => { $("gbXpFill").style.width = Math.round(sum.level.progress * 100) + "%"; });
  $("gbStreak").textContent = sum.streak;
  $("gbStreakLbl").textContent = t("game.dayStreak");
  const badge = $("gbBadge");
  if (top && top.latestBadge) {
    $("gbBadgeName").textContent = top.latestBadge.name;
    $("gbBadgeSub").textContent = `${top.count} ${top.name}`;
    badge.classList.remove("locked");
  } else {
    // a SEALED honour, not a broken label — intentional mystery tile (glowing)
    $("gbBadgeName").textContent = "???";
    $("gbBadgeSub").textContent = t("game.sealedSub");
    badge.classList.add("locked");
  }
}

// ── router ───────────────────────────────────────────────────────────────────
function go(screen) { ui.screen = screen; render(); }

function render() {
  const host = $("screen");
  let node;
  switch (ui.screen) {
    case "language": node = buildLanguage(); break;
    case "category": node = buildCategory(); break;
    case "pick": node = buildPick(); break;
    case "blanks": node = buildBlanks(); break;
    case "editor": node = buildEditor(); break;
    case "verify": node = buildVerify(); break;
    case "details": node = buildDetails(); break;
    case "ready": node = buildReady(); break;
    case "filing": node = buildFiling(); break;
    case "postgame": node = buildPostgame(); break;
    case "history": node = buildHistory(); break;
    default: node = buildCategory();
  }
  host.replaceChildren(node);
  host.scrollIntoView({ block: "start" });
  renderGamebar();
  renderRail();
}

// ── progress rail (Choose → Write → Check → File) ────────────────────────────
const RAIL = [
  { key: "choose", screens: ["category", "pick"] },
  { key: "write", screens: ["blanks", "editor"] },
  { key: "check", screens: ["verify"] },
  { key: "file", screens: ["details", "ready", "filing", "postgame"] }
];
function renderRail() {
  const rail = $("stepsRail");
  if (!rail) return;
  const idx = RAIL.findIndex((s) => s.screens.includes(ui.screen));
  if (idx < 0) { rail.hidden = true; rail.replaceChildren(); return; } // history/language: no rail
  rail.hidden = false;
  const parts = [];
  RAIL.forEach((s, i) => {
    const state = i < idx ? "done" : i === idx ? "live" : "idle";
    parts.push(h("div", { class: "su" },
      h("span", { class: `sp ${state}`, text: state === "done" ? "✓" : String(i + 1) }),
      h("span", { class: `sl ${state}`, text: t("rail." + s.key) })
    ));
    if (i < RAIL.length - 1) parts.push(h("span", { class: "sdash" }));
  });
  rail.replaceChildren(...parts);
}

// ── screen: language ──────────────────────────────────────────────────────────
function buildLanguage() {
  return h("div", {},
    h("h1", { class: "scr-head", text: t("lang.heading") }),
    h("p", { class: "scr-sub", text: t("lang.sub") }),
    h("div", { class: "tiles" }, LANGS.map((l) =>
      h("button", {
        class: "tile", type: "button",
        onclick: async () => { await chooseLang(l.code); go("category"); }
      },
        h("span", { class: "tile-title", text: l.label })
      )
    ))
  );
}

// ── screen: category (category-led, NOT a mode gate) ─────────────────────────
function buildCategory() {
  const cats = categoriesOf(TEMPLATE_PACKS);
  const catMeta = { education: { ico: "🎓", key: "cat.education" } };
  return h("div", {},
    h("span", { class: "free-pill", text: t("landing.free") }),
    h("h1", { class: "scr-head", text: t("landing.heading") }),
    h("p", { class: "scr-sub", text: t("landing.sub") }),
    h("div", { class: "tiles" }, cats.map((c) => {
      const m = catMeta[c] || { ico: "📄", key: null };
      return h("button", { class: "tile", type: "button", onclick: () => pickCategory(c) },
        h("span", { class: "tile-ico", text: m.ico }),
        h("span", { class: "tile-title", text: m.key ? t(m.key) : c })
      );
    })),
    // secondary affordances — designed (not bare links), but quieter than the tiles
    h("div", { class: "secondary-row" },
      h("button", { class: "ghost-action", type: "button", onclick: startSelfWrite },
        h("span", { class: "ga-ico", "aria-hidden": "true", text: "✎" }), h("span", { text: t("landing.selfWrite") })),
      h("button", { class: "ghost-action", type: "button", title: t("landing.getHelpSoon"),
        onclick: () => alert(t("landing.getHelpSoon")) },
        h("span", { class: "ga-ico", "aria-hidden": "true", text: "💬" }), h("span", { text: t("landing.getHelp") }))
    )
  );
}

function pickCategory(c) { ui.mode = "template"; ui.category = c; go("pick"); }

function startSelfWrite() {
  ui.mode = "selfwrite";
  ui.template = null;
  ui.answers = {};
  ui.authority = null;
  ui.authorityMode = "autocomplete";
  ui.rtiText = "";
  ui.verified = false;
  ui.draftId = ui.draftId || `rti_${Date.now()}`;
  go("editor");
}

// ── screen: template picker ──────────────────────────────────────────────────
function buildPick() {
  const items = listTemplates(TEMPLATE_PACKS).filter((x) => x.category === ui.category);
  return h("div", {},
    backBtn(() => go("category")),
    h("h1", { class: "scr-head", text: t("pick.heading") }),
    h("p", { class: "scr-sub", text: t("pick.sub") }),
    h("div", { class: "tiles" }, items.map((it) => {
      const full = getTemplate(TEMPLATE_PACKS, it.id);
      const desc = templateDescription(full, ui.lang);
      return h("button", { class: "tile", type: "button", onclick: () => selectTemplate(full) },
        h("span", { class: "tile-title", text: templateTitle(full, ui.lang) }),
        // user-facing description only — the internal routing `note` is NEVER shown here
        desc ? h("span", { class: "tile-sub", text: desc }) : null
      );
    })),
    h("div", { class: "secondary-row" },
      h("button", { class: "ghost-action", type: "button", onclick: startSelfWrite },
        h("span", { class: "ga-ico", "aria-hidden": "true", text: "✎" }), h("span", { text: t("landing.noneFit") }))
    )
  );
}

function selectTemplate(tpl) {
  ui.mode = "template";
  ui.template = tpl;
  ui.answers = {};
  ui.blankIdx = 0;
  ui.authority = null;
  ui.verified = false;
  ui.draftId = `rti_${Date.now()}`;
  if (blankSequence(tpl).length > 0) go("blanks");
  else afterBlanks();
}

// ── screen: blanks (one question per screen) ─────────────────────────────────
function buildBlanks() {
  const blanks = blankSequence(ui.template);
  const blank = blanks[ui.blankIdx];
  const total = blanks.length;
  const errId = "blankErr";

  const control = buildBlankControl(blank);

  const next = () => {
    const val = ui.answers[blank.id];
    if (!isBlankAnswered(blank, val)) { $(errId).hidden = false; return; }
    if (ui.blankIdx < total - 1) { ui.blankIdx++; go("blanks"); }
    else afterBlanks();
  };
  const back = () => {
    if (ui.blankIdx > 0) { ui.blankIdx--; go("blanks"); }
    else go("pick");
  };

  return h("div", {},
    backBtn(back),
    h("p", { class: "scr-sub", style: "margin-bottom:6px", text: t("blank.progress", { n: ui.blankIdx + 1, total }) }),
    h("h1", { class: "scr-head", text: blank.label },
      blank.required ? null : h("span", { class: "opt", text: ` (${t("common.optional")})`, style: "font-size:0.5em;color:var(--ink-faint)" })
    ),
    control,
    h("div", { class: "field-err", id: errId, hidden: true, text: t("blank.requiredErr") }),
    h("div", { class: "btn-row" },
      h("button", { class: "btn btn-primary", type: "button", onclick: next, text: t("common.next") })
    )
  );
}

function buildBlankControl(blank) {
  const setVal = (v) => { ui.answers[blank.id] = v; const e = $("blankErr"); if (e) e.hidden = true; };
  if (blank.type === "select") {
    return customSelect({
      value: ui.answers[blank.id] || "",
      options: blank.options || [],
      placeholder: t("blank.selectPlaceholder"),
      onChange: setVal
    });
  }
  const type = blank.type === "number" ? "number" : blank.type === "date" ? "date" : "text";
  return h("input", {
    class: "inp", type, value: ui.answers[blank.id] || "",
    oninput: (e) => setVal(e.target.value)
  });
}

function afterBlanks() {
  const r = resolveAuthority(ui.template, ui.answers);
  ui.authority = r.authority;
  ui.authorityMode = r.mode;
  ui.rtiText = renderBody(ui.template, ui.answers, ui.lang);
  ui.verified = false;
  persistDraft();
  go("editor");
}

// ── screen: editor (the hero) ────────────────────────────────────────────────
function buildEditor() {
  const showAutocomplete = ui.authorityMode === "autocomplete" || ui.mode === "selfwrite" || !ui.authority;

  // The ministry selector lives in the DARK chrome, ABOVE the parchment letter.
  const ministryBlock = showAutocomplete
    ? authorityAutocomplete()
    : h("div", { class: "ministry-field" },
        h("div", { class: "mf-lbl", text: t("editor.ministryLabel") }),
        h("div", { class: "mf-value", text: ui.authority }),
        h("div", { class: "mf-row" },
          matchBadge(ui.authority),
          h("button", { class: "mf-change", type: "button",
            onclick: () => { ui.authorityMode = "autocomplete"; go("editor"); }, text: t("editor.changeMinistry") })
        )
      );

  const ta = h("textarea", {
    class: "ed-body", id: "rtiBody", placeholder: t("editor.empty"),
    oninput: (e) => onBodyEdit(e.target.value)
  });
  ta.value = ui.rtiText;

  const stateHints = detectStateHints(ui.rtiText + " " + (ui.authority || ""));
  const showState = (ui.template && ui.template.isStateLevel) || stateHints.length > 0;

  const node = h("div", {},
    ui.mode === "template"
      ? backBtn(() => { const seq = blankSequence(ui.template); if (seq.length) { ui.blankIdx = seq.length - 1; go("blanks"); } else go("pick"); })
      : backBtn(() => go("category")),
    ui.restored ? h("div", { class: "tip info" }, h("span", { class: "tip-ico", text: "↺" }), h("span", { text: t("editor.restored") })) : null,
    h("p", { class: "scr-sub", text: t("editor.sub") }),
    showState ? h("div", { class: "tip warn" },
      h("span", { class: "tip-ico", text: "⚠" }),
      h("span", {}, h("strong", { text: t("state.heading") }), h("br"), t("state.body"))
    ) : null,
    ministryBlock,
    // The RTI editor — dark, calm, easy on the eyes (the parchment "letter"
    // appears as a read-only preview on the File screen, not while editing).
    h("div", { class: "editor-doc" },
      h("div", { class: "lh-watermark", "aria-hidden": "true" }, buildChakra(300, false)),
      h("div", { class: "lh-masthead" },
        h("span", { class: "lh-wheel", "aria-hidden": "true" }, buildChakra(20, false)),
        h("span", { class: "lh-motto", text: "सत्यमेव जयते · Truth alone prevails" })
      ),
      h("div", { class: "lh-caption", text: t("editor.heroHeader") }),
      ta,
      h("div", { class: "char-row" },
        h("span", { class: "char-ok", id: "charOk" }),
        h("span", { class: "char-ct", id: "charCount" })
      ),
      h("div", { class: "char-track" }, h("div", { class: "char-fill", id: "charFill" }))
    ),
    h("div", { class: "btn-row" },
      h("button", { class: "btn btn-ghost", type: "button", id: "readAloudBtn",
        onclick: toggleReadAloud, text: t("editor.readAloud") }),
      h("button", { class: "btn btn-primary", type: "button", onclick: toEditorVerify, text: t("editor.toVerify") })
    )
  );

  queueMicrotask(updateCharCount);
  return node;
}

function onBodyEdit(value) {
  ui.rtiText = value;
  if (ui.verified) { ui.verified = false; } // any edit invalidates verification
  updateCharCount();
  persistDraft();
}

function updateCharCount() {
  const len = (ui.rtiText || "").length;
  const over = len > 3000;
  const fill = $("charFill"), ok = $("charOk"), ct = $("charCount");
  if (!fill) return;
  fill.style.width = Math.min(100, (len / 3000) * 100) + "%";
  fill.style.background = over ? "var(--red)" : "var(--green)";
  ok.textContent = over ? t("editor.charCountOver") : t("editor.charCountOk");
  ok.classList.toggle("over", over);
  ct.textContent = `${len.toLocaleString()} / 3000`;
  ct.classList.toggle("over", over);
}

function toEditorVerify() {
  if (!ui.rtiText.trim()) { $("rtiBody").focus(); return; }
  if (ui.rtiText.length > 3000) { alert(t("editor.charCountOver")); return; }
  if (!ui.authority) { alert(t("authority.heading")); const a = $("authInput"); if (a) a.focus(); return; }
  persistDraft();
  go("verify");
}

// ── authority autocomplete (inline) ──────────────────────────────────────────
function authorityAutocomplete() {
  const wrap = h("div", { class: "ministry-field" },
    h("div", { class: "mf-lbl", text: t("authority.heading") })
  );
  const input = h("input", {
    class: "inp", id: "authInput", placeholder: t("authority.placeholder"),
    autocomplete: "off", value: ui.authority || "",
    style: "margin-top:8px",
    oninput: (e) => onAuthInput(e.target.value),
    onfocus: (e) => onAuthInput(e.target.value)
  });
  const list = h("ul", { class: "cselect-list", id: "authList", hidden: true, style: "position:relative;margin-top:6px" });
  const badge = h("div", { id: "authBadge", style: "margin-top:8px" });
  wrap.append(input, list, badge);
  queueMicrotask(() => updateAuthBadge(ui.authority || ""));
  return wrap;
}

function onAuthInput(value) {
  ui.authority = value.trim() || null;
  if (ui.verified) ui.verified = false;
  const list = $("authList");
  const q = value.trim().toLowerCase();
  const matches = q ? ministries.filter((m) => m.toLowerCase().includes(q)).slice(0, 8) : [];
  if (matches.length) {
    list.replaceChildren(...matches.map((m) =>
      h("li", { class: "cselect-opt", onmousedown: (e) => { e.preventDefault(); setAuthority(m); } }, m)
    ));
    list.hidden = false;
  } else {
    list.hidden = true;
  }
  updateAuthBadge(value);
  persistDraft();
}

function setAuthority(name) {
  ui.authority = name;
  const input = $("authInput");
  if (input) input.value = name;
  $("authList").hidden = true;
  updateAuthBadge(name);
  persistDraft();
}

function isOfficial(name) {
  const n = (name || "").trim().toLowerCase();
  return !!n && ministries.some((m) => m.toLowerCase() === n);
}

function updateAuthBadge(name) {
  const badge = $("authBadge");
  if (!badge) return;
  if (!name || !name.trim()) { badge.replaceChildren(); return; }
  badge.replaceChildren(matchBadge(name));
}

function matchBadge(name) {
  const ok = isOfficial(name);
  return h("span", { class: `lh-match ${ok ? "ok" : "warn"}`, text: ok ? t("authority.matchOk") : t("authority.matchWarn") });
}

// ── read-aloud (Web Speech) ──────────────────────────────────────────────────
function toggleReadAloud() {
  const btn = $("readAloudBtn");
  if (!("speechSynthesis" in window)) return;
  if (speaking) { window.speechSynthesis.cancel(); speaking = false; if (btn) btn.textContent = t("editor.readAloud"); return; }
  const u = new SpeechSynthesisUtterance(ui.rtiText);
  u.onend = () => { speaking = false; if ($("readAloudBtn")) $("readAloudBtn").textContent = t("editor.readAloud"); };
  speaking = true;
  if (btn) btn.textContent = t("editor.stopAloud");
  window.speechSynthesis.speak(u);
}

// ── screen: verify (mandatory gate) ───────────────────────────────────────────
function buildVerify() {
  const asks = ui.template ? renderAsks(ui.template, ui.answers, ui.lang) : [];
  const source = ui.mode === "selfwrite" ? "selfwrite" : "template";
  const { warnings } = checkValidity(ui.rtiText, asks, progress.rtis, source);

  return h("div", {},
    backBtn(() => go("editor")),
    h("h1", { class: "scr-head", text: t("verify.heading") }),

    asks.length ? h("div", {},
      h("p", { class: "scr-sub", style: "margin-bottom:4px", text: t("verify.askingFor") }),
      h("p", { class: "asks-note", text: t("verify.asksNote") }),
      // Tick/untick suggestions — a self-review aid, NOT a gate (the buttons decide).
      h("ul", { class: "readback" }, asks.map((a) => h("li", {},
        h("label", { class: "ask-check" },
          h("input", { type: "checkbox", checked: "checked", "aria-label": a }),
          h("span", { text: a })
        )
      )))
    ) : null,

    ui.template && ui.template.appealLikely && ui.template.appealNote
      ? h("div", { class: "tip appeal" },
          h("span", { class: "tip-ico", text: "⚖" }),
          h("span", {},
            h("strong", { text: t("verify.appealTitle") }), h("br"),
            h("span", { class: "appeal-lead", text: t("verify.appealLead") }), h("br"),
            h("span", { class: "appeal-detail", text: ui.template.appealNote })))
      : null,

    warnings.length ? h("div", {},
      h("div", { class: "card-title", style: "margin:18px 0 8px", text: t("verify.warningsTitle") }),
      warnings.map((w) => h("div", { class: "tip warn" },
        h("span", { class: "tip-ico", text: "⚠" }), h("span", { text: w.message })))
    ) : null,

    h("p", { class: "scr-sub", style: "margin-top:18px", text: t("verify.decisionPrompt") }),
    h("div", { class: "btn-row" },
      h("button", { class: "btn btn-ghost", type: "button", onclick: () => go("editor"), text: t("verify.edit") }),
      h("button", { class: "btn btn-primary", type: "button", onclick: onVerifyConfirm, text: t("verify.correct") })
    )
  );
}

async function onVerifyConfirm() {
  ui.verified = true;
  await persistDraft();
  // Route through details whenever they're missing OR invalid — the popup's Fill
  // button is hard-gated on valid details, so we collect them properly here.
  if (!validateDetails(details).ok) go("details");
  else go("ready");
}

// ── screen: applicant details ─────────────────────────────────────────────────
function buildDetails() {
  const mk = (id, key, type, val) => h("div", { class: "field" },
    h("label", { class: "field-label", for: id, text: t(key) }),
    h("input", { class: "inp", id, type: type || "text", value: val || "" }),
    h("div", { class: "field-err", id: id + "Err", hidden: true })
  );
  return h("div", {},
    backBtn(() => go("verify")),
    h("h1", { class: "scr-head", text: t("details.heading") }),
    h("p", { class: "scr-sub", text: t("details.sub") }),
    mk("dName", "details.name", "text", details.name),
    mk("dAddress", "details.address", "text", details.address),
    mk("dEmail", "details.email", "email", details.email),
    mk("dEmailConfirm", "details.emailConfirm", "email", details.email),
    mk("dMobile", "details.mobile", "tel", details.mobile),
    h("div", { class: "field" },
      h("label", { class: "field-label", text: t("details.bplLabel") }),
      customSelect({
        value: ui.bpl,
        options: [{ value: "no", label: t("details.bplNo") }, { value: "yes", label: t("details.bplYes") }],
        placeholder: t("details.bplNo"),
        onChange: (v) => { ui.bpl = v; persistDraft(); }
      })
    ),
    h("div", { class: "btn-row" },
      h("button", { class: "btn btn-primary", type: "button", onclick: saveDetailsAndContinue, text: t("details.continue") })
    )
  );
}

const DETAIL_FIELD_IDS = { name: "dName", address: "dAddress", email: "dEmail", emailConfirm: "dEmailConfirm", mobile: "dMobile" };

async function saveDetailsAndContinue() {
  const d = {
    name: $("dName").value.trim(),
    address: $("dAddress").value.trim(),
    email: $("dEmail").value.trim(),
    emailConfirm: $("dEmailConfirm").value.trim(),
    mobile: $("dMobile").value.trim()
  };
  // clear prior errors
  Object.values(DETAIL_FIELD_IDS).forEach((id) => { const e = $(id + "Err"); if (e) e.hidden = true; });
  const { ok, errors } = validateDetails(d);
  if (!ok) {
    for (const [field, msg] of Object.entries(errors)) {
      const e = $(DETAIL_FIELD_IDS[field] + "Err");
      if (e) { e.textContent = msg; e.hidden = false; }
    }
    return;
  }
  details = { name: d.name, address: d.address, email: d.email, mobile: d.mobile }; // emailConfirm is a typo-guard only, not stored
  await saveDetails(details);
  go("ready");
}

// ── screen: FILE (the v3 two-column file screen) ──────────────────────────────
function buildReady() {
  const sectionLabel = (txt) => h("div", { class: "sec-label", text: txt });
  const kvRow = (k, v, green) => h("div", { class: "kv" }, h("span", { class: "k", text: k }), h("span", { class: green ? "v-green" : "", text: v }));

  const left = h("div", { class: "file-col" },
    sectionLabel(t("file.summaryTitle")),
    h("div", { class: "card summary-card" },
      kvRow(t("editor.ministryLabel"), ui.authority || "—"),
      kvRow(t("file.kvApplicant"), details.name || "—"),
      kvRow(t("file.kvLength"), `${ui.rtiText.length.toLocaleString()} chars`),
      kvRow(t("ready.fee"), ui.bpl === "yes" ? "₹0 · BPL waived" : "₹10 · online"),
      kvRow(t("file.kvDraftSaved"), t("file.kvDraftSavedVal"), true)
    ),
    sectionLabel(t("file.whatHappens")),
    h("ol", { class: "what-list" }, [1, 2, 3, 4, 5].map((n) =>
      h("li", { class: "wl-item" }, h("span", { class: "wl-n", text: String(n) }),
        h("span", { class: n === 4 ? "wl-strong" : "", text: t("file.step" + n) })))),
    h("div", { class: "vault-strip" }, h("span", { class: "vs-i", text: "🛡" }), h("span", { class: "vs-t", text: t("file.vault") })),
    h("div", { class: "refill-strip" },
      h("span", { class: "rf-t", text: t("file.refillTitle") }),
      h("button", { class: "rf-btn", type: "button", onclick: openPortalAndFill, text: "↻ " + t("file.refill") }))
  );

  const right = h("div", { class: "file-col" },
    h("p", { class: "demand-line", text: t("file.ceremonySub") }),
    parchmentPreview(),
    // The CAPTCHA + payment visualization — principle #2: never automate or hide it.
    h("div", { class: "captcha-card" },
      h("div", { class: "cap-head" }, h("span", { class: "cap-h-i", text: "🔒" }), h("span", { class: "cap-h-t", text: t("file.captchaTitle") })),
      h("div", { class: "cap-body", text: t("file.captchaBody") }),
      h("div", { class: "cap-preview" }, h("span", { class: "cap-code", text: "X4R9T" }), h("span", { class: "cap-hint", text: t("file.captchaHint") }))),
    h("div", { class: "sec-strip" }, h("span", { class: "ss-i", text: "🛡" }), h("span", { class: "ss-t", text: t("file.security") })),
    ui.template && ui.template.appealLikely && ui.template.appealNote
      ? h("div", { class: "tip appeal" }, h("span", { class: "tip-ico", text: "⚖" }), h("span", { text: ui.template.appealNote })) : null,
    h("button", { class: "btn btn-primary shiny file-cta", type: "button", onclick: openPortalAndFill, text: "↗ " + t("file.openPortal") })
  );

  const node = h("div", {},
    backBtn(() => go("editor")), // Ready → back to the draft (fix)
    h("h1", { class: "scr-head", text: t("file.heading") }),
    h("div", { class: "file-cols" }, left, right)
  );
  return node;
}

// The RTI shown as a calm "letter" — dark with a faint warm tint (no glare),
// matching the editor's colour, with the SVG wheel watermark + masthead.
function parchmentPreview() {
  return h("div", { class: "editor-doc preview" },
    h("div", { class: "lh-watermark", "aria-hidden": "true" }, buildChakra(300, false)),
    h("div", { class: "lh-masthead" },
      h("span", { class: "lh-wheel", "aria-hidden": "true" }, buildChakra(20, false)),
      h("span", { class: "lh-motto", text: "सत्यमेव जयते · Truth alone prevails" })),
    h("div", { class: "lh-caption", text: t("editor.heroHeader") }),
    h("div", { class: "doc-body preview-body", text: ui.rtiText })
  );
}

// Write the fill payload and open the portal from the app; show the filing screen.
async function openPortalAndFill() {
  ui.draftId = ui.draftId || `rti_${Date.now()}`;
  await writeFillPayload({
    authority: ui.authority || "", ministry: ui.authority || "",
    name: details.name, address: details.address, email: details.email, mobile: details.mobile,
    rtiText: ui.rtiText, bpl: ui.bpl, draftId: ui.draftId, lang: ui.lang
  });
  try { await browserApi.tabs.create({ url: PORTAL_URL }); } catch (_e) { /* popup Fill is the fallback path */ }
  go("filing");
}

// ── screen: FILING (combined portal-loading factoids + registration entry) ────
function buildFiling() {
  const card = selectCard(DYK_CARDS, { track: inferTrack(ui.authority || ""), seenIds: progress.seenCards, filings: (progress.rtis || []).length });
  if (card && !progress.seenCards.includes(card.id)) { progress.seenCards.push(card.id); setLocal(LOCAL_KEYS.PROGRESS, progress); }
  const tips = ["filing.tip1", "filing.tip2", "filing.tip3", "filing.tip4"].map((k) => t(k));

  const node = h("div", {},
    h("div", { class: "loading-zone" },
      h("div", { class: "load-wheel" }),
      h("h1", { class: "scr-head center", text: t("filing.title") }),
      h("p", { class: "scr-sub center", text: t("filing.sub") }),
      h("div", { class: "load-bar-wrap" }, h("div", { class: "load-bar" })),
      card ? h("div", { class: "dyk" },
        h("div", { class: "dyk-label", text: t("filing.dykLabel") }),
        h("div", { class: "dyk-text", text: card.text }),
        h("div", { class: "dyk-src", text: "— " + card.source })) : null,
      h("div", { class: "tip-chips" }, tips.map((tx) => h("div", { class: "tip-chip", text: tx })))
    ),
    h("div", { class: "card ref-card" },
      h("div", { class: "card-title", text: t("filing.refTitle") }),
      h("p", { class: "scr-sub", style: "margin-bottom:14px", text: t("filing.refBody") }),
      h("div", { class: "field" },
        h("label", { class: "field-label", for: "refInput", text: t("filing.refLabel") }),
        h("input", { class: "inp", id: "refInput", placeholder: t("filing.refPlaceholder"), value: ui.ref || "" }),
        h("div", { class: "field-err", id: "refErr", hidden: true, text: t("filing.refErr") })
      ),
      h("div", { class: "btn-row", style: "margin-top:6px" },
        h("button", { class: "btn btn-ghost", type: "button", onclick: fileAwaiting, text: t("filing.awaiting") }),
        h("button", { class: "btn btn-primary", type: "button", onclick: confirmFilingWithRef, text: t("filing.confirm") })
      ),
      h("div", { style: "margin-top:12px" }, h("button", { class: "btn-link", type: "button", onclick: openPortalAndFill, text: t("filing.reopenPortal") }))
    )
  );
  queueMicrotask(() => { const w = node.querySelector && node.querySelector(".load-wheel"); if (w) w.appendChild(buildChakra(80, false)); });
  return node;
}

function makeRti(status) {
  return {
    id: ui.draftId || `rti_${Date.now()}`,
    ministry: ui.authority || "",
    track: inferTrack(ui.authority || ""),
    issue: ui.template ? synthesizeIssue(ui.template, ui.answers) : shorten(ui.rtiText, 120),
    charCount: ui.rtiText.length,
    status, filedAt: new Date().toISOString(), ref: "", refilledCount: 0
  };
}

function scheduleDeadline(rti) {
  browserApi.runtime.sendMessage({
    type: "SCHEDULE_DEADLINE", payload: { draftId: rti.id, ministry: rti.ministry, filedAt: rti.filedAt }
  }).catch(() => {});
}

function resetDraftState() {
  Object.assign(ui, {
    mode: "template", category: null, template: null, answers: {}, blankIdx: 0,
    authority: null, authorityMode: "constant", rtiText: "", bpl: "no",
    verified: false, draftId: null, restored: false, ref: ""
  });
}

// Reference number captured → award the deferred XP, celebrate (ceremonial).
async function confirmFilingWithRef() {
  const ref = ($("refInput").value || "").trim();
  if (!ref) { $("refErr").hidden = false; return; }
  const rti = makeRti("awaiting_ref");
  addAwaitingRti(progress, rti);
  const res = confirmReference(progress, rti.id, ref);
  await setLocal(LOCAL_KEYS.PROGRESS, progress);
  scheduleDeadline(rti);
  await clearDraft();
  lastReward = { gained: res.awarded, newBadges: res.newBadges, rti: progress.rtis.find((r) => r.id === rti.id) || rti };
  resetDraftState();
  go("postgame");
}

// No number yet (arrives by email) → track it, but NO XP/celebration (truth-anchored).
async function fileAwaiting() {
  const rti = makeRti("awaiting_ref");
  addAwaitingRti(progress, rti);
  await setLocal(LOCAL_KEYS.PROGRESS, progress);
  scheduleDeadline(rti);
  await clearDraft();
  resetDraftState();
  go("history");
}

// ── screen: POSTGAME (ceremonial — civic honour, no confetti) ─────────────────
function buildPostgame() {
  const r = lastReward || { gained: 0, newBadges: [], rti: {} };
  const sum = buildSummary(progress);

  // Honours: medals struck now + the NEXT sealed honour to aim for (shown locked).
  const filedTrack = (r.rti && r.rti.track) || (sum.tracks[0] && sum.tracks[0].id);
  const trk = sum.tracks.find((x) => x.id === filedTrack) || sum.tracks[0];
  const medals = r.newBadges.map((b) => ({ name: b.name, earned: true }));
  if (trk && trk.nextBadge) medals.push({ name: trk.nextBadge.name, earned: false, sub: t("postgame.lockedMore", { n: trk.toNext, track: trk.name }) });
  const perk = (ic, ti, su) => h("div", { class: "perk" },
    h("span", { class: "pk-i", text: ic }),
    h("span", { class: "pk-t" }, h("strong", { text: ti }), h("span", { text: su })));

  const node = h("div", {},
    h("div", { class: "filed-mark" }, h("span", { class: "fm-i", text: "✓" }),
      h("span", { class: "fm-t", text: t("postgame.filed") + (r.rti.ministry ? " · " + r.rti.ministry : "") })),
    r.rti.ref ? h("div", { class: "ministry-line", text: t("postgame.refLine", { ref: r.rti.ref }) }) : null,

    h("div", { class: "xp-section" },
      h("div", { class: "xp-head" },
        h("span", { class: "gb-lbl", text: t("game.civicXp") }),
        h("span", { class: "xp-gained", text: t("postgame.gained", { n: r.gained }) })),
      h("div", { class: "gb-track" }, h("div", { class: "gb-fill", id: "pgFill" })),
      h("div", { class: "xp-sub", text: sum.level.next
        ? t("postgame.nextIn", { lvl: sum.level.level, next: sum.level.level + 1, name: sum.level.next, xp: sum.level.toNext })
        : t("postgame.maxLevel", { name: sum.level.name }) })
    ),

    medals.length ? h("div", {},
      h("div", { class: "card-title", style: "margin:18px 0 10px", text: t("postgame.medalsTitle") }),
      h("div", { class: "medals-row" }, medals.map((m, i) =>
        h("div", { class: m.earned ? "medal struck" : "medal locked", style: m.earned ? `animation-delay:${i * 130}ms` : null },
          h("span", { class: "medal-ico", text: m.earned ? "🏅" : "🔒" }),
          h("span", { class: "medal-n", text: m.name }),
          h("span", { class: "medal-s", text: m.earned ? t("postgame.earnedNow") : (m.sub || "") }))))
    ) : null,

    h("div", { class: "login-card", id: "loginCard" },
      h("div", { class: "ls-head", text: t("postgame.loginHeadline") }),
      h("p", { class: "ls-sub", text: t("postgame.loginSub") }),
      h("div", { class: "perks-grid" },
        perk("⧉", t("perk.syncT"), t("perk.syncS")),
        perk("🏛", t("perk.boardT"), t("perk.boardS")),
        perk("🔔", t("perk.trackerT"), t("perk.trackerS")),
        perk("⚇", t("perk.networkT"), t("perk.networkS"))
      ),
      h("button", { class: "btn btn-primary shiny login-btn", type: "button", onclick: () => alert(t("postgame.localNote")), text: "＋ " + t("postgame.loginBtn") }),
      h("div", { class: "skip-line" }, h("button", { class: "btn-link", type: "button", onclick: () => { const c = $("loginCard"); if (c) c.hidden = true; }, text: t("postgame.skip") })),
      h("div", { class: "local-note" }, h("span", { class: "ln-i", text: "🔒" }), h("span", { text: t("postgame.localNote") }))
    ),

    h("div", { class: "btn-row" },
      h("button", { class: "btn btn-ghost", type: "button", onclick: () => go("history"), text: t("postgame.toHistory") }),
      h("button", { class: "btn btn-primary", type: "button", onclick: startNew, text: t("postgame.another") })
    )
  );
  queueMicrotask(() => { const f = $("pgFill"); if (f) f.style.width = Math.round(sum.level.progress * 100) + "%"; });
  return node;
}

// ── screen: history (folded from dashboard) ───────────────────────────────────
let addingRefFor = null;

function buildHistory() {
  const sum = buildSummary(progress);
  const rtis = progress.rtis || [];
  const resumable = ui.draftId && (ui.rtiText || "").trim().length > 0;
  const blocks = [h("h1", { class: "scr-head", text: t("history.heading") })];

  // Resume the in-progress draft (fix: navigating to My RTIs mid-draft lost it).
  if (resumable) blocks.push(
    h("div", { class: "card resume-card" },
      h("div", { class: "card-title", text: t("history.resumeTitle") }),
      h("p", { class: "scr-sub", style: "margin-bottom:12px", text: (ui.authority ? ui.authority + " · " : "") + shorten(ui.rtiText, 90) }),
      h("button", { class: "btn btn-primary", type: "button", onclick: () => go("editor"), text: t("history.resume") })
    )
  );

  if (!rtis.length) {
    blocks.push(h("div", { class: "empty-state", text: t("history.empty") }));
    if (!resumable) blocks.push(h("div", { class: "btn-row" }, h("button", { class: "btn btn-primary", type: "button", onclick: startNew, text: t("nav.newRti") })));
    return h("div", {}, ...blocks);
  }

  const statBox = (n, l) => h("div", { class: "stat-box" }, h("span", { class: "stat-n", text: String(n) }), h("span", { class: "stat-l", text: l }));
  blocks.push(h("div", { class: "sec-label", text: t("history.overview") }));
  blocks.push(h("div", { class: "stat-grid" },
    statBox(sum.rtiCount, t("history.statFiled")),
    statBox(sum.repliesIn, t("history.statReplies")),
    statBox(sum.appealsFiled, t("history.statAppeals")),
    statBox(sum.totalXp, t("history.statXp"))
  ));

  if (sum.tracks.length) {
    blocks.push(h("div", { class: "sec-label", text: t("history.tracks") }));
    blocks.push(h("div", { class: "track-list" }, sum.tracks.map((trk) => {
      const next = trk.nextBadge ? trk.nextBadge.threshold : trk.count;
      const pct = Math.min(100, Math.round((trk.count / Math.max(1, next)) * 100));
      return h("div", { class: "track-row" },
        h("span", { class: "tr-dot", style: `background:${trk.color}` }),
        h("div", { class: "tr-main" },
          h("div", { class: "tr-name", text: trk.name }),
          h("div", { class: "tr-bar" }, h("div", { class: "tr-bar-fill", style: `width:${pct}%;background:${trk.color}` }))),
        h("span", { class: "tr-count", text: `${trk.count}` })
      );
    })));
  }

  blocks.push(h("div", { class: "sec-label", text: t("history.all") }));
  blocks.push(h("div", {}, rtis.map((r) => historyItem(r))));
  blocks.push(honorRoll());
  return h("div", {}, ...blocks);
}

function historyItem(r) {
  const status = r.status || "pending";
  const item = h("div", { class: "rti-item" },
    h("div", { class: "rti-top" },
      h("span", { class: "rti-ministry", text: r.ministry || "RTI" }),
      h("span", { class: `rti-status ${status}`, text: t(`history.status.${status}`) })
    ),
    h("div", { class: "rti-meta", text: shorten(r.issue || "", 140) })
  );
  if (r.ref) item.appendChild(h("div", { class: "rti-meta", text: t("history.ref", { ref: r.ref }) }));
  if (status === "pending") {
    const d = deadlineDays(r.filedAt);
    item.appendChild(h("div", { class: "rti-meta", text: d >= 0 ? t("history.daysLeft", { n: d }) : t("history.overdue") }));
  } else if (status !== "awaiting_ref") {
    item.appendChild(h("div", { class: "rti-meta", text: new Date(r.filedAt).toLocaleDateString() }));
  }

  if (status === "awaiting_ref") {
    if (addingRefFor === r.id) {
      item.appendChild(h("div", { class: "field", style: "margin-top:12px" },
        h("input", { class: "inp", id: "histRef_" + r.id, placeholder: t("filing.refPlaceholder"), value: "" }),
        h("div", { class: "btn-row", style: "margin-top:10px" },
          h("button", { class: "btn btn-ghost", type: "button", onclick: () => { addingRefFor = null; go("history"); }, text: t("common.cancel") }),
          h("button", { class: "btn btn-primary", type: "button", onclick: () => saveRefFromHistory(r.id), text: t("history.refSave") })
        )));
    } else {
      item.appendChild(h("div", { class: "rti-actions" },
        h("button", { class: "btn btn-ghost", type: "button", onclick: () => { addingRefFor = r.id; go("history"); }, text: t("history.addRef") })
      ));
    }
  } else if (status === "pending") {
    item.appendChild(h("div", { class: "rti-actions" },
      h("button", { class: "btn btn-ghost", type: "button", onclick: () => updateRtiStatus(r.id, "received"), text: t("history.markReceived") }),
      h("button", { class: "btn btn-ghost", type: "button", onclick: () => updateRtiStatus(r.id, "appeal"), text: t("history.fileAppeal") })
    ));
  }
  return item;
}

// Late reference capture (the "awaiting reference" path) → unlocks the reward.
async function saveRefFromHistory(id) {
  const inp = $("histRef_" + id);
  const ref = ((inp && inp.value) || "").trim();
  if (!ref) { if (inp) inp.focus(); return; }
  const res = confirmReference(progress, id, ref);
  await setLocal(LOCAL_KEYS.PROGRESS, progress);
  addingRefFor = null;
  lastReward = { gained: res.awarded, newBadges: res.newBadges, rti: progress.rtis.find((x) => x.id === id) || {} };
  go("postgame");
}

// Aspirational civic honour-roll (login-gated stub — no account/backend in Stage 1).
function honorRoll() {
  const lockedRow = () => h("li", { class: "honor-row locked" },
    h("span", { class: "hr-rank", text: "—" }), h("span", { class: "hr-name", text: "· · · · · ·" }), h("span", { class: "hr-score", text: "··· XP" }));
  return h("div", { class: "card honor-card" },
    h("div", { class: "card-title", text: "🏛 " + t("history.honorTitle") }),
    h("ol", { class: "honor-list" }, lockedRow(), lockedRow(), lockedRow()),
    h("p", { class: "scr-sub", style: "margin-top:12px", text: t("history.honorTeaser") }),
    h("button", { class: "btn btn-primary", type: "button", onclick: () => alert(t("postgame.localNote")), text: t("history.honorBtn") })
  );
}

async function updateRtiStatus(id, status) {
  const rti = progress.rtis.find((x) => x.id === id);
  if (!rti) return;
  rti.status = status;
  await setLocal(LOCAL_KEYS.PROGRESS, progress);
  go("history");
}

function deadlineDays(filedAt) {
  const due = new Date(filedAt).getTime() + 30 * 24 * 60 * 60 * 1000;
  return Math.ceil((due - Date.now()) / (24 * 60 * 60 * 1000));
}

// ── custom accessible select ──────────────────────────────────────────────────
// options: array of strings OR {value,label}. Single-select, keyboard-capable.
function customSelect({ value, options, placeholder, onChange }) {
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  let open = false;
  let active = Math.max(0, opts.findIndex((o) => o.value === value));

  const selected = opts.find((o) => o.value === value);
  const btn = h("button", {
    type: "button", class: "cselect-btn" + (selected ? "" : " placeholder"),
    "aria-haspopup": "listbox", "aria-expanded": "false",
    text: selected ? selected.label : placeholder
  });
  btn.appendChild(h("span", { class: "cselect-caret", text: "▾" }));

  const list = h("ul", { class: "cselect-list", role: "listbox", hidden: true });
  const renderOpts = () => list.replaceChildren(...opts.map((o, i) =>
    h("li", {
      class: "cselect-opt" + (i === active ? " active" : ""),
      role: "option", "aria-selected": String(o.value === value),
      onmousedown: (e) => { e.preventDefault(); choose(i); }
    }, o.label)
  ));
  const setOpen = (v) => {
    open = v; list.hidden = !v; btn.setAttribute("aria-expanded", String(v));
    if (v) { renderOpts(); list.querySelectorAll(".cselect-opt")[active]?.scrollIntoView({ block: "nearest" }); }
  };
  const choose = (i) => {
    value = opts[i].value; active = i;
    btn.firstChild.textContent = opts[i].label;
    btn.classList.remove("placeholder");
    setOpen(false);
    onChange(value);
  };

  btn.addEventListener("click", () => setOpen(!open));
  btn.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (!open) setOpen(true); else { active = Math.min(opts.length - 1, active + 1); renderOpts(); } }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(0, active - 1); renderOpts(); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (open) choose(active); else setOpen(true); }
    else if (e.key === "Escape") setOpen(false);
    else if (e.key === "Home") { active = 0; renderOpts(); }
    else if (e.key === "End") { active = opts.length - 1; renderOpts(); }
  });
  document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) setOpen(false); });

  const wrap = h("div", { class: "cselect" }, btn, list);
  return wrap;
}

// ── draft persistence ────────────────────────────────────────────────────────
async function persistDraft() {
  if (!ui.draftId) ui.draftId = `rti_${Date.now()}`;
  await saveDraft({
    mode: ui.mode,
    templateId: ui.template ? ui.template.id : null,
    answers: ui.answers,
    issue: ui.template ? synthesizeIssue(ui.template, ui.answers) : shorten(ui.rtiText, 120),
    ministry: ui.authority || "",
    authority: ui.authority || "",
    isState: !!(ui.template && ui.template.isStateLevel),
    stateGuidance: "",
    rtiText: ui.rtiText,
    note: ui.template ? (ui.template.note || "") : "",
    bpl: ui.bpl,
    lang: ui.lang,
    verified: ui.verified,
    draftId: ui.draftId
  });
  flashSaved();
}

let savedTimer = null;
function flashSaved() {
  const ind = $("savedInd");
  if (!ind) return;
  ind.hidden = false;
  $("savedText").textContent = "Saved";
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => { ind.hidden = true; }, 1800);
}

// ── utils ─────────────────────────────────────────────────────────────────────
function backBtn(onClick) {
  return h("button", { class: "back-btn", type: "button", onclick: onClick },
    h("span", { class: "back-arrow", "aria-hidden": "true", text: "←" }),
    h("span", { text: t("common.backShort") })
  );
}
function shorten(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
