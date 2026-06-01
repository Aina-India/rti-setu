// popup.js — RTI Setu controller (ES module)
import { generateRti, buildClaudeAiUrl, validateKeyShape, PROVIDERS } from "./lib/ai-providers.js";
import { DYK_CARDS, selectCard } from "./lib/dyk-cards.js";
import { inferTrack, detectStateHints, TRACKS } from "./lib/ministry-map.js";
import {
  emptyProgress, levelForXp, computeStreak, computeTracks,
  recordFiling, awardXp, buildSummary
} from "./lib/xp-engine.js";
import {
  getDetails, saveDetails, getDraft, saveDraft, clearDraft,
  getSettings, saveSettings, getLocal, setLocal, LOCAL_KEYS,
  writeFillPayload, timeAgo
} from "./lib/storage.js";

const browserApi = (typeof browser !== "undefined") ? browser : chrome;
const $ = (id) => document.getElementById(id);

// ── MEMORY-ONLY API KEY ──────────────────────────────────────────────────
// This variable is the ONLY place the API key ever lives. It is never written
// to storage of any kind and dies when the popup closes.
let apiKeyInMemory = "";

// ── in-memory working state (mirrors the draft in storage.local) ──────────
const state = {
  provider: "claude",
  model: "",
  endpoint: "",
  skipAi: false,
  issue: "",
  ministry: "",
  isState: false,
  stateGuidance: "",
  rtiText: "",
  note: "",
  bpl: "no",
  step: 1,
  draftId: null
};

let progress = emptyProgress();

