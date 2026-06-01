// xp-engine.js
// All Civic XP, level, streak and badge logic. Runs entirely on local data
// in chrome.storage.local. No server required. Server sync (when logged in)
// simply mirrors this same state.

import { TRACKS, inferTrack } from "./ministry-map.js";

// XP awarded per event. Tuned so that filing is the dominant signal but
// follow-through (appeals, marking responses) is rewarded more heavily,
// because follow-through is where real accountability happens.
export const XP_EVENTS = {
  DRAFT_GENERATED: 15,
  RTI_FILED: 50,
  REFILL_PERSISTENCE: 15,      // re-filled after a portal failure
  STATE_PRECISION: 20,         // heeded a state-level warning and re-routed correctly
  MINISTRY_CORRECT: 10,        // AI identified ministry, user kept it
  RESPONSE_RECEIVED: 30,       // user marked a reply as received
  FIRST_APPEAL: 75,
  CIC_APPEAL: 100,
  STREAK_WEEK: 25,             // maintained a 7-day streak
  NEW_TRACK_EXPLORER: 40       // first RTI in a track not used before
};

// Level thresholds (cumulative XP). Names escalate in civic seriousness.
export const LEVELS = [
  { level: 1, name: "Curious Citizen", min: 0 },
  { level: 2, name: "Informed Voter", min: 100 },
  { level: 3, name: "Persistent Requester", min: 300 },
  { level: 4, name: "Accountability Enforcer", min: 600 },
  { level: 5, name: "RTI Veteran", min: 1000 },
  { level: 6, name: "Civic Sentinel", min: 1600 },
  { level: 7, name: "Dharmachakra", min: 2500 }
];

export function levelForXp(totalXp) {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (totalXp >= l.min) current = l;
  }
  const next = LEVELS.find((l) => l.min > totalXp) || null;
  const xpIntoLevel = totalXp - current.min;
  const xpForNext = next ? next.min - current.min : 0;
  return {
    level: current.level,
    name: current.name,
    next: next ? next.name : null,
    nextAt: next ? next.min : null,
    xpIntoLevel,
    xpForNext,
    progress: next ? Math.min(1, xpIntoLevel / xpForNext) : 1,
    toNext: next ? next.min - totalXp : 0
  };
}

