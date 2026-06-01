// storage.js
// Centralises ALL persistence so the security model is enforced in one place.
//
// THREE TIERS, strictly separated:
//   1. MEMORY ONLY  — the API key. Lives in a module-scoped variable inside the
//                     popup. Never written to ANY storage. Dies when popup closes.
//   2. storage.local — personal details, draft, XP/progress, seen-cards. Survives
//                     browser restart and reboot. The "vault" / source of truth.
//   3. storage.session — the form-fill payload ONLY, written at the moment of
//                     injection and deleted by content.js immediately after fill.
//
// chrome.storage.session is exposed to content scripts only when
// `setAccessLevel` permits it; we do that explicitly in background.js.

const browserApi = (typeof browser !== "undefined") ? browser : chrome;

export const LOCAL_KEYS = {
  DETAILS: "details",        // { name, address, email, mobile }
  DRAFT: "draft",            // { provider, model, endpoint, issue, ministry, isState, stateGuidance, rtiText, note, bpl, step, updatedAt }
  PROGRESS: "progress",      // see xp-engine.emptyProgress()
  SETTINGS: "settings"       // { provider, skipAi, lastProvider }
};

export const SESSION_KEY = "fillPayload"; // { ministry, name, address, email, mobile, rtiText, bpl, draftId, ts }

// ---- local storage (the vault) ----
export async function getLocal(key) {
  const out = await browserApi.storage.local.get(key);
  return out[key];
}

export async function setLocal(key, value) {
  await browserApi.storage.local.set({ [key]: value });
}

export async function getDetails() {
  return (await getLocal(LOCAL_KEYS.DETAILS)) || { name: "", address: "", email: "", mobile: "" };
}

export async function saveDetails(details) {
  await setLocal(LOCAL_KEYS.DETAILS, details);
}

export async function getDraft() {
  return (await getLocal(LOCAL_KEYS.DRAFT)) || null;
}

export async function saveDraft(draft) {
  draft.updatedAt = new Date().toISOString();
  await setLocal(LOCAL_KEYS.DRAFT, draft);
}

export async function clearDraft() {
  await browserApi.storage.local.remove(LOCAL_KEYS.DRAFT);
}

export async function getSettings() {
  return (await getLocal(LOCAL_KEYS.SETTINGS)) || { provider: "claude", skipAi: false };
}

export async function saveSettings(settings) {
  await setLocal(LOCAL_KEYS.SETTINGS, settings);
}

// ---- session storage (the fill bridge) ----
export async function writeFillPayload(payload) {
  payload.ts = Date.now();
  await browserApi.storage.session.set({ [SESSION_KEY]: payload });
}

export async function readFillPayload() {
  const out = await browserApi.storage.session.get(SESSION_KEY);
  return out[SESSION_KEY] || null;
}

export async function wipeFillPayload() {
  await browserApi.storage.session.remove(SESSION_KEY);
}

// Human-readable "saved N ago" for the restore banner.
export function timeAgo(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}