// ─────────────────────────────────────────────────────────────────────────
//  WHEEL: build the Dharmachakra spoke-by-spoke, then reveal the brand.
// ─────────────────────────────────────────────────────────────────────────
function buildWheel() {
  const cx = 40, cy = 40, R = 37;
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "80");
  svg.setAttribute("height", "80");
  svg.setAttribute("viewBox", "0 0 80 80");
  svg.setAttribute("fill", "none");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Dharmachakra — the wheel of dharma");

  // 24 spokes, four opacity tiers (mirrors the Ashoka Chakra structure).
  const spokeEls = [];
  for (let i = 0; i < 24; i++) {
    const ang = (i / 24) * Math.PI * 2 - Math.PI / 2;
    const inner = 11, outer = R - 4;
    const x1 = cx + Math.cos(ang) * inner;
    const y1 = cy + Math.sin(ang) * inner;
    const x2 = cx + Math.cos(ang) * outer;
    const y2 = cy + Math.sin(ang) * outer;
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", x1.toFixed(2));
    line.setAttribute("y1", y1.toFixed(2));
    line.setAttribute("x2", x2.toFixed(2));
    line.setAttribute("y2", y2.toFixed(2));
    line.setAttribute("stroke", "#e8650a");
    const tier = i % 6;
    let w = 0.55, op = 0.4;
    if (i % 6 === 0) { w = 1.4; op = 1; }       // 4 cardinal
    else if (i % 3 === 0) { w = 1.2; op = 0.85; } // 4 diagonal
    else if (i % 2 === 0) { w = 0.9; op = 0.6; }  // 8 tertiary
    line.setAttribute("stroke-width", w);
    line.setAttribute("stroke-opacity", op);
    line.setAttribute("stroke-dasharray", "30");
    line.setAttribute("stroke-dashoffset", "30");
    svg.appendChild(line);
    spokeEls.push(line);
  }

  // rim, inner rim, hub
  const rim = document.createElementNS(svgNS, "circle");
  rim.setAttribute("cx", cx); rim.setAttribute("cy", cy); rim.setAttribute("r", R);
  rim.setAttribute("stroke", "#e8650a"); rim.setAttribute("stroke-width", "1.8");
  rim.setAttribute("fill", "none");
  rim.setAttribute("stroke-dasharray", (2 * Math.PI * R).toFixed(1));
  rim.setAttribute("stroke-dashoffset", (2 * Math.PI * R).toFixed(1));
  svg.appendChild(rim);

  const hub = document.createElementNS(svgNS, "circle");
  hub.setAttribute("cx", cx); hub.setAttribute("cy", cy); hub.setAttribute("r", "7");
  hub.setAttribute("stroke", "#e8650a"); hub.setAttribute("stroke-width", "2");
  hub.setAttribute("fill", "none");
  hub.setAttribute("stroke-dasharray", (2 * Math.PI * 7).toFixed(1));
  hub.setAttribute("stroke-dashoffset", (2 * Math.PI * 7).toFixed(1));
  svg.appendChild(hub);

  const hubFill = document.createElementNS(svgNS, "circle");
  hubFill.setAttribute("cx", cx); hubFill.setAttribute("cy", cy); hubFill.setAttribute("r", "3.5");
  hubFill.setAttribute("fill", "#080f1a");
  hubFill.setAttribute("opacity", "0");
  svg.appendChild(hubFill);

  $("wheelWrap").appendChild(svg);

  // animate
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    spokeEls.forEach((s) => (s.style.strokeDashoffset = "0"));
    rim.style.strokeDashoffset = "0";
    hub.style.strokeDashoffset = "0";
    hubFill.style.opacity = "1";
    svg.style.animation = "none";
    return;
  }

  spokeEls.forEach((spk, i) => {
    let delay, dur;
    if (i % 6 === 0) { delay = (i / 6) * 60; dur = 220; }
    else if (i % 3 === 0) { delay = 280 + i * 8; dur = 180; }
    else if (i % 2 === 0) { delay = 600 + i * 12; dur = 140; }
    else { delay = 1100 + i * 8; dur = 100; }
    setTimeout(() => {
      spk.style.transition = `stroke-dashoffset ${dur}ms cubic-bezier(0.4,0,0.2,1)`;
      spk.style.strokeDashoffset = "0";
    }, delay);
  });
  setTimeout(() => { rim.style.transition = "stroke-dashoffset 600ms ease"; rim.style.strokeDashoffset = "0"; }, 1450);
  setTimeout(() => {
    hub.style.transition = "stroke-dashoffset 300ms ease"; hub.style.strokeDashoffset = "0";
    setTimeout(() => { hubFill.style.transition = "opacity .2s"; hubFill.style.opacity = "1"; }, 300);
  }, 1700);
  setTimeout(() => { svg.style.animation = "spin-slow 14s linear infinite"; }, 2200);

  // reveal brand + start typing after the wheel completes
  setTimeout(() => { $("brandBlock").style.animation = "fade-up .5s ease both"; }, 1900);
  setTimeout(() => { $("typingBar").style.animation = "fade-up .4s ease both"; startTyping(); }, 2400);
}

// ─────────────────────────────────────────────────────────────────────────
//  TYPING carousel of RTI topics
// ─────────────────────────────────────────────────────────────────────────
const TOPICS = [
  "Environmental clearance violations",
  "EIA documents · Vizag data centre",
  "PSU bank NPA write-off records",
  "NEET paper leak investigation",
  "Municipal budget · ward expenditure",
  "Forest clearance · Aravalli diversion",
  "Electoral bond recipient disclosures",
  "Landfill inspection reports",
  "Police FIR registration refusals",
  "RTI on RTIs · CIC pendency data",
  "Hospital tender documents",
  "School mid-day meal fund use",
  "Section 69A account block orders",
  "Groundwater extraction approvals"
];
function startTyping() {
  const el = $("typer");
  let ti = 0, ci = 0, typing = true, wait = 0;
  function tick() {
    const word = TOPICS[ti];
    if (typing) {
      ci++; el.textContent = word.slice(0, ci);
      if (ci >= word.length) { typing = false; wait = 0; }
      setTimeout(tick, 55 + Math.random() * 35);
    } else {
      wait++;
      if (wait < 32) { setTimeout(tick, 60); return; }
      ci--; el.textContent = word.slice(0, ci);
      if (ci <= 0) { typing = true; ti = (ti + 1) % TOPICS.length; }
      setTimeout(tick, 26);
    }
  }
  tick();
}