// Compute a day-streak from an array of ISO filing timestamps.
// A streak is the number of consecutive calendar days (ending today or
// yesterday) on which at least one civic action was recorded.
export function computeStreak(timestamps) {
  if (!timestamps || timestamps.length === 0) return 0;
  const days = new Set(
    timestamps.map((t) => {
      const d = new Date(t);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );
  let streak = 0;
  const cursor = new Date();
  // allow the streak to count if today has no action yet but yesterday did
  const todayKey = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
  if (!days.has(todayKey)) cursor.setDate(cursor.getDate() - 1);
  while (true) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
    if (days.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// Given the full list of filed RTIs, compute per-track counts and which
// badges are currently earned.
export function computeTracks(rtis) {
  const counts = {};
  for (const key of Object.keys(TRACKS)) counts[key] = 0;
  for (const rti of rtis) {
    const track = rti.track || inferTrack(rti.ministry);
    counts[track] = (counts[track] || 0) + 1;
  }
  const result = [];
  for (const key of Object.keys(TRACKS)) {
    const def = TRACKS[key];
    const count = counts[key] || 0;
    if (count === 0) continue;
    const earned = def.badges.filter((b) => count >= b.threshold);
    const nextBadge = def.badges.find((b) => count < b.threshold) || null;
    result.push({
      id: key,
      name: def.name,
      icon: def.icon,
      color: def.color,
      count,
      earnedBadges: earned,
      latestBadge: earned.length ? earned[earned.length - 1] : null,
      nextBadge,
      toNext: nextBadge ? nextBadge.threshold - count : 0
    });
  }
  result.sort((a, b) => b.count - a.count);
  return result;
}

// Default empty progress object — stored in chrome.storage.local under "progress".
export function emptyProgress() {
  return {
    totalXp: 0,
    rtis: [],            // { id, ministry, track, issue, charCount, status, filedAt, ref, refilledCount }
    events: [],          // { type, xp, at, meta }
    seenCards: [],       // ids of DYK cards already shown
    tracksUsed: [],      // track ids the user has filed in (for explorer bonus)
    lastSync: null,
    account: null        // { email, displayName } when logged in; null otherwise
  };
}

// Award XP for an event and return the mutated progress object.
// Caller is responsible for persisting.
export function awardXp(progress, type, meta = {}) {
  const xp = XP_EVENTS[type] || 0;
  progress.totalXp += xp;
  progress.events.push({ type, xp, at: new Date().toISOString(), meta });
  return { progress, xp };
}

// Record a freshly filed RTI and award the appropriate XP, including the
// explorer bonus the first time a track is used.
export function recordFiling(progress, rti) {
  const track = rti.track || inferTrack(rti.ministry);
  rti.track = track;
  rti.filedAt = rti.filedAt || new Date().toISOString();
  rti.status = rti.status || "pending";
  progress.rtis.unshift(rti);

  awardXp(progress, "RTI_FILED", { ministry: rti.ministry, track });

  if (!progress.tracksUsed.includes(track)) {
    progress.tracksUsed.push(track);
    awardXp(progress, "NEW_TRACK_EXPLORER", { track });
  }
  return progress;
}

// Anchored-to-truth filing (registration number is the proof). A filing is added
// to history WITHOUT XP until a real portal registration number is captured.
// `addAwaitingRti` records the filing as evidence-pending; `confirmReference`
// captures the number and *then* awards the deferred XP + explorer bonus.
export function addAwaitingRti(progress, rti) {
  const track = rti.track || inferTrack(rti.ministry);
  rti.track = track;
  rti.filedAt = rti.filedAt || new Date().toISOString();
  rti.status = "awaiting_ref";
  rti.ref = rti.ref || "";
  rti.xpAwarded = false;
  progress.rtis.unshift(rti);
  return progress;
}

// Capture the registration number → award the deferred XP exactly once.
// Returns { awarded, newBadges } so the postgame can celebrate what changed.
export function confirmReference(progress, id, ref) {
  const rti = progress.rtis.find((r) => r.id === id);
  if (!rti) return { awarded: 0, newBadges: [] };
  rti.ref = String(ref || "").trim();
  if (rti.status === "awaiting_ref") rti.status = "pending";
  if (rti.xpAwarded) return { awarded: 0, newBadges: [] };

  const before = progress.totalXp;
  const badgesBefore = badgeIds(progress.rtis);
  awardXp(progress, "RTI_FILED", { ministry: rti.ministry, track: rti.track });
  if (!progress.tracksUsed.includes(rti.track)) {
    progress.tracksUsed.push(rti.track);
    awardXp(progress, "NEW_TRACK_EXPLORER", { track: rti.track });
  }
  rti.xpAwarded = true;
  const badgesAfter = badgeIds(progress.rtis);
  const newBadges = badgesAfter.filter((b) => !badgesBefore.includes(b.key));
  return { awarded: progress.totalXp - before, newBadges };
}

// Flatten currently-earned badges to {key,name,track} for diffing.
function badgeIds(rtis) {
  const out = [];
  for (const trk of computeTracks(rtis)) {
    for (const b of trk.earnedBadges) out.push({ key: `${trk.id}:${b.id}`, name: b.name, track: trk.id });
  }
  return out;
}

export function buildSummary(progress) {
  const filedTimestamps = progress.rtis
    .filter((r) => r.filedAt)
    .map((r) => r.filedAt);
  return {
    totalXp: progress.totalXp,
    level: levelForXp(progress.totalXp),
    streak: computeStreak([...filedTimestamps, ...progress.events.map((e) => e.at)]),
    tracks: computeTracks(progress.rtis),
    rtiCount: progress.rtis.length,
    repliesIn: progress.rtis.filter((r) => r.status === "received").length,
    appealsFiled: progress.rtis.filter((r) => r.status === "appeal").length,
    loggedIn: !!progress.account
  };
}
