// ministry-map.js
// Maps central government ministries to civic engagement tracks.
// The track is INFERRED from the ministry — no manual categorisation needed.
// Also holds keyword heuristics that hint at state-level matters (which
// rtionline.gov.in cannot handle, since it covers only central ministries).

export const TRACKS = {
  ENVIRONMENT: {
    id: "ENVIRONMENT",
    name: "Environmental Watchdog",
    icon: "ti-leaf",
    color: "#1D9E75",
    badges: [
      { id: "observer", name: "Observer", threshold: 1 },
      { id: "monitor", name: "Monitor", threshold: 2 },
      { id: "bhumi_rakshak", name: "Bhumi Rakshak", threshold: 3 },
      { id: "eia_tracker", name: "EIA Tracker", threshold: 4 },
      { id: "paryavaran_senani", name: "Paryavaran Senani", threshold: 8 }
    ]
  },
  ELECTORAL: {
    id: "ELECTORAL",
    name: "Electoral Integrity",
    icon: "ti-checkbox",
    color: "#378ADD",
    badges: [
      { id: "voter", name: "Voter", threshold: 1 },
      { id: "poll_watcher", name: "Poll Watcher", threshold: 3 },
      { id: "transparency_advocate", name: "Transparency Advocate", threshold: 5 },
      { id: "lok_nayak", name: "Lok Nayak", threshold: 8 }
    ]
  },
  FINANCE: {
    id: "FINANCE",
    name: "Public Finance",
    icon: "ti-coin",
    color: "#BA7517",
    badges: [
      { id: "taxpayer", name: "Taxpayer", threshold: 1 },
      { id: "auditor", name: "Auditor", threshold: 3 },
      { id: "jan_auditor", name: "Jan Auditor", threshold: 5 },
      { id: "arthik_rakshak", name: "Arthik Rakshak", threshold: 8 }
    ]
  },
  EDUCATION: {
    id: "EDUCATION",
    name: "Education & Examination",
    icon: "ti-school",
    color: "#534AB7",
    badges: [
      { id: "student", name: "Student", threshold: 1 },
      { id: "examiner", name: "Examiner", threshold: 3 },
      { id: "paper_trail", name: "Paper Trail Investigator", threshold: 5 },
      { id: "gyan_rakshak", name: "Gyan Rakshak", threshold: 8 }
    ]
  },
  LIBERTIES: {
    id: "LIBERTIES",
    name: "Press & Civil Liberties",
    icon: "ti-news",
    color: "#D85A30",
    badges: [
      { id: "reader", name: "Reader", threshold: 1 },
      { id: "witness", name: "Witness", threshold: 3 },
      { id: "chronicler", name: "Chronicler", threshold: 5 },
      { id: "satyagrahi", name: "Satyagrahi", threshold: 8 }
    ]
  },
  JUDICIAL: {
    id: "JUDICIAL",
    name: "Judicial Independence",
    icon: "ti-gavel",
    color: "#7F77DD",
    badges: [
      { id: "petitioner", name: "Petitioner", threshold: 1 },
      { id: "court_watcher", name: "Court Watcher", threshold: 3 },
      { id: "nyaya_sevak", name: "Nyaya Sevak", threshold: 5 },
      { id: "samvidhan_rakshak", name: "Samvidhan Rakshak", threshold: 8 }
    ]
  },
  GOVERNANCE: {
    id: "GOVERNANCE",
    name: "Local Governance",
    icon: "ti-building-community",
    color: "#0F6E56",
    badges: [
      { id: "resident", name: "Resident", threshold: 1 },
      { id: "ward_watcher", name: "Ward Watcher", threshold: 3 },
      { id: "gram_sevak", name: "Gram Sevak", threshold: 5 },
      { id: "jan_sewak", name: "Jan Sewak", threshold: 8 }
    ]
  },
  GENERAL: {
    id: "GENERAL",
    name: "General Accountability",
    icon: "ti-file-text",
    color: "#888780",
    badges: [
      { id: "citizen", name: "Curious Citizen", threshold: 1 },
      { id: "informed", name: "Informed Citizen", threshold: 3 },
      { id: "persistent", name: "Persistent Requester", threshold: 5 },
      { id: "rti_veteran", name: "RTI Veteran", threshold: 10 }
    ]
  }
};

// Substring matchers against the (lowercased) official ministry name returned
// by the AI. First match wins. Order matters — more specific terms first.
export const MINISTRY_TO_TRACK = [
  { match: ["environment", "forest", "climate", "moefcc", "pollution", "wildlife"], track: "ENVIRONMENT" },
  { match: ["jal shakti", "water resources", "ganga", "groundwater"], track: "ENVIRONMENT" },
  { match: ["election commission", "eci", "electoral"], track: "ELECTORAL" },
  { match: ["finance", "revenue", "expenditure", "economic affairs", "rbi", "reserve bank", "sebi", "corporate affairs", "banking"], track: "FINANCE" },
  { match: ["education", "school", "higher education", "nta", "ugc", "skill development"], track: "EDUCATION" },
  { match: ["information and broadcasting", "i&b", "press", "meity", "electronics and information"], track: "LIBERTIES" },
  { match: ["law and justice", "justice", "judicial", "supreme court", "high court"], track: "JUDICIAL" },
  { match: ["panchayat", "rural development", "urban affairs", "housing and urban"], track: "GOVERNANCE" },
  { match: ["home affairs", "mha"], track: "LIBERTIES" }
];

// Keywords that strongly suggest a STATE-level matter. rtionline.gov.in
// only covers central ministries, so these should trigger a warning.
// This is a secondary client-side check that supplements the AI's is_state flag.
export const STATE_LEVEL_HINTS = [
  "bbmp", "bmc", "municipal corporation", "municipality", "nagar nigam",
  "nagar palika", "gram panchayat", "panchayat", "zilla parishad",
  "ward", "state government", "state police", "local police station",
  "district collector", "tehsildar", "patwari", "seiaa", "state pollution control board",
  "spcb", "state electricity board", "discom", "rto", "regional transport",
  "state public service commission", "ration card", "pds shop", "fair price shop",
  "land records", "bhoomi", "encumbrance certificate", "khata", "property tax"
];

export function inferTrack(ministryName) {
  if (!ministryName) return "GENERAL";
  const lower = ministryName.toLowerCase();
  for (const rule of MINISTRY_TO_TRACK) {
    if (rule.match.some((m) => lower.includes(m))) return rule.track;
  }
  return "GENERAL";
}

export function detectStateHints(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  return STATE_LEVEL_HINTS.filter((h) => lower.includes(h));
}
