// validators.js
// Pure validation for the applicant details that feed the portal fill payload.
// Used by the app's details screen AND as the hard gate on the popup's
// "Fill the portal form now" button — invalid details must never reach the portal.

// Pragmatic email check (not RFC-perfect; rejects the common typos that kill the
// 30-day reply: missing @, missing domain, trailing dot, spaces).
export function isEmail(s) {
  const v = String(s || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

// Indian mobile: 10 digits starting 6–9, optionally +91 / 0 prefix. Mobile is
// OPTIONAL on the portal, so empty is valid; only a NON-empty bad number fails.
export function isMobile(s) {
  const v = String(s || "").replace(/[\s-]/g, "");
  if (v === "") return true;
  return /^(?:\+?91|0)?[6-9]\d{9}$/.test(v);
}

export function isNonEmpty(s) {
  return String(s || "").trim().length > 0;
}

// validateDetails(details) → { ok, errors: { field: message } }
//   details: { name, address, email, emailConfirm?, mobile }
// emailConfirm is checked only when provided (the app collects it; the stored
// details object may not carry it, in which case the match check is skipped).
export function validateDetails(d = {}) {
  const errors = {};
  if (!isNonEmpty(d.name)) errors.name = "Enter your full name (as on your ID).";
  if (!isNonEmpty(d.address)) errors.address = "Enter your complete postal address.";
  if (!isEmail(d.email)) errors.email = "Enter a valid email — this is where the reply comes.";
  if (d.emailConfirm != null && d.emailConfirm !== "" && d.emailConfirm !== d.email) {
    errors.emailConfirm = "The two emails don't match.";
  }
  if (!isMobile(d.mobile)) errors.mobile = "Enter a valid 10-digit mobile, or leave it blank.";
  return { ok: Object.keys(errors).length === 0, errors };
}
