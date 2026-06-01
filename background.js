// background.js  (MV3 service worker, type: module)
// Responsibilities:
//   - Grant content scripts access to chrome.storage.session (needed so
//     content.js can read the fill payload).
//   - Schedule and fire 30-day RTI response-deadline reminders via alarms.
//   - Open the dashboard tab on request.
//   - Relay "filing complete" events so XP is recorded even if the popup closed.

const browserApi = (typeof browser !== "undefined") ? browser : chrome;

// Allow content scripts (TRUSTED_AND_UNTRUSTED contexts) to read session storage.
// Without this, content.js cannot see the fill payload the popup wrote.
async function ensureSessionAccess() {
  try {
    if (browserApi.storage.session.setAccessLevel) {
      await browserApi.storage.session.setAccessLevel({
        accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS"
      });
    }
  } catch (e) {
    // Firefox may not implement setAccessLevel; session is readable by content
    // scripts there by default. Safe to ignore.
  }
}

browserApi.runtime.onInstalled.addListener(ensureSessionAccess);
browserApi.runtime.onStartup.addListener(ensureSessionAccess);
ensureSessionAccess();

// --- messaging ---
browserApi.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "OPEN_DASHBOARD") {
    browserApi.tabs.create({ url: browserApi.runtime.getURL("dashboard.html") });
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === "SCHEDULE_DEADLINE") {
    // msg.payload: { draftId, ministry, filedAt }
    const when = new Date(msg.payload.filedAt).getTime() + 30 * 24 * 60 * 60 * 1000;
    browserApi.alarms.create(`deadline:${msg.payload.draftId}`, { when });
    // a gentle nudge at day 25, too
    const nudge = new Date(msg.payload.filedAt).getTime() + 25 * 24 * 60 * 60 * 1000;
    browserApi.alarms.create(`nudge:${msg.payload.draftId}`, { when: nudge });
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === "FORM_FILLED") {
    // content.js notifies us when it has filled the form and wiped the payload.
    // We relay to any open popup; if none, the popup will read the draft on next open.
    browserApi.runtime.sendMessage({ type: "FORM_FILLED_RELAY", payload: msg.payload }).catch(() => {});
    sendResponse({ ok: true });
    return true;
  }

  return false;
});

// --- deadline alarms ---
browserApi.alarms.onAlarm.addListener(async (alarm) => {
  const [kind, draftId] = alarm.name.split(":");
  if (kind !== "deadline" && kind !== "nudge") return;

  const out = await browserApi.storage.local.get("progress");
  const progress = out.progress;
  if (!progress) return;
  const rti = progress.rtis.find((r) => r.id === draftId);
  if (!rti || rti.status === "received" || rti.status === "appeal") return;

  const title = kind === "deadline"
    ? "RTI deadline reached"
    : "RTI deadline approaching";
  const message = kind === "deadline"
    ? `The 30-day window for your ${rti.ministry} RTI has closed. If no reply arrived, you can file a free first appeal.`
    : `5 days left on your ${rti.ministry} RTI. Watch for a reply.`;

  if (browserApi.notifications) {
    browserApi.notifications.create(`rti-${draftId}-${kind}`, {
      type: "basic",
      iconUrl: browserApi.runtime.getURL("icons/icon-128.png"),
      title,
      message
    });
  }
});
