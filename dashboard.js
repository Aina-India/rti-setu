// dashboard.js
import { emptyProgress, buildSummary, levelForXp } from "./lib/xp-engine.js";
import { TRACKS } from "./lib/ministry-map.js";
import { getLocal, setLocal, LOCAL_KEYS } from "./lib/storage.js";

const browserApi = (typeof browser !== "undefined") ? browser : chrome;
const $ = (id) => document.getElementById(id);
let progress = emptyProgress();
let filter = "all";

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function daysSince(iso) { return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); }

function buildWheel() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", "26"); svg.setAttribute("height", "26");
  svg.setAttribute("viewBox", "0 0 26 26"); svg.setAttribute("fill", "none");
  svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "Dharmachakra");
  const cx = 13, cy = 13, R = 12;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const l = document.createElementNS(ns, "line");
    l.setAttribute("x1", (cx + Math.cos(a) * 2).toFixed(2));
    l.setAttribute("y1", (cy + Math.sin(a) * 2).toFixed(2));
    l.setAttribute("x2", (cx + Math.cos(a) * (R - 1)).toFixed(2));
    l.setAttribute("y2", (cy + Math.sin(a) * (R - 1)).toFixed(2));
    l.setAttribute("stroke", "#e8650a");
    l.setAttribute("stroke-width", i % 3 === 0 ? "1" : "0.5");
    l.setAttribute("stroke-opacity", i % 3 === 0 ? "1" : "0.5");
    svg.appendChild(l);
  }
  const rim = document.createElementNS(ns, "circle");
  rim.setAttribute("cx", cx); rim.setAttribute("cy", cy); rim.setAttribute("r", R);
  rim.setAttribute("stroke", "#e8650a"); rim.setAttribute("stroke-width", "1.2"); rim.setAttribute("fill", "none");
  svg.appendChild(rim);
  const hub = document.createElementNS(ns, "circle");
  hub.setAttribute("cx", cx); hub.setAttribute("cy", cy); hub.setAttribute("r", "2.3"); hub.setAttribute("fill", "#e8650a");
  svg.appendChild(hub);
  $("wheel").appendChild(svg);
}

function renderAvatar(sum) {
  if (sum.loggedIn) {
    const name = progress.account.displayName || "You";
    $("dashAvatar").innerHTML = `
      <div class="av-chip">
        <div class="av-circle">${escapeHtml(name.split(" ").map((w) => w[0]).join("").slice(0,2).toUpperCase())}</div>
        <div><div class="av-name">${escapeHtml(name)}</div><div class="av-lvl">Lv ${sum.level.level} · ${escapeHtml(sum.level.name)} · ${sum.streak}-day streak</div></div>
      </div>`;
    $("syncState").textContent = "Synced · " + (progress.account.email || "");
    $("lbNote").textContent = "";
  } else {
    $("syncState").textContent = "Local record · not synced";
  }
}

function renderStats(sum) {
  $("statGrid").innerHTML = `
    <div class="dstat"><div class="ds-n">${sum.rtiCount}</div><div class="ds-l">RTIs filed</div></div>
    <div class="dstat"><div class="ds-n">${sum.repliesIn}</div><div class="ds-l">Replies in</div></div>
    <div class="dstat"><div class="ds-n">${sum.appealsFiled}</div><div class="ds-l">Appeals filed</div></div>
    <div class="dstat"><div class="ds-n">${sum.totalXp}</div><div class="ds-l">Civic XP</div></div>`;
}

function renderTracks(sum) {
  if (!sum.tracks.length) { $("trackList").innerHTML = `<div class="lb-locked">No tracks yet — file an RTI to begin.</div>`; return; }
  $("trackList").innerHTML = sum.tracks.map((t) => {
    const def = TRACKS[t.id];
    const pct = t.nextBadge ? Math.min(100, (t.count / t.nextBadge.threshold) * 100) : 100;
    return `<div class="track-row">
      <span class="tr-dot" style="background:${def.color}"></span>
      <div class="tr-info">
        <div class="tr-name">${escapeHtml(t.name)}</div>
        <div class="tr-badge">${t.latestBadge ? escapeHtml(t.latestBadge.name) : "—"}${t.nextBadge ? ` · ${t.toNext} to ${escapeHtml(t.nextBadge.name)}` : " · maxed"}</div>
        <div class="tr-bar-wrap"><div class="tr-bar" style="width:${pct}%;background:${def.color}"></div></div>
      </div>
      <span class="tr-count">${t.count}</span>
    </div>`;
  }).join("");
}