// ─────────────────────────────────────────────────────────────────────────
//  STEP navigation
// ─────────────────────────────────────────────────────────────────────────
function showStep(n) {
  state.step = n;
  [1, 2, 3, 4].forEach((i) => { $(`step${i}`).hidden = i !== n; });
  document.querySelectorAll(".sp").forEach((el) => {
    const s = Number(el.dataset.step);
    el.classList.remove("idle", "live", "done");
    el.classList.add(s < n ? "done" : s === n ? "live" : "idle");
    if (s < n) el.textContent = "✓";
    else el.textContent = String(s);
  });
  document.querySelectorAll(".steps-rail .sl").forEach((el, idx) => {
    el.classList.remove("live", "done");
    if (idx + 1 < n) el.classList.add("done");
    else if (idx + 1 === n) el.classList.add("live");
  });
  persistDraft();
}

// ─────────────────────────────────────────────────────────────────────────
//  PROVIDER selection
// ─────────────────────────────────────────────────────────────────────────
function selectProvider(p) {
  state.provider = p;
  document.querySelectorAll(".pvd").forEach((el) => {
    el.classList.toggle("sel", el.dataset.provider === p);
  });
  const def = PROVIDERS[p];
  $("apiWrap").hidden = state.skipAi || !def.needsKey;
  $("endpointRow").hidden = p !== "ollama";
  $("apiKey").placeholder = def.keyPrefix ? `${def.keyPrefix}...` : "API key";
  validateApiKey();
}

function validateApiKey() {
  const key = $("apiKey").value.trim();
  apiKeyInMemory = key;                         // store ONLY in memory
  const ok = validateKeyShape(state.provider, key);
  $("apiKey").classList.toggle("ok", ok && key.length > 0);
  $("apiBadge").hidden = !(ok && key.length > 0);
}

// ─────────────────────────────────────────────────────────────────────────
//  DRAFT persistence (storage.local — never the API key)
// ─────────────────────────────────────────────────────────────────────────
let saveTimer = null;
function persistDraft() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await saveDraft({
      provider: state.provider, model: state.model, endpoint: state.endpoint,
      skipAi: state.skipAi, issue: state.issue, ministry: state.ministry,
      isState: state.isState, stateGuidance: state.stateGuidance,
      rtiText: state.rtiText, note: state.note, bpl: state.bpl,
      step: state.step, draftId: state.draftId
    });
    flashSaved();
  }, 400);
}
function flashSaved() {
  $("savedText").textContent = "Draft saved";
}

// ─────────────────────────────────────────────────────────────────────────
//  AI drafting
// ─────────────────────────────────────────────────────────────────────────
async function runDraft() {
  state.issue = $("issueText").value.trim();
  if (!state.issue) { $("issueText").focus(); return; }
  if (PROVIDERS[state.provider].needsKey && !validateKeyShape(state.provider, apiKeyInMemory)) {
    showStep(1);
    $("step1Err").hidden = false;
    $("step1Err").textContent = "Enter a valid API key first, or use the claude.ai path / self-write mode.";
    return;
  }
  $("thinkingRow").hidden = false;
  $("draftBtn").disabled = true;
  awardXp(progress, "DRAFT_GENERATED");
  try {
    const details = { name: $("fName").value.trim() };
    const result = await generateRti(state.provider, {
      apiKey: apiKeyInMemory,
      model: state.model,
      endpoint: state.endpoint || $("endpoint").value.trim(),
      issue: state.issue,
      applicantName: details.name
    });
    applyDraftResult(result);
    awardXp(progress, "MINISTRY_CORRECT");
    await persistProgress();
  } catch (err) {
    $("issueText").focus();
    alert(`Could not draft: ${err.message}`);
  } finally {
    $("thinkingRow").hidden = true;
    $("draftBtn").disabled = false;
  }
}

