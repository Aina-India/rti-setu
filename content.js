// content.js
// Injected into rtionline.gov.in. Reads the fill payload from session storage,
// detects which page we're on (guidelines vs request form), fills every field
// it can find, highlights the CAPTCHA, shows an in-page banner, and then
// IMMEDIATELY deletes the payload from session storage.
//
// ── THE SELECTOR MAP ──────────────────────────────────────────────────────
// This is the single most likely thing to break when rtionline.gov.in changes
// its markup. Each field lists MULTIPLE strategies, tried in order. To fix a
// broken field: open DevTools → Elements on the live form, find the input's
// name= / id= attribute, and add it to the front of the relevant array here.
// Nothing else in this file should need editing.
// ───────────────────────────────────────────────────────────────────────────

const SEL = {
  // Ministry / department dropdown
  ministry: [
    'select[name="ministry_id"]',
    'select[name="ministry"]',
    'select[id*="ministry" i]',
    'select[name*="dept" i]',
    'select[id*="department" i]'
  ],
  // Applicant full name
  name: [
    'input[name="applicant_name"]',
    'input[name="name"]',
    'input[id*="applicant" i]',
    'input[id*="name" i]:not([id*="user" i])'
  ],
  // Address (often a textarea)
  address: [
    'textarea[name="address"]',
    'textarea[id*="address" i]',
    'input[name="address"]',
    'input[id*="address" i]'
  ],
  // Email
  email: [
    'input[name="email_id"]',
    'input[name="email"]',
    'input[type="email"]',
    'input[id*="email" i]:not([id*="confirm" i]):not([id*="cemail" i])'
  ],
  // Confirm email (same value as email)
  emailConfirm: [
    'input[name="cemail_id"]',
    'input[name="confirm_email"]',
    'input[id*="cemail" i]',
    'input[id*="confirm" i][id*="email" i]'
  ],
  // Mobile number
  mobile: [
    'input[name="mobile_no"]',
    'input[name="mobile"]',
    'input[id*="mobile" i]',
    'input[type="tel"]'
  ],
  // BPL checkbox / radio
  bpl: [
    'input[name="bpl"]',
    'input[id*="bpl" i]',
    'input[name*="below_poverty" i]'
  ],
  // RTI statement / text body
  statement: [
    'textarea[name="statement"]',
    'textarea[name="rti_text"]',
    'textarea[id*="statement" i]',
    'textarea[id*="rti" i]',
    'textarea[maxlength="3000"]'
  ],
  // CAPTCHA / security code input
  captcha: [
    'input[name="security_code"]',
    'input[name="captcha"]',
    'input[id*="captcha" i]',
    'input[id*="security" i]',
    'input[name*="vcode" i]'
  ],
  // CAPTCHA image (to scroll into view)
  captchaImage: [
    "#captchaImage",
    'img[id*="captcha" i]',
    'img[src*="captcha" i]',
    'img[alt*="captcha" i]'
  ],
  // The "agree / proceed / submit" button on the GUIDELINES page
  guidelinesAgree: [
    "#submit",
    'input[type="submit"][value*="Submit" i]',
    'button[type="submit"]',
    'input[type="button"][value*="agree" i]',
    'a[href*="request" i]'
  ]
};

const ORANGE = "#e8650a";
const browserApi = (typeof browser !== "undefined") ? browser : chrome;

