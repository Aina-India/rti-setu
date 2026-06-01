# RTI Setu — AI-assisted RTI filing

**Your right. Your demand. Filed.**
*सत्यमेव जयते · Truth alone prevails*

A cross-browser (Chrome / Edge / Firefox, Manifest V3) extension that helps any
citizen — including a first-time, non-technical filer — write a legally-correct
Right to Information request and auto-fill it on India's central RTI portal
**rtionline.gov.in**, pausing at the CAPTCHA for you to solve manually.

**v2 is free-by-default and template-first.** Drafting lives in a roomy, fully
offline **web app** (`app.html`, opens in its own tab); the toolbar **popup is a
thin launcher**. You pick a topic, answer 2–4 plain-language questions, and a
proper RTI is generated — **no AI, no account, no cost**. AI is optional and never
on the critical path. A local Civic XP system (badges, day-streaks) stays visible
as the engagement hook. UI is built for six languages (Hindi, Bengali, Telugu,
Marathi, Tamil, English); the filed RTI body is English (Hindi also accepted).

> The four ways to produce an RTI — **templates** (default), **self-write**,
> **open-in-chat with a pre-filled prompt**, and **your own API key** (Advanced) —
> are being rolled out in stages. Stage 1 (this build) ships the offline core:
> templates + self-write + the verification gate + portal auto-fill.

> ⚠️ **rtionline.gov.in covers only CENTRAL government ministries.** State-level
> matters (municipal, state police, land records, etc.) must go to the relevant
> State Information Commission. The extension detects likely state matters and
> warns you.

---

## What's in the box

```
rti-setu/
├── manifest.json          MV3 manifest (Chrome/Edge/Firefox)
├── background.js          Service worker — session access, deadline alarms, OPEN_APP
├── content.js             Auto-fills the portal form  ← edit SEL here if the site changes
├── app.html/.css/.js      The full-tab web app: wizard, editor, verify, history (the primary surface)
├── popup.html/.css/.js    Thin launcher — open the app · draft status · "Fill the portal form now"
├── test-form.html         Local mock of the portal form for safe testing
├── lib/
│   ├── template-engine.js  Renders RTIs from templates ({blankId}, {_authority}, [[optional]] segments)
│   ├── templates-education.js  Education template pack (6 seed templates, ES module)
│   ├── templates-index.js  Enumerates all template packs
│   ├── ministries.json     Canonical central ministry list (hint; live-reconciled at fill time)
│   ├── validity.js         Verification-gate checks (source-aware; opinion-seeking for self-write/AI only)
│   ├── i18n.js + strings/   UI string runtime + per-language tables (en complete; hi/bn/te/mr/ta scaffolded)
│   ├── ai-providers.js     Claude / OpenAI / Gemini / Ollama + claude.ai fallback (Advanced, Stage 2)
│   ├── ministry-map.js     Ministry → civic track mapping, state-matter hints
│   ├── xp-engine.js         Civic XP, levels, streaks, badges (all local)
│   ├── dyk-cards.js         Curated "Did You Know" pool + selection logic
│   └── storage.js           Enforces the memory/local/session security model
├── icons/                 Dharmachakra icons (16/32/48/128)
└── fonts/                 Drop WOFF2 files here (see fonts/README.txt)
```
*(The v1 `dashboard.html` is retired — history, tracks and the local account stub
are now views inside `app.html`.)*

---

## Installation

