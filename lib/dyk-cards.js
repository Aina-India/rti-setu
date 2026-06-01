// dyk-cards.js
// A curated, verified pool of "Did You Know" cards shown during portal load.
// NO generation — these are hand-written and citeable. Selection logic lives
// in popup.js: filter by current track, exclude already-seen, bias by
// experience level (basics for new filers, advanced for veterans).
//
// Fields:
//   id        unique string
//   text      the fact (kept under ~30 words)
//   source    attribution
//   track     associated track id, or "ALL" for universal facts
//   tier      "basic" | "advanced"  (basic for new users, advanced for veterans)

export const DYK_CARDS = [
  // ---- Universal basics ----
  { id: "u1", text: "Government departments must reply to an RTI within 30 days by law — or 48 hours if it concerns life and liberty.", source: "RTI Act 2005, Section 7", track: "ALL", tier: "basic" },
  { id: "u2", text: "You cannot be asked why you want the information. The reason for your request is legally irrelevant.", source: "RTI Act 2005, Section 6(2)", track: "ALL", tier: "basic" },
  { id: "u3", text: "BPL cardholders file RTIs for free — there is no ₹10 application fee for them.", source: "RTI Rules 2012", track: "ALL", tier: "basic" },
  { id: "u4", text: "The RTI Act generated tens of millions of applications in its first decade — among the most-used transparency laws anywhere.", source: "Central Information Commission reports", track: "ALL", tier: "basic" },
  { id: "u5", text: "If a public officer delays your reply without reason, they can be personally fined ₹250 per day — from their own salary.", source: "RTI Act 2005, Section 20", track: "ALL", tier: "advanced" },
  { id: "u6", text: "You can file an RTI about a previous RTI — asking why it was not answered on time.", source: "Common appeal practice", track: "ALL", tier: "advanced" },
  { id: "u7", text: "If no reply arrives in 30 days, you can file a first appeal for free with the department's appellate authority.", source: "RTI Act 2005, Section 19(1)", track: "ALL", tier: "advanced" },
  { id: "u8", text: "If the first appeal also fails, the second appeal goes to the Central Information Commission — which can order disclosure.", source: "RTI Act 2005, Section 19(3)", track: "ALL", tier: "advanced" },
  { id: "u9", text: "The Act exempts national security and cabinet papers — but explicitly includes contracts, tenders, clearances and exam records.", source: "RTI Act 2005, Sections 8 & 4", track: "ALL", tier: "advanced" },
  { id: "u10", text: "Section 4 requires departments to proactively publish much of their information — even before anyone asks.", source: "RTI Act 2005, Section 4", track: "ALL", tier: "advanced" },

  // ---- Environment ----
  { id: "e1", text: "Environmental clearance documents and their conditions are fully disclosable under RTI — they are not exempt.", source: "MoEFCC / CIC rulings", track: "ENVIRONMENT", tier: "basic" },
  { id: "e2", text: "EIA reports, public hearing minutes and compliance reports for a project can all be requested from the MoEFCC.", source: "EIA Notification 2006", track: "ENVIRONMENT", tier: "basic" },
  { id: "e3", text: "Forest clearance files under the Forest Conservation Act are obtainable via RTI, including the conditions imposed.", source: "Forest (Conservation) Act 1980", track: "ENVIRONMENT", tier: "advanced" },
  { id: "e4", text: "Water consumption approvals and groundwater extraction permits for industrial projects are public records.", source: "Central Ground Water Authority", track: "ENVIRONMENT", tier: "advanced" },
  { id: "e5", text: "If a project's clearance came from the state SEIAA rather than the central ministry, file with the state — not rtionline.", source: "EIA Notification 2006", track: "ENVIRONMENT", tier: "advanced" },

  // ---- Finance ----
  { id: "f1", text: "Loan write-off figures for public sector banks are aggregate-disclosable, even when individual borrower names are protected.", source: "RBI / CIC rulings", track: "FINANCE", tier: "basic" },
  { id: "f2", text: "Tender documents and contract award details of central PSUs are obtainable through RTI.", source: "CVC guidelines", track: "FINANCE", tier: "basic" },
  { id: "f3", text: "The RBI was held by the Supreme Court to be covered by RTI — it cannot refuse disclosure citing fiduciary relationship.", source: "RBI v. Jayantilal Mistry, 2015", track: "FINANCE", tier: "advanced" },
  { id: "f4", text: "MCA filings of companies are partly public; specific records can be sought via RTI where the registry is incomplete.", source: "Companies Act 2013", track: "FINANCE", tier: "advanced" },

  // ---- Education ----
  { id: "ed1", text: "Your own evaluated answer sheets in public exams are disclosable under RTI — a landmark right for students.", source: "CBSE v. Aditya Bandopadhyay, 2011", track: "EDUCATION", tier: "basic" },
  { id: "ed2", text: "Exam-conducting bodies must disclose marking schemes and moderation policies on request.", source: "CIC rulings", track: "EDUCATION", tier: "basic" },
  { id: "ed3", text: "Records of recruitment delays and result-processing timelines can be sought from central exam agencies.", source: "NTA / UPSC", track: "EDUCATION", tier: "advanced" },

  // ---- Electoral ----
  { id: "el1", text: "Candidate affidavits filed with the Election Commission are public — including assets, liabilities and criminal cases.", source: "ECI / Supreme Court directions", track: "ELECTORAL", tier: "basic" },
  { id: "el2", text: "The Supreme Court struck down the electoral bonds scheme in 2024 and ordered disclosure of donor data.", source: "ADR v. Union of India, 2024", track: "ELECTORAL", tier: "advanced" },

  // ---- Civil liberties ----
  { id: "l1", text: "Internet shutdown orders must be published and are reviewable — secret shutdowns were held unconstitutional.", source: "Anuradha Bhasin v. Union of India, 2020", track: "LIBERTIES", tier: "basic" },
  { id: "l2", text: "Section 69A blocking orders are, in principle, disclosable to the originator of the blocked content.", source: "Shreya Singhal v. Union of India, 2015", track: "LIBERTIES", tier: "advanced" },

  // ---- Judicial ----
  { id: "j1", text: "The office of the Chief Justice of India was held to be a public authority under RTI.", source: "CPIO Supreme Court v. Subhash Agarwal, 2019", track: "JUDICIAL", tier: "advanced" },
  { id: "j2", text: "Undertrial detention data and case-pendency statistics are obtainable from court administration via RTI.", source: "National Judicial Data Grid", track: "JUDICIAL", tier: "basic" },

  // ---- Local governance ----
  { id: "g1", text: "Ward-level budget allocations and utilisation are public records — though local bodies use state RTI portals, not rtionline.", source: "Municipal transparency norms", track: "GOVERNANCE", tier: "basic" },
  { id: "g2", text: "Mid-day meal fund utilisation, road project tenders and school grants are all obtainable via RTI.", source: "CIC rulings", track: "GOVERNANCE", tier: "advanced" }
];

// Selection algorithm: prefer current-track cards, then universal; exclude
// seen; bias tier by experience (filings count); fall back gracefully.
export function selectCard(allCards, { track, seenIds, filings }) {
  const isVeteran = (filings || 0) >= 5;
  const preferredTier = isVeteran ? "advanced" : "basic";
  const seen = new Set(seenIds || []);

  const pools = [
    // 1. unseen, current track, preferred tier
    allCards.filter((c) => c.track === track && c.tier === preferredTier && !seen.has(c.id)),
    // 2. unseen, current track, any tier
    allCards.filter((c) => c.track === track && !seen.has(c.id)),
    // 3. unseen, universal, preferred tier
    allCards.filter((c) => c.track === "ALL" && c.tier === preferredTier && !seen.has(c.id)),
    // 4. unseen, universal, any tier
    allCards.filter((c) => c.track === "ALL" && !seen.has(c.id)),
    // 5. any unseen
    allCards.filter((c) => !seen.has(c.id)),
    // 6. everything (reset — they've seen them all)
    allCards
  ];

  for (const pool of pools) {
    if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
  }
  return allCards[0];
}