function renderLeaderboard(sum) {
  if (!sum.loggedIn) {
    $("lbList").innerHTML = `<div class="lb-locked">Create a free account to join the Bengaluru leaderboard and compare with other citizens filing RTIs in your city.</div>`;
    return;
  }
  // When logged in this would come from the server. Shown here with the user's
  // own entry as the live local value, others as synced data.
  const you = { name: progress.account.displayName || "You", xp: sum.totalXp, you: true };
  const others = progress.account.leaderboard || [];
  const rows = [...others, you].sort((a, b) => b.xp - a.xp).slice(0, 8);
  $("lbList").innerHTML = rows.map((r, i) => `
    <div class="lb-row">
      <span class="lb-rank ${r.you ? "you" : ""}">${i + 1}</span>
      <span class="lb-name ${r.you ? "you" : ""}">${escapeHtml(r.name)}${r.you ? " · you" : ""}</span>
      <span class="lb-score ${r.you ? "you" : ""}">${r.xp.toLocaleString()} XP</span>
    </div>`).join("");
}

function badgeClass(status) {
  return status === "received" ? "rb-received" : status === "appeal" ? "rb-appeal" : "rb-pending";
}
function badgeLabel(status) {
  return status === "received" ? "Reply received" : status === "appeal" ? "Appeal filed" : "Awaiting reply";
}

function renderRtis() {
  const list = progress.rtis.filter((r) => filter === "all" ? true : r.status === filter);
  if (!progress.rtis.length) { $("emptyState").hidden = false; $("rtiList").innerHTML = ""; return; }
  $("emptyState").hidden = true;
  $("rtiList").innerHTML = list.map((r) => {
    const since = daysSince(r.filedAt);
    const remaining = Math.max(0, 30 - since);
    let meta = `Filed ${since} day${since === 1 ? "" : "s"} ago`;
    if (r.status === "pending") meta += ` · <span class="ri-deadline">${remaining} day${remaining === 1 ? "" : "s"} remaining</span>`;
    if (r.ref) meta += ` · Ref: ${escapeHtml(r.ref)}`;
    let actions = `<button class="ri-act primary" data-act="refill" data-id="${r.id}">↻ Re-fill if portal failed</button>`;
    if (r.status === "pending") {
      actions += `<button class="ri-act" data-act="received" data-id="${r.id}">Mark received</button>`;
      if (remaining === 0) actions += `<button class="ri-act primary" data-act="appeal" data-id="${r.id}">File first appeal</button>`;
    } else if (r.status === "received") {
      actions += `<button class="ri-act primary" data-act="appeal" data-id="${r.id}">File first appeal</button>`;
    }
    return `<div class="rti-item">
      <div class="ri-top">
        <div class="ri-title">${escapeHtml(r.ministry)} · ${escapeHtml((r.issue || "").slice(0, 70))}${(r.issue || "").length > 70 ? "…" : ""}</div>
        <span class="ri-badge ${badgeClass(r.status)}">${badgeLabel(r.status)}</span>
      </div>
      <div class="ri-meta">${meta}</div>
      <div class="ri-actions">${actions}</div>
    </div>`;
  }).join("");

  $("rtiList").querySelectorAll(".ri-act").forEach((btn) =>
    btn.addEventListener("click", () => handleAction(btn.dataset.act, btn.dataset.id)));
}

async function handleAction(act, id) {
  const rti = progress.rtis.find((r) => r.id === id);
  if (!rti) return;
  if (act === "received") {
    rti.status = "received";
    progress.totalXp += 30;
    progress.events.push({ type: "RESPONSE_RECEIVED", xp: 30, at: new Date().toISOString(), meta: { id } });
  } else if (act === "appeal") {
    rti.status = "appeal";
    progress.totalXp += 75;
    progress.events.push({ type: "FIRST_APPEAL", xp: 75, at: new Date().toISOString(), meta: { id } });
  } else if (act === "refill") {
    rti.refilledCount = (rti.refilledCount || 0) + 1;
    progress.totalXp += 15;
    progress.events.push({ type: "REFILL_PERSISTENCE", xp: 15, at: new Date().toISOString(), meta: { id } });
    await setLocal("fillPayload_refill", { id });
    alert("Open rtionline.gov.in from the extension popup's Re-fill button to retry the form fill. Your draft is preserved.");
  }
  await setLocal(LOCAL_KEYS.PROGRESS, progress);
  renderAll();
}

function renderAll() {
  const sum = buildSummary(progress);
  renderAvatar(sum);
  renderStats(sum);
  renderTracks(sum);
  renderLeaderboard(sum);
  renderRtis();
}

function wire() {
  document.querySelectorAll(".filter").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll(".filter").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      filter = b.dataset.filter;
      renderRtis();
    }));
  $("loginCta").addEventListener("click", () => {
    // Placeholder for the real OAuth/email flow. For now, a local-only demo
    // account so the leaderboard/sync UI is exercisable.
    const name = prompt("Display name for your civic account:");
    if (!name) return;
    progress.account = { displayName: name, email: "", leaderboard: [] };
    setLocal(LOCAL_KEYS.PROGRESS, progress).then(renderAll);
  });
}

(async function init() {
  buildWheel();
  wire();
  progress = (await getLocal(LOCAL_KEYS.PROGRESS)) || emptyProgress();
  if (location.hash === "#login") $("loginCta")?.click();
  renderAll();
})();