### Chrome / Edge / Brave (and any Chromium browser)
1. Go to `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select the `rti-setu/` folder.
4. The Dharmachakra icon appears in your toolbar. Pin it.

### Firefox
1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**
3. Select the `manifest.json` inside `rti-setu/`.
   *(Temporary add-ons clear on restart. For a permanent install, package and
   sign via [addons.mozilla.org](https://addons.mozilla.org).)*

### Safari (desktop) — second-stage, needs a Mac
Safari requires converting the MV3 build into an Xcode project:
```bash
xcrun safari-web-extension-converter /path/to/rti-setu
```
Open the generated Xcode project, build, and enable it in Safari ▸ Settings ▸
Extensions. You need an **Apple Developer account** ($99/yr) to distribute it.
*Safari on iOS is not supported in v1 — WKWebView restricts content scripts on
third-party pages, which blocks the portal auto-fill.*

---

## Getting an AI API key (optional)

You only need a key if you want one-click drafting inside the extension. You can
also use the **claude.ai path** (free with any Claude plan — opens a pre-filled
prompt in a new tab) or **Self-write mode** (no AI at all).

| Provider | Where to get a key | Key looks like |
|---|---|---|
| Claude | console.anthropic.com → API Keys | `sk-ant-…` |
| OpenAI | platform.openai.com → API Keys | `sk-…` |
| Gemini | aistudio.google.com → Get API key | `AIza…` |
| Local / Ollama | run `ollama serve` locally | *(no key)* |

The key is held **in memory only** while the popup is open and is **never
written to disk or any storage**. Close the popup and it's gone.

---

## How your data is handled (the three tiers)

This is the core privacy design. Nothing crosses a tier boundary by accident —
it's all funnelled through `lib/storage.js`.

```
┌─────────────────────────────────────────────────────────────────────┐
│  TIER 1 — MEMORY ONLY                                                 │
│  • Your AI API key                                                    │
│  • Lives in one variable in the popup. Never serialised, never saved. │
│  • Destroyed the instant you close the popup.                         │
├─────────────────────────────────────────────────────────────────────┤
│  TIER 2 — storage.local  (survives restart / reboot — "the vault")    │
│  • Personal details (name, address, email, mobile) for pre-fill       │
│  • The current draft (issue, ministry, RTI text) — auto-saved         │
│  • Civic XP, badges, streak, RTI history, seen DYK cards              │
│  • The draft is the SOURCE OF TRUTH — never lost to a portal failure. │
├─────────────────────────────────────────────────────────────────────┤
│  TIER 3 — storage.session  (the fill bridge — ephemeral)              │
│  • ONLY the form-fill payload, written the moment you open the portal │
│  • content.js reads it once, fills the form, then DELETES it          │
│  • Cleared automatically when the browser session ends regardless     │
└─────────────────────────────────────────────────────────────────────┘
```

What leaves your machine: the AI request (to your chosen provider, only when
you click Draft) and the RTI itself (to rtionline.gov.in, when you submit).
Nothing else. There is no RTI Setu server unless you opt into an account.

---

## ⭐ Selector update guide — *read this first if auto-fill breaks*

`content.js` finds each form field using a list of CSS selectors in the **`SEL`**
object at the top of the file. Government sites change their markup without
notice; when a field stops filling, it's almost always because a `name=` or
`id=` attribute changed. Fixing it takes two minutes and no deep JS knowledge.

**Steps:**
1. Open **rtionline.gov.in**, navigate to the request form.
2. Right-click the field that didn't fill → **Inspect**.
3. In the Elements panel, read the `<input>` / `<select>` / `<textarea>` tag.
   Note its `name="…"` (preferred) or `id="…"`.
4. Open `content.js`, find the matching key in `SEL` (e.g. `statement`,
   `ministry`, `captcha`).
5. Add your new selector to the **front** of that array. Example — if the RTI
   text box changed from `name="statement"` to `name="rti_body"`:

   ```js
   statement: [
     'textarea[name="rti_body"]',   // ← add the new one first
     'textarea[name="statement"]',  // keep the old as fallback
     ...
   ],
   ```
6. Reload the extension (`chrome://extensions` → ↻ on the card). Done.

Each field already lists several fallback strategies, so minor changes often
self-heal. The `SEL` object is the **only** thing you should ever need to edit.

The fields tracked: `ministry`, `name`, `address`, `email`, `emailConfirm`,
`mobile`, `bpl`, `statement`, `captcha`, `captchaImage`, `guidelinesAgree`.

---

## Testing (3 phases)

