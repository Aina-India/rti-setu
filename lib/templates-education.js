// templates-education.js
// The Education category template pack. Authored as an ES module (NOT .json) so
// it imports synchronously and reliably across Chrome AND Firefox MV3 — JSON
// import-assertions are not dependable in Firefox, and fetch(getURL()) would force
// an async load path. See lib/templates-index.js.
//
// Schema + placeholder/segment syntax are documented in lib/template-engine.js.
// Notes vs the original brief seed pack:
//   • edu-002 clause 1 was restructured to use [[ optional segment ]] syntax so
//     unanswered OPTIONAL blanks (postName / notificationNumber / notificationDate)
//     cleanly drop their phrase instead of leaving "for the post of , dated ."
//   • edu-001 dropped the unused `examDate` blank (it was collected but never
//     referenced in the body).
// All bodies verified < 3000 chars; all ask for records, not opinions.

export default [
  {
    id: "edu-001",
    category: "education",
    title: "Exam paper leak / irregularity accountability",
    description: "A central exam was leaked or compromised. Get the records: how papers were handled, who printed them, what complaints came in, and what was found.",
    ministryHint: "Ministry of Education",
    isStateLevel: false,
    appealLikely: true,
    appealNote: "Clauses 1, 2 and 4 (SOPs, security communications, chain of custody) may be denied under Section 8(1)(a)/(g); clause 3 (contract value) under 8(1)(d). For a completed exam these are defensible — be ready to file a first appeal citing public interest under Section 8(2).",
    note: "NTA falls under Ministry of Education. Covers NEET-UG, JEE-Main, CUET-UG, UGC-NET.",
    blanks: [
      { id: "examName", label: "Exam name", type: "select", required: true, options: ["NEET-UG", "JEE-Main", "CUET-UG", "UGC-NET", "CSIR-NET", "Other"] },
      { id: "examYear", label: "Year of exam", type: "number", required: true }
    ],
    bodyTemplate: "Under the Right to Information Act, 2005, I request the following information from the Public Information Officer, Ministry of Education / National Testing Agency:\n\n1. Copies of all Standard Operating Procedures (SOPs) followed for the printing, packaging, transportation, and distribution of question papers for {examName} {examYear}.\n\n2. File notings and internal communications between NTA and the contracted printing agency regarding question paper security for {examName} {examYear}.\n\n3. The name(s) and contract value(s) of the printing agency or agencies contracted for {examName} {examYear}.\n\n4. The chain of custody document for question papers from printing to distribution at examination centres for {examName} {examYear}.\n\n5. Number of complaints or representations received by NTA regarding alleged irregularities in {examName} {examYear}, and the action taken report on each complaint.\n\n6. Copies of all reports and findings submitted by any committee constituted to investigate irregularities in {examName} {examYear}.\n\n7. Any communication received from State governments, examination centres, or candidates regarding irregularities in {examName} {examYear}, and the response issued.\n\n8. The compensation or re-examination policy approved for candidates affected by irregularities in {examName} {examYear}, including the file noting approving such policy.\n\nThese records pertain to a completed examination and their disclosure serves the larger public interest in the integrity of public examinations, as contemplated under Section 8(2) of the Right to Information Act, 2005.",
    asks: [
      "How were question papers handled and transported before the exam?",
      "Which company printed the papers, and for how much?",
      "What complaints were received, and what action was taken?",
      "What did any investigation committee find?",
      "What remediation was approved for affected students?"
    ],
    languages: {
      en: { title: "Exam paper leak / irregularity accountability" },
      hi: { title: "परीक्षा प्रश्नपत्र लीक / अनियमितता की जवाबदेही" },
      bn: { title: "পরীক্ষার প্রশ্নফাঁস / অনিয়মের জবাবদিহি" },
      te: { title: "పరీక్ష పేపర్ లీక్ / అవకతవకల జవాబుదారీతనం" },
      mr: { title: "परीक्षा पेपरफुटी / अनियमिततेची उत्तरदायित्व" },
      ta: { title: "தேர்வு வினாத்தாள் கசிவு / முறைகேடு பொறுப்புக்கூறல்" }
    }
  },
  {
    id: "edu-002",
    category: "education",
    title: "Central recruitment result delay",
    description: "A central government recruitment (SSC, UPSC, NTA, RRB) is stuck or delayed. Find out where it stands, why, and when it will finish.",
    ministryHintBy: "organization",
    ministryHintMap: {
      "Staff Selection Commission (SSC)": "Department of Personnel and Training",
      "Union Public Service Commission (UPSC)": "Union Public Service Commission",
      "National Testing Agency (NTA)": "Ministry of Education",
      "Railway Recruitment Board (RRB)": "Ministry of Railways",
      "Other": "__autocomplete__"
    },
    isStateLevel: false,
    note: "Recruitment RTIs go to the conducting body's own CPIO. SSC is under DoPT (not Education); RRB under Railways; UPSC is a constitutional body. For STATE recruitment boards (UPPSC, RPSC, Bihar SSC etc.), use your state's RTI portal instead. IBPS bank exams: RTI applicability is contested — verify before filing.",
    blanks: [
      { id: "organization", label: "Conducting body", type: "select", required: true, options: ["Staff Selection Commission (SSC)", "Union Public Service Commission (UPSC)", "National Testing Agency (NTA)", "Railway Recruitment Board (RRB)", "Other"] },
      { id: "recruitmentName", label: "Recruitment / exam name", type: "text", required: true },
      { id: "postName", label: "Post applied for", type: "text", required: false },
      { id: "notificationNumber", label: "Notification / advertisement number", type: "text", required: false },
      { id: "notificationDate", label: "Date of original notification", type: "date", required: false }
    ],
    bodyTemplate: "Under the Right to Information Act, 2005, I request the following information from the Public Information Officer, {organization}:\n\n1. The current stage of the recruitment process for {recruitmentName}[[ for the post of {postName}]][[, advertised vide Notification No. {notificationNumber}]][[ dated {notificationDate}]].\n\n2. File notings and recorded reasons for any delay in publication of results beyond the originally scheduled date.\n\n3. The revised timeline for completion of the full recruitment process, with the documentary basis for that timeline.\n\n4. Total number of vacancies advertised, number of candidates who appeared in each stage, and current stage of evaluation.\n\n5. Whether any court orders or stay orders have been received affecting this recruitment; if so, copies of such orders.\n\n6. Copies of all communications between the recruitment body and the administrative ministry regarding delays in this recruitment.\n\n7. Whether a vigilance inquiry or investigation is pending in connection with this recruitment, and the current status of such inquiry.",
    asks: [
      "Where is the recruitment process currently?",
      "Why has it been delayed — what is the official recorded reason?",
      "What is the revised completion timeline?",
      "Are there any court cases or stays affecting it?",
      "Is there a vigilance inquiry underway?"
    ],
    languages: {
      en: { title: "Central recruitment result delay" },
      hi: { title: "केंद्रीय भर्ती परिणाम में देरी" },
      bn: { title: "কেন্দ্রীয় নিয়োগ ফল প্রকাশে বিলম্ব" },
      te: { title: "కేంద్ర నియామక ఫలితాల్లో జాప్యం" },
      mr: { title: "केंद्रीय भरती निकालास विलंब" },
      ta: { title: "மத்திய ஆட்சேர்ப்பு முடிவு தாமதம்" }
    }
  },
  {
    id: "edu-003",
    category: "education",
    title: "Central scholarship not disbursed",
    description: "A central scholarship hasn't reached students. Find out whether the money was released to the state and why it's stuck.",
    ministryHintBy: "scholarshipName",
    ministryHintMap: {
      "Post-Matric Scholarship for SC Students": "Ministry of Social Justice and Empowerment",
      "Post-Matric Scholarship for ST Students": "Ministry of Tribal Affairs",
      "Post-Matric Scholarship for Minority Students": "Ministry of Minority Affairs",
      "Central Sector Scholarship (Merit-cum-Means)": "Ministry of Education",
      "National Fellowship for SC Students": "Ministry of Social Justice and Empowerment",
      "Rajiv Gandhi National Fellowship for ST Students": "Ministry of Tribal Affairs",
      "Other": "__autocomplete__"
    },
    isStateLevel: false,
    note: "Central scholarships are held by different ministries depending on the scheme (SC→Social Justice, ST→Tribal Affairs, Minority→Minority Affairs, Merit-cum-Means→Education). This targets the ministry holding central funds. Student-level disbursal delays are often a STATE matter — use your state's RTI portal for those.",
    blanks: [
      { id: "scholarshipName", label: "Scholarship scheme", type: "select", required: true, options: ["Post-Matric Scholarship for SC Students", "Post-Matric Scholarship for ST Students", "Post-Matric Scholarship for Minority Students", "Central Sector Scholarship (Merit-cum-Means)", "National Fellowship for SC Students", "Rajiv Gandhi National Fellowship for ST Students", "Other"] },
      { id: "stateName", label: "State where your institution is located", type: "text", required: true },
      { id: "academicYear", label: "Academic year", type: "text", required: true }
    ],
    bodyTemplate: "Under the Right to Information Act, 2005, I request the following information from the Public Information Officer, {_authority}:\n\n1. Total funds released to the State Government of {stateName} under {scholarshipName} for academic year {academicYear}, with the dates of each release.\n\n2. The utilization certificate received from {stateName} for {scholarshipName} for the previous academic year(s); if not received, what action has been taken and when.\n\n3. Number of applications received, approved, and disbursed under {scholarshipName} for academic year {academicYear} in {stateName}.\n\n4. Average number of days taken for disbursement from the date of application approval to actual credit to student accounts under {scholarshipName} for {academicYear}.\n\n5. Whether any complaints have been received regarding non-disbursement or delayed disbursement of {scholarshipName} in {stateName}; if so, the number of complaints and action taken.\n\n6. The grievance redressal mechanism available to students who have been approved but have not received {scholarshipName}, and the contact details of the officer responsible.",
    asks: [
      "Were funds actually released to the state, and when?",
      "Did the state submit utilisation proof for previous years?",
      "How many students got the scholarship vs how many applied?",
      "How long does disbursement typically take?",
      "How can an affected student raise a complaint?"
    ],
    languages: {
      en: { title: "Central scholarship not disbursed" },
      hi: { title: "केंद्रीय छात्रवृत्ति का भुगतान नहीं हुआ" },
      bn: { title: "কেন্দ্রীয় বৃত্তি বিতরণ হয়নি" },
      te: { title: "కేంద్ర స్కాలర్‌షిప్ చెల్లించలేదు" },
      mr: { title: "केंद्रीय शिष्यवृत्ती वितरित झाली नाही" },
      ta: { title: "மத்திய உதவித்தொகை வழங்கப்படவில்லை" }
    }
  },
  {
    id: "edu-004",
    category: "education",
    title: "PM POSHAN (mid-day meal) fund usage",
    description: "Check how mid-day meal (PM POSHAN) money was released to your state and whether it was actually spent as intended.",
    ministryHint: "Ministry of Education",
    isStateLevel: false,
    note: "PM POSHAN is a Centrally Sponsored Scheme under Ministry of Education (Dept of School Education and Literacy). RTI to the centre gives allocation and utilisation-certificate data. School-level records (menus, attendance, suppliers) are a STATE matter — use your state's portal addressed to the District Education Officer.",
    blanks: [
      { id: "stateName", label: "State name", type: "text", required: true },
      { id: "districtName", label: "District name (if known)", type: "text", required: false },
      { id: "financialYear", label: "Financial year (e.g. 2024-25)", type: "text", required: true }
    ],
    bodyTemplate: "Under the Right to Information Act, 2005, I request the following information from the Public Information Officer, Ministry of Education, Department of School Education and Literacy:\n\n1. Total funds released under PM POSHAN scheme to the State Government of {stateName} for financial year {financialYear}, district-wise if available, with dates of each release.\n\n2. The utilization certificate received from {stateName} for PM POSHAN funds for financial year {financialYear}; if not received, the action taken and the current status.\n\n3. The approved per-child per-day cooking cost, and the number of schools and children covered under PM POSHAN in {stateName} for {financialYear}.\n\n4. Any inspection report or quality audit conducted for PM POSHAN implementation in {stateName} during {financialYear}, and the findings.\n\n5. Number of complaints received from {stateName} regarding implementation irregularities under PM POSHAN for {financialYear}, and the action taken on each.[[\n\n6. Information specific to {districtName} district, including funds released and utilisation reported, where separately maintained.]]",
    asks: [
      "Were funds actually released to the state, and how much?",
      "Did the state submit proof of how the money was used?",
      "How many children and schools were supposed to be covered?",
      "Were there any inspections, and what did they find?",
      "Were there complaints, and what was done about them?"
    ],
    languages: {
      en: { title: "PM POSHAN (mid-day meal) fund usage" },
      hi: { title: "पीएम पोषण (मध्याह्न भोजन) निधि उपयोग" },
      bn: { title: "পিএম পোষণ (মিড-ডে মিল) তহবিল ব্যবহার" },
      te: { title: "పీఎం పోషణ్ (మధ్యాహ్న భోజన) నిధుల వినియోగం" },
      mr: { title: "पीएम पोषण (माध्यान्ह भोजन) निधी वापर" },
      ta: { title: "பிஎம் போஷண் (மதிய உணவு) நிதி பயன்பாடு" }
    }
  },
  {
    id: "edu-005",
    category: "education",
    title: "College / university UGC grant utilisation",
    description: "See how a UGC or RUSA grant to a college or university was sanctioned, spent, and accounted for.",
    ministryHintBy: "schemeName",
    ministryHintMap: {
      "RUSA (Rashtriya Uchchatar Shiksha Abhiyan)": "Ministry of Education",
      "UGC Development Grants": "University Grants Commission",
      "College with Potential for Excellence": "University Grants Commission",
      "Autonomous College Grant": "University Grants Commission",
      "NAAC Accreditation Linked Grant": "University Grants Commission",
      "Other": "__autocomplete__"
    },
    isStateLevel: false,
    note: "Most UGC schemes go to the UGC's own CPIO. EXCEPTION: RUSA is administered by the Ministry of Education (Dept of Higher Education), not UGC. For affiliated state universities, implementation-level data is a state matter; the centre gives sanction + utilisation-certificate data.",
    blanks: [
      { id: "institutionName", label: "Name of college / university", type: "text", required: true },
      { id: "schemeName", label: "Grant scheme", type: "select", required: true, options: ["RUSA (Rashtriya Uchchatar Shiksha Abhiyan)", "UGC Development Grants", "College with Potential for Excellence", "Autonomous College Grant", "NAAC Accreditation Linked Grant", "Other"] },
      { id: "sanctionedYear", label: "Year grant was sanctioned", type: "number", required: true }
    ],
    bodyTemplate: "Under the Right to Information Act, 2005, I request the following information from the Public Information Officer, {_authority}:\n\n1. Total grants sanctioned to {institutionName} under {schemeName} from {sanctionedYear} to date, with copies of sanction letters.\n\n2. Utilization certificates received from {institutionName} for all grants released under {schemeName}, year-wise.\n\n3. Where utilization certificates are pending, the reasons recorded and the action taken.\n\n4. Any inspection or audit report of {institutionName} conducted in the last five years.\n\n5. Whether any complaint or irregularity report has been received from or about {institutionName} regarding grant utilisation under {schemeName}, and the action taken.\n\n6. The current accreditation status of {institutionName} with NAAC or NBA, and whether any conditions were attached to grant disbursement based on accreditation.",
    asks: [
      "How much was sanctioned to this institution and when?",
      "Did the institution submit proof of how it was spent?",
      "Were there any inspections or audits?",
      "Were there complaints about misuse?",
      "What is the current accreditation status?"
    ],
    languages: {
      en: { title: "College / university UGC grant utilisation" },
      hi: { title: "कॉलेज / विश्वविद्यालय UGC अनुदान उपयोग" },
      bn: { title: "কলেজ / বিশ্ববিদ্যালয় UGC অনুদান ব্যবহার" },
      te: { title: "కళాశాల / విశ్వవిద్యాలయ UGC గ్రాంట్ వినియోగం" },
      mr: { title: "महाविद्यालय / विद्यापीठ UGC अनुदान वापर" },
      ta: { title: "கல்லூரி / பல்கலைக்கழக UGC மானியப் பயன்பாடு" }
    }
  },
  {
    id: "edu-006",
    category: "education",
    title: "NTA examination process and safety records",
    description: "Get records on how the NTA runs its exams in general — audits, grievance numbers, how centres are chosen, how papers are stored and destroyed.",
    ministryHint: "Ministry of Education",
    isStateLevel: false,
    note: "Systemic accountability — use when you want records about HOW NTA runs exams generally, not a specific leak (use edu-001 for that). Good for third-party audits, grievance statistics, centre empanelment.",
    blanks: [
      { id: "examName", label: "Exam name", type: "select", required: true, options: ["NEET-UG", "JEE-Main", "CUET-UG", "UGC-NET", "CSIR-NET", "All NTA exams"] },
      { id: "examYear", label: "Year", type: "number", required: true }
    ],
    bodyTemplate: "Under the Right to Information Act, 2005, I request the following information from the Public Information Officer, National Testing Agency / Ministry of Education:\n\n1. The organisational chart and staffing structure of NTA as of {examYear}, including names and designations of officers responsible for {examName}.\n\n2. The third-party audit or independent assessment report on NTA's examination processes for {examYear}, if any.\n\n3. Grievance redressal statistics for {examName} {examYear}: total grievances received, resolved within stipulated time, and pending as on date.\n\n4. The criteria and process for empanelment of examination centres for {examName} {examYear}, and the total number of centres empanelled across states.\n\n5. Whether any show-cause notice or punitive action was taken against any examination centre for {examName} {examYear}; if so, the names of centres and outcomes.\n\n6. The policy for retention, secure storage, and disposal of used answer sheets and question paper remnants after {examName} {examYear}, and the actual disposal record.",
    asks: [
      "Who in NTA was responsible for this exam?",
      "Was there an independent audit of the exam process?",
      "How many grievances were filed and resolved?",
      "How are exam centres selected and monitored?",
      "Were any centres penalised?",
      "How were answer sheets and leftover papers disposed of?"
    ],
    languages: {
      en: { title: "NTA examination process and safety records" },
      hi: { title: "NTA परीक्षा प्रक्रिया और सुरक्षा रिकॉर्ड" },
      bn: { title: "NTA পরীক্ষা প্রক্রিয়া ও নিরাপত্তা নথি" },
      te: { title: "NTA పరీక్ష ప్రక్రియ మరియు భద్రతా రికార్డులు" },
      mr: { title: "NTA परीक्षा प्रक्रिया आणि सुरक्षा नोंदी" },
      ta: { title: "NTA தேர்வு செயல்முறை மற்றும் பாதுகாப்பு பதிவுகள்" }
    }
  }
];