function applyDraftResult(result) {
  state.ministry = result.ministry;
  state.isState = result.is_state;
  state.stateGuidance = result.state_guidance;
  state.rtiText = result.rti_text;
  state.note = result.note;

  $("ministryRow").hidden = false;
  $("ministryEditWrap").hidden = false;
  $("ministryPill").textContent = result.ministry || "Ministry";
  $("ministryInput").value = result.ministry;
  $("rtiText").value = result.rti_text;
  updateCharCount();

  // state-level checks: combine AI flag + client-side keyword hints
  const hints = detectStateHints(state.issue + " " + result.rti_text);
  if (result.is_state || hints.length) {
    $("stateTip").hidden = false;
    $("stateTipText").textContent = result.is_state && result.state_guidance
      ? result.state_guidance
      : `This looks like it may be a state-level matter (${hints.slice(0,2).join(", ")}). rtionline.gov.in covers only central ministries — you may need your State Information Commission instead.`;
  } else {
    $("stateTip").hidden = true;
  }
  persistDraft();
}

function updateCharCount() {
  const len = $("rtiText").value.length;
  state.rtiText = $("rtiText").value;
  const pct = Math.min(100, (len / 3000) * 100);
  $("charFill").style.width = pct + "%";
  $("charCount").textContent = `${len.toLocaleString()} / 3000`;
  const over = len > 3000;
  $("charFill").style.background = over ? "#e24b4a" : "#1D9E75";
  $("charOk").classList.toggle("over", over);
  $("charCount").classList.toggle("over", over);
  $("charOk").textContent = over ? "✗ Over the 3000-character limit" : "✓ Within limit";
}

// ─────────────────────────────────────────────────────────────────────────
//  STEP 3 summary + fill
// ─────────────────────────────────────────────────────────────────────────
function renderSummary() {
  const len = $("rtiText").value.length;
  const provLabel = PROVIDERS[state.provider]?.name || state.provider;
  $("summaryCard").innerHTML = `
    <div class="sc-row"><span class="sc-k">Ministry</span><span class="sc-v">${escapeHtml(state.ministry || "—")}</span></div>
    <div class="sc-row"><span class="sc-k">Applicant</span><span class="sc-v">${escapeHtml($("fName").value || "—")}</span></div>
    <div class="sc-row"><span class="sc-k">RTI length</span><span class="sc-v">${len.toLocaleString()} chars</span></div>
    <div class="sc-row"><span class="sc-k">Filing fee</span><span class="sc-v">${state.bpl === "yes" ? "₹0 · BPL waiver" : "₹10 · online"}</span></div>
    <div class="sc-row"><span class="sc-k">AI provider</span><span class="sc-v">${state.skipAi ? "Self-written" : provLabel}</span></div>
    <div class="sc-row"><span class="sc-k">Draft saved</span><span class="sc-v" style="color:rgba(29,158,117,0.8)">storage.local</span></div>`;
}

async function openPortalAndFill() {
  state.draftId = state.draftId || `rti_${Date.now()}`;
  const details = await getDetails();
  await writeFillPayload({
    ministry: state.ministry,
    name: $("fName").value.trim(),
    address: $("fAddress").value.trim(),
    email: $("fEmail").value.trim(),
    mobile: $("fMobile").value.trim(),
    rtiText: $("rtiText").value,
    bpl: state.bpl,
    draftId: state.draftId
  });
  await browserApi.tabs.create({ url: "https://rtionline.gov.in/request/request.php" });
  $("refillStrip").hidden = false;
  $("markFiledBtn").hidden = false;
  $("savedText").textContent = "Form sent to portal";
}