**Phase 1 — web app standalone.** Open `app.html` (load the extension, then open
it from the popup's "Open RTI Setu", or open the extension URL directly). Pick a
language → a topic → answer the questions → read the generated RTI in the
letterhead editor → pass the verification step. No portal, no permissions needed.
Worth spot-checking the derived-authority cases: edu-002 *Conducting body* = SSC
should target **Department of Personnel and Training**; edu-005 scheme = RUSA
should target **Ministry of Education**; choosing **Other** routes to the ministry
autocomplete. Leave optional blanks empty and confirm no broken "for the post of ,"
fragments appear.

**Phase 2 — local mock form.** Open `test-form.html` directly in the browser
(its field `name=` attributes mirror the real portal). Temporarily add that file's
origin to `content_scripts.matches` + `host_permissions` in `manifest.json`, and
point `popup.js → PORTAL_URL` at it. In the app, draft + verify an RTI; then open
the popup and click **"Fill the portal form now"** (enabled only once a draft is
verified). Confirm every field fills, the resolved ministry matches a live
`<option>`, and the CAPTCHA box gets the orange outline. Revert afterwards.

**Phase 3 — live portal.** Use the real site. The first thing to verify is the
**entry URL and page flow** — see the next section.

### Expected first debugging step on the live site
The popup opens `rtionline.gov.in/request/request.php`. The real flow may be
Home → *Submit Request* → *Guidelines* → form, and the exact request URL can
differ. `content.js` already auto-clicks past a detected guidelines page, but if
the form never loads:
- Check the actual URL of the request form in your browser and update the
  `tabs.create({ url: … })` call in `popup.js → openPortalAndFill()`.
- If there's an intermediate guidelines page, confirm one of the
  `SEL.guidelinesAgree` selectors matches its proceed/agree button.

---

## The gamification (Civic XP), explained

All scoring is computed **locally** in `lib/xp-engine.js` from your own filing
history — no server required. An optional account only *mirrors* this state for
cross-device sync and the leaderboard.

**XP events:** draft generated (+15), RTI filed (+50), re-filled after a portal
failure (+15), heeded a state-level warning (+20), kept the AI's ministry (+10),
marked a reply received (+30), first appeal (+75), CIC second appeal (+100),
7-day streak (+25), first RTI in a new track (+40).

**Levels:** Curious Citizen → Informed Voter → Persistent Requester →
Accountability Enforcer → RTI Veteran → Civic Sentinel → Dharmachakra.

**Tracks & badges:** your RTIs are auto-sorted into eight civic tracks
(Environment, Electoral, Finance, Education, Liberties, Judicial, Governance,
General) inferred from the ministry, each with its own Hindi-named badge ladder
(e.g. *Bhumi Rakshak*, *Jan Auditor*, *Nyaya Sevak*).

**Streaks:** consecutive days with any civic action, computed from timestamps.

The "Did You Know" cards shown while the portal loads are a curated, citeable
pool (`lib/dyk-cards.js`) — never AI-generated — filtered to your active track
and experience level.

---

## The optional account

Login is **never required** and only appears *after* you've filed, on the
post-file screen. Everything works fully offline and local without it. An
account adds: cross-device sync, 30-day deadline push reminders, and
city/state/national leaderboards. A **Dashboard** button and avatar chip appear
in the popup header once you're signed in; the dashboard opens as a full page in
a new tab.

> The account flow is a **local-only stub** (no backend). History and tracks live
> in `app.html`; wire a real auth + sync backend before shipping the account /
> leaderboard feature. There is no RTI Setu server in this build.

---

## Cross-browser build notes

| Browser | Status | Notes |
|---|---|---|
| Chrome / Edge / Brave | ✅ Native MV3 | Load unpacked, or publish to Chrome Web Store. |
| Firefox | ✅ Native MV3 | Uses `browser_specific_settings.gecko`. No `declarativeNetRequest` needed. |
| Safari (desktop) | ⚙️ Convert | `safari-web-extension-converter`; needs Xcode + Apple Dev account. |
| Safari (iOS) | ❌ v1 | WKWebView blocks content scripts on third-party pages. |

All browser API calls use a `browser ?? chrome` shim, so the same codebase runs
everywhere without per-browser forks. The only MV3 constraint that matters here
is **no remote code** — which is why the DYK pool is a bundled JSON module and
fonts are bundled locally; the AI `fetch()` calls are fine (they're data, not code).

---

## Legal & ethical notes

- This tool *assists* filing; you are the applicant and remain responsible for
  the content, the ₹10 fee, and the CAPTCHA. The extension never solves the
  CAPTCHA for you — that's a deliberate design and policy choice.
- RTI requests must seek **information/records**, not opinions or explanations.
  The AI system prompt enforces this, but review every draft.
- Filing fees and the 30-day reply window are set by the RTI Act, 2005 and the
  RTI Rules, 2012. BPL applicants are fee-exempt.

---

## License

MIT for the extension code. Bundled fonts (Fraunces, DM Sans) are under the SIL
Open Font License. The Ashoka Chakra is a national symbol of India used here
respectfully as civic iconography.
