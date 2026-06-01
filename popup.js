// popup.js — RTI Setu v2 launcher (ES module).
// The popup is a thin companion to the full-tab web app (app.html). It does three
// things: open the app, show one line of draft status, and — ONLY when a VERIFIED
// draft exists — fill the portal form. All drafting/editing/verification happens in
// the app; nothing detailed is written here.

import { getDraft, getDetails, writeFillPayload, timeAgo } from "./lib/storage.js";
import { validateDetails } from "./lib/validators.js";

const browserApi = (typeof browser !== "undefined") ? browser : chrome;
const $ = (id) => document.getElementById(id);
const PORTAL_URL = "https://rtionline.gov.in/request/request.php";

async function refresh() {
  const draft = await getDraft();
  const status = $("statusLine");
  const fillBtn = $("fillNowBtn");
  const fillNote = $("fillNote");

  if (!draft || !draft.rtiText) {
    status.textContent = "No draft yet — open RTI Setu to start.";
    fillBtn.hidden = true;
    fillNote.hidden = true;
    return;
  }

  const where = draft.authority || draft.ministry || "your RTI";
  status.textContent = `Draft: ${where} · saved ${timeAgo(draft.updatedAt)}`;

  // Fill is hard-gated on TWO things: a verified draft AND valid applicant details
  // (these feed the portal form — a bad email there kills the 30-day reply).
  const detailsOk = validateDetails(await getDetails()).ok;
  if (draft.verified && detailsOk) {
    fillBtn.hidden = false;
    fillNote.hidden = true;
  } else {
    fillBtn.hidden = true;
    fillNote.hidden = false;
    fillNote.textContent = !draft.verified
      ? "Finish reviewing your RTI in the app (the verification step) to unlock portal filling."
      : "Add your name, address and a valid email in the app before filling the portal form.";
  }
}

async function fillNow() {
  const draft = await getDraft();
  if (!draft || !draft.verified) return;
  const details = await getDetails();
  if (!validateDetails(details).ok) { refresh(); return; } // defensive re-check
  await writeFillPayload({
    authority: draft.authority || draft.ministry || "",
    ministry: draft.authority || draft.ministry || "",
    name: details.name || "",
    address: details.address || "",
    email: details.email || "",
    mobile: details.mobile || "",
    rtiText: draft.rtiText || "",
    bpl: draft.bpl || "no",
    draftId: draft.draftId || "",
    lang: draft.lang || "en"
  });
  await browserApi.tabs.create({ url: PORTAL_URL });
  $("savedText").textContent = "Form sent to portal";
}

$("openAppBtn").addEventListener("click", () => {
  browserApi.runtime.sendMessage({ type: "OPEN_APP" }).catch(() => {
    browserApi.tabs.create({ url: browserApi.runtime.getURL("app.html") });
  });
});
$("fillNowBtn").addEventListener("click", fillNow);

// content.js relays when it has filled the form, so the user gets confirmation.
browserApi.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "FORM_FILLED_RELAY") {
    $("savedText").textContent = "Form filled on portal";
  }
});

refresh();