async function markFiled() {
  const rti = {
    id: state.draftId || `rti_${Date.now()}`,
    ministry: state.ministry,
    track: inferTrack(state.ministry),
    issue: state.issue,
    charCount: $("rtiText").value.length,
    status: "pending",
    filedAt: new Date().toISOString(),
    ref: "",
    refilledCount: 0
  };
  const before = progress.totalXp;
  recordFiling(progress, rti);
  if (rti.refilledCount > 0) awardXp(progress, "REFILL_PERSISTENCE");
  await persistProgress();

  // schedule 30-day deadline reminder
  browserApi.runtime.sendMessage({
    type: "SCHEDULE_DEADLINE",
    payload: { draftId: rti.id, ministry: rti.ministry, filedAt: rti.filedAt }
  }).catch(() => {});

  await clearDraft();
  renderPostgame(progress.totalXp - before, rti);
  showStep(4);
}

// ─────────────────────────────────────────────────────────────────────────
//  POSTGAME / login
// ─────────────────────────────────────────────────────────────────────────
function renderPostgame(gained, rti) {
  $("filedMinistryLine").textContent = "Reference number will arrive in your email within 24 hours";
  const sum = buildSummary(progress);
  $("pgTrackLabel").textContent = `${TRACKS[rti.track]?.name || "General"} · Civic XP`;
  $("pgGained").textContent = `+${gained} XP this session`;
  $("pgFill").style.width = Math.round(sum.level.progress * 100) + "%";
  $("pgSub").innerHTML = sum.level.next
    ? `Lv ${sum.level.level} → <span>Lv ${sum.level.level + 1} · ${escapeHtml(sum.level.next)}</span> in ${sum.level.toNext} XP`
    : `Max level · ${escapeHtml(sum.level.name)}`;

  const trackInfo = sum.tracks.find((t) => t.id === rti.track);
  const badges = [];
  if (trackInfo) {
    if (trackInfo.latestBadge) badges.push({ icon: TRACKS[rti.track].icon, name: trackInfo.latestBadge.name, sub: "Earned", earned: true });
    if (trackInfo.nextBadge) badges.push({ icon: "ti-lock", name: trackInfo.nextBadge.name, sub: `${trackInfo.toNext} more`, earned: false });
  }
  while (badges.length < 3) badges.push({ icon: "ti-award", name: "Keep filing", sub: "—", earned: false, locked: true });
  $("pgBadges").innerHTML = badges.slice(0, 3).map((b) => `
    <div class="pg-badge ${b.earned ? "earned" : "locked"}">
      <span class="pg-bi">${b.earned ? "★" : "🔒"}</span>
      <div class="pg-bn">${escapeHtml(b.name)}</div>
      <div class="pg-bs">${escapeHtml(b.sub)}</div>
    </div>`).join("");

  $("loginSection").hidden = sum.loggedIn;
}

// ─────────────────────────────────────────────────────────────────────────
//  Gamebar (steps 1–3 header)
// ─────────────────────────────────────────────────────────────────────────
function renderGamebar() {
  const sum = buildSummary(progress);
  const topTrack = sum.tracks[0];
  $("xpTrackLabel").textContent = topTrack ? `${topTrack.name} · Civic XP` : "Civic XP";
  $("xpLevelLabel").textContent = `Lv ${sum.level.level} · ${sum.level.name}`;
  requestAnimationFrame(() => { $("xpFill").style.width = Math.round(sum.level.progress * 100) + "%"; });
  $("streakNum").textContent = sum.streak;
  if (topTrack && topTrack.latestBadge) {
    $("badgeName").textContent = topTrack.latestBadge.name;
    $("badgeSub").textContent = `${topTrack.count} ${topTrack.name.split(" ")[0]} RTIs`;
  } else {
    $("badgeName").textContent = "No badge yet";
    $("badgeSub").textContent = "File your first RTI";
  }
  // account row
  if (sum.loggedIn) {
    $("accountRow").hidden = false;
    const name = progress.account.displayName || "You";
    $("avatarName").textContent = name.split(" ")[0];
    $("avatarLevel").textContent = `Lv ${sum.level.level}`;
    $("avatarInitials").textContent = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  } else {
    $("accountRow").hidden = true;
  }
}

