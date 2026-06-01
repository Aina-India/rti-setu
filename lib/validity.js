// validity.js
// Verification-gate quality checks. Pure functions, no DOM/chrome. The gate is
// the anti-spam / quality mechanism: volume is already capped by the ₹10 fee +
// manual CAPTCHA (which we never automate), so the real risk is low-quality or
// invalid drafts. These checks produce gentle warnings the user confirms past.
//
// SOURCE-AWARE (MUST-FIX #2): the aggressive opinion-seeking check must NOT fire
// on the tool's own vetted template bodies (e.g. edu-002 legitimately asks for
// "recorded reasons for any delay"). So opinion-seeking only runs for "selfwrite"
// and "ai" sources. A gate that flags its own gold-standard templates teaches
// users to ignore it.

// Phrasing that asks for opinions/reasons/justifications rather than records.
// RTI can seek documents and records, not opinions or explanations.
const OPINION_PATTERNS = [
  { re: /\bwhy did you\b/i, hint: '"why did you…"' },
  { re: /\bwhy was\b/i, hint: '"why was…"' },
  { re: /\bwhy is\b/i, hint: '"why is…"' },
  { re: /\bplease explain\b/i, hint: '"please explain…"' },
  { re: /\bexplain why\b/i, hint: '"explain why…"' },
  { re: /\bjustify\b/i, hint: '"justify…"' },
  { re: /\byour opinion\b/i, hint: '"your opinion…"' },
  { re: /\bwhat do you think\b/i, hint: '"what do you think…"' }
];
// Note: deliberately NOT matching the bare phrase "reason for" / "reasons for" —
// asking for *recorded reasons* (a document) is valid and appears in vetted
// templates. We only flag the explicit opinion-seeking verbs above.

const VAGUE_MIN_CHARS = 40; // a body shorter than this is almost certainly too thin

// Normalise text for duplicate comparison.
function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

// Token-Jaccard similarity in [0,1].
function jaccard(a, b) {
  const sa = new Set(normalize(a).split(" ").filter(Boolean));
  const sb = new Set(normalize(b).split(" ").filter(Boolean));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
}

// checkValidity(rtiText, asks, pastRtis, source)
//   rtiText  : the final RTI body string
//   asks     : array of plain-language readback lines
//   pastRtis : progress.rtis (each may have .issue and/or .rtiText)
//   source   : "template" | "selfwrite" | "ai"
// → { warnings: [{ id, level, message }], ok: bool }
//   level: "block" never used here (the gate is advisory by design); all are "warn".
export function checkValidity(rtiText, asks = [], pastRtis = [], source = "template") {
  const warnings = [];
  const text = String(rtiText || "");

  // 1. Empty / too thin.
  if (text.trim().length < VAGUE_MIN_CHARS) {
    warnings.push({
      id: "too_short",
      level: "warn",
      message: "This RTI looks very short. Make sure it clearly names the specific records you want."
    });
  }

  // 2. Unresolved placeholders left in the body (engine left a {key} verbatim).
  const leftover = text.match(/\{[^}]+\}|\[\[|\]\]/g);
  if (leftover) {
    warnings.push({
      id: "unresolved",
      level: "warn",
      message: `Some blanks weren't filled — the text still contains ${leftover.slice(0, 3).join(", ")}. Edit it before filing.`
    });
  }

  // 3. Opinion-seeking — SELF-WRITE / AI ONLY.
  if (source === "selfwrite" || source === "ai") {
    for (const p of OPINION_PATTERNS) {
      if (p.re.test(text)) {
        warnings.push({
          id: "opinion",
          level: "warn",
          message: `RTI can ask for documents and records, not opinions or reasons. The phrase ${p.hint} may be rejected — rephrase it to ask for the relevant file, record, or noting.`
        });
        break; // one opinion warning is enough
      }
    }
  }

  // 4. Duplicate of the user's OWN past filing.
  for (const r of pastRtis || []) {
    const prior = r.rtiText || r.issue || "";
    if (prior && jaccard(text, prior) >= 0.8) {
      warnings.push({
        id: "duplicate",
        level: "warn",
        message: `This looks very similar to an RTI you already filed${r.ministry ? ` (${r.ministry})` : ""}. File again only if it's genuinely different.`
      });
      break;
    }
  }

  return { warnings, ok: warnings.length === 0 };
}