// ── helpers ────────────────────────────────────────────────────────────────
function pick(strategies) {
  for (const sel of strategies) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function setNativeValue(el, value) {
  // React/Angular-safe value setter — fire input + change so frameworks notice.
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function fillText(strategies, value) {
  if (value == null || value === "") return false;
  const el = pick(strategies);
  if (!el) return false;
  setNativeValue(el, value);
  return true;
}

function selectMinistryByText(strategies, ministryName) {
  const el = pick(strategies);
  if (!el || el.tagName !== "SELECT") return false;
  const target = ministryName.trim().toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const opt of el.options) {
    const txt = opt.textContent.trim().toLowerCase();
    if (!txt) continue;
    let score = 0;
    if (txt === target) score = 100;
    else if (txt.includes(target) || target.includes(txt)) score = 60;
    else {
      // token overlap
      const a = new Set(target.split(/\s+/));
      const b = txt.split(/\s+/);
      const overlap = b.filter((w) => a.has(w)).length;
      score = overlap * 10;
    }
    if (score > bestScore) { bestScore = score; best = opt; }
  }
  if (best && bestScore >= 20) {
    el.value = best.value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  return false;
}

function setBpl(strategies, isBpl) {
  const el = pick(strategies);
  if (!el) return false;
  if (el.type === "checkbox") {
    el.checked = !!isBpl;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  return false;
}

function highlightCaptcha() {
  const img = pick(SEL.captchaImage);
  const input = pick(SEL.captcha);
  if (img) img.scrollIntoView({ behavior: "smooth", block: "center" });
  else if (input) input.scrollIntoView({ behavior: "smooth", block: "center" });
  if (input) {
    input.style.outline = `3px solid ${ORANGE}`;
    input.style.outlineOffset = "2px";
    input.style.borderRadius = "4px";
    input.style.transition = "outline 0.2s";
    setTimeout(() => input.focus(), 400);
  }
  return !!input;
}

function showBanner(filledCount, captchaFound) {
  document.getElementById("rti-setu-banner")?.remove();
  const bar = document.createElement("div");
  bar.id = "rti-setu-banner";
  bar.setAttribute("role", "status");
  Object.assign(bar.style, {
    position: "fixed",
    top: "0",
    left: "0",
    right: "0",
    zIndex: "2147483647",
    background: "#0d1b2a",
    color: "#f2ece0",
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "14px",
    padding: "12px 18px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
    borderBottom: `2px solid ${ORANGE}`
  });
  const dot = document.createElement("span");
  Object.assign(dot.style, {
    width: "10px", height: "10px", borderRadius: "50%",
    background: ORANGE, flexShrink: "0"
  });
  const msg = document.createElement("span");
  msg.style.flex = "1";
  msg.innerHTML = captchaFound
    ? `<strong>RTI Setu</strong> filled ${filledCount} field${filledCount === 1 ? "" : "s"}. Complete the <strong style="color:${ORANGE}">CAPTCHA highlighted in orange</strong>, then pay ₹10 and submit.`
    : `<strong>RTI Setu</strong> filled ${filledCount} field${filledCount === 1 ? "" : "s"}. Scroll down to find the CAPTCHA, complete it, then pay ₹10 and submit.`;
  const close = document.createElement("button");
  close.textContent = "✕";
  Object.assign(close.style, {
    background: "transparent", border: "none", color: "#f2ece0",
    fontSize: "16px", cursor: "pointer", flexShrink: "0"
  });
  close.onclick = () => bar.remove();
  bar.append(dot, msg, close);
  document.body.appendChild(bar);
  document.body.style.paddingTop =
    (parseInt(getComputedStyle(document.body).paddingTop || "0", 10) + 48) + "px";
}

function onGuidelinesPage() {
  // Heuristic: a guidelines page has the agree/proceed control but NOT the
  // statement textarea.
  const hasStatement = !!pick(SEL.statement);
  const hasAgree = !!pick(SEL.guidelinesAgree);
  return hasAgree && !hasStatement;
}

function onRequestForm() {
  return !!pick(SEL.statement) || !!pick(SEL.ministry);
}

async function fillForm(payload) {
  let filled = 0;
  if (selectMinistryByText(SEL.ministry, payload.ministry)) filled++;
  if (fillText(SEL.name, payload.name)) filled++;
  if (fillText(SEL.address, payload.address)) filled++;
  if (fillText(SEL.email, payload.email)) filled++;
  if (fillText(SEL.emailConfirm, payload.email)) filled++;
  if (fillText(SEL.mobile, payload.mobile)) filled++;
  if (setBpl(SEL.bpl, payload.bpl === "yes")) filled++;
  if (fillText(SEL.statement, payload.rtiText)) filled++;

  const captchaFound = highlightCaptcha();
  showBanner(filled, captchaFound);

  // Tell the background worker the fill is done (so XP is recorded even if the
  // popup is closed), then WIPE the session payload immediately.
  try {
    await browserApi.runtime.sendMessage({
      type: "FORM_FILLED",
      payload: { draftId: payload.draftId, ministry: payload.ministry, filledCount: filled }
    });
  } catch (e) { /* popup/worker may be asleep; the draft remains the source of truth */ }

  await browserApi.storage.session.remove("fillPayload");
}

async function run() {
  // Guidelines page → click through automatically, then the request form loads.
  if (onGuidelinesPage()) {
    const agree = pick(SEL.guidelinesAgree);
    if (agree) {
      // Give the page a tick, then proceed.
      setTimeout(() => agree.click(), 300);
    }
    return;
  }

  if (!onRequestForm()) return;

  const out = await browserApi.storage.session.get("fillPayload");
  const payload = out.fillPayload;
  if (!payload) return; // nothing queued — user navigated here manually
  await fillForm(payload);
}

// Run once at idle, and once more after a short delay in case the form is
// rendered late by the portal's own scripts.
run();
setTimeout(run, 1200);