async function persistProgress() {
  await setLocal(LOCAL_KEYS.PROGRESS, progress);
  renderGamebar();
}

// ─────────────────────────────────────────────────────────────────────────
//  Restore-on-open
// ─────────────────────────────────────────────────────────────────────────
async function restore() {
  progress = (await getLocal(LOCAL_KEYS.PROGRESS)) || emptyProgress();
  const details = await getDetails();
  $("fName").value = details.name || "";
  $("fAddress").value = details.address || "";
  $("fEmail").value = details.email || "";
  $("fMobile").value = details.mobile || "";

  const settings = await getSettings();
  state.skipAi = !!settings.skipAi;
  $("skipToggle").setAttribute("aria-checked", String(state.skipAi));
  selectProvider(settings.provider || "claude");

  const draft = await getDraft();
  if (draft) {
    Object.assign(state, {
      provider: draft.provider || state.provider,
      model: draft.model || "",
      endpoint: draft.endpoint || "",
      issue: draft.issue || "",
      ministry: draft.ministry || "",
      isState: draft.isState || false,
      stateGuidance: draft.stateGuidance || "",
      rtiText: draft.rtiText || "",
      note: draft.note || "",
      bpl: draft.bpl || "no",
      draftId: draft.draftId || null
    });
    $("issueText").value = state.issue;
    if (state.rtiText) {
      $("rtiText").value = state.rtiText;
      $("ministryRow").hidden = false;
      $("ministryEditWrap").hidden = false;
      $("ministryPill").textContent = state.ministry || "Ministry";
      $("ministryInput").value = state.ministry;
      updateCharCount();
    }
    $("bplSelect").value = state.bpl;
    selectProvider(state.provider);

    $("restoreBanner").hidden = false;
    $("restoreText").innerHTML = `<strong>Draft restored</strong> — saved ${timeAgo(draft.updatedAt)}${state.ministry ? " · " + escapeHtml(state.ministry) : ""}`;
  }
  renderGamebar();
}

// ─────────────────────────────────────────────────────────────────────────
//  utils
// ─────────────────────────────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function saveDetailsFromForm() {
  await saveDetails({
    name: $("fName").value.trim(),
    address: $("fAddress").value.trim(),
    email: $("fEmail").value.trim(),
    mobile: $("fMobile").value.trim()
  });
}

// ─────────────────────────────────────────────────────────────────────────
//  WIRING
// ─────────────────────────────────────────────────────────────────────────
function wire() {
  // provider tiles
  document.querySelectorAll(".pvd").forEach((el) =>
    el.addEventListener("click", () => { selectProvider(el.dataset.provider); saveSettings({ provider: el.dataset.provider, skipAi: state.skipAi }); }));

  $("apiKey").addEventListener("input", validateApiKey);
  $("endpoint").addEventListener("input", () => { state.endpoint = $("endpoint").value.trim(); });

  $("skipToggle").addEventListener("click", () => {
    state.skipAi = !state.skipAi;
    $("skipToggle").setAttribute("aria-checked", String(state.skipAi));
    $("apiWrap").hidden = state.skipAi || !PROVIDERS[state.provider].needsKey;
    saveSettings({ provider: state.provider, skipAi: state.skipAi });
  });

  // details autosave
  ["fName", "fAddress", "fEmail", "fMobile"].forEach((id) =>
    $(id).addEventListener("input", () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveDetailsFromForm, 400); }));

  // claude.ai fallback
  $("useClaudeAi").addEventListener("click", (e) => {
    e.preventDefault();
    const issue = $("issueText").value.trim() || prompt("Describe your RTI issue:") || "";
    if (!issue) return;
    browserApi.tabs.create({ url: buildClaudeAiUrl(issue, $("fName").value.trim()) });
  });

  // step 1 → 2
  $("toStep2").addEventListener("click", async () => {
    $("step1Err").hidden = true;
    if (!$("fAddress").value.trim() || !$("fEmail").value.trim()) {
      $("step1Err").hidden = false;
      $("step1Err").textContent = "Address and email are required.";
      return;
    }
    await saveDetailsFromForm();
    if (state.skipAi) { $("aiRow").style.opacity = ".5"; }
    showStep(2);
  });

  // step 2 actions
  $("draftBtn").addEventListener("click", runDraft);
  $("chatBtn").addEventListener("click", () => {
    const issue = $("issueText").value.trim();
    if (!issue) { $("issueText").focus(); return; }
    browserApi.tabs.create({ url: buildClaudeAiUrl(issue, $("fName").value.trim()) });
  });
  $("selfWriteBtn").addEventListener("click", () => {
    $("ministryRow").hidden = false;
    $("ministryEditWrap").hidden = false;
    $("rtiText").focus();
  });
  $("issueText").addEventListener("input", () => { state.issue = $("issueText").value; persistDraft(); });
  $("rtiText").addEventListener("input", () => { updateCharCount(); persistDraft(); });
  $("ministryInput").addEventListener("input", () => {
    state.ministry = $("ministryInput").value.trim();
    $("ministryPill").textContent = state.ministry || "Ministry";
    persistDraft();
  });

  $("backTo1").addEventListener("click", () => showStep(1));
  $("toStep3").addEventListener("click", () => {
    if ($("rtiText").value.length > 3000) { alert("RTI text exceeds 3000 characters. Trim it before filing."); return; }
    if (!$("rtiText").value.trim()) { alert("Write or generate the RTI text first."); $("rtiText").focus(); return; }
    state.ministry = $("ministryInput").value.trim() || state.ministry;
    renderSummary();
    showStep(3);
  });

  // step 3
  $("bplSelect").addEventListener("change", () => { state.bpl = $("bplSelect").value; renderSummary(); persistDraft(); });
  $("backTo2").addEventListener("click", () => showStep(2));
  $("fileBtn").addEventListener("click", openPortalAndFill);
  $("refillBtn").addEventListener("click", async () => {
    state.refilledFlag = true;
    await openPortalAndFill();
  });
  $("markFiledBtn").addEventListener("click", markFiled);

  // restore banner clear
  $("restoreClear").addEventListener("click", async () => {
    await clearDraft();
    $("restoreBanner").hidden = true;
    Object.assign(state, { issue: "", ministry: "", rtiText: "", note: "", isState: false, draftId: null });
    $("issueText").value = ""; $("rtiText").value = ""; $("ministryInput").value = "";
    $("ministryRow").hidden = true; $("ministryEditWrap").hidden = true; $("stateTip").hidden = true;
    updateCharCount();
  });

  // step 4
  $("dashBtn").addEventListener("click", () => browserApi.runtime.sendMessage({ type: "OPEN_DASHBOARD" }));
  $("loginBtn").addEventListener("click", () => browserApi.tabs.create({ url: browserApi.runtime.getURL("dashboard.html#login") }));
  $("skipLogin").addEventListener("click", (e) => { e.preventDefault(); $("loginSection").hidden = true; });
  $("fileAnother").addEventListener("click", () => {
    Object.assign(state, { issue: "", ministry: "", rtiText: "", note: "", isState: false, draftId: null });
    $("issueText").value = ""; $("rtiText").value = ""; $("ministryInput").value = "";
    $("ministryRow").hidden = true; $("ministryEditWrap").hidden = true; $("stateTip").hidden = true;
    $("refillStrip").hidden = true; $("markFiledBtn").hidden = true;
    updateCharCount();
    showStep(1);
  });

  // relay from content.js when the form is filled (so re-fill flag → persistence XP later)
  browserApi.runtime.onMessage.addListener((msg) => {
    if (msg.type === "FORM_FILLED_RELAY") {
      $("savedText").textContent = "Form filled on portal";
    }
  });
}

// ── boot ──
(async function init() {
  buildWheel();
  wire();
  await restore();
})();
