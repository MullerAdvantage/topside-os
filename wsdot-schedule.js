// wsdot-schedule.js
// Ferry-dependent scheduling logic for Topside Estimator Scheduler.
// Handles: San Juan Island destination detection, sailing-based slot finding,
// 45-min check-in cutoff, and a post-confirmation reservation task tracker.
//
// ── SETUP REQUIRED BEFORE THIS WORKS LIVE ──────────────────────────────────
// 1. WSDOT_ACCESS_CODE must be set in Vercel env vars (see /api/ferry-schedule.js)
// 2. TERMINAL IDS BELOW ARE PLACEHOLDERS. Call:
//      GET /api/ferry-schedule?action=terminals
//    and match the returned TerminalID values to Anacortes, Friday Harbor,
//    Orcas Island, Lopez Island, and Shaw Island. Fill them in below.
//    I have not verified these against a live WSF response — this sandbox's
//    network access is restricted to a fixed domain allowlist and cannot
//    reach wsdot.wa.gov, so these IDs are UNCONFIRMED. Do not trust them
//    until you've checked the terminals endpoint yourself.
// ────────────────────────────────────────────────────────────────────────────

const ANACORTES_TERMINAL_ID = null; // TODO: fill in from /api/ferry-schedule?action=terminals

const FERRY_DESTINATIONS = {
  'Friday Harbor':  { terminalId: null, county: 'San Juan' }, // TODO: fill in terminal ID
  'Orcas Island':   { terminalId: null, county: 'San Juan' }, // TODO: fill in terminal ID
  'Lopez Island':   { terminalId: null, county: 'San Juan' }, // TODO: fill in terminal ID
  'Shaw Island':    { terminalId: null, county: 'San Juan' }, // TODO: fill in terminal ID
};

const CHECK_IN_CUTOFF_MINUTES = 45; // must be checked in at the terminal this many minutes before sailing

function isFerryDependent(city) {
  return Object.prototype.hasOwnProperty.call(FERRY_DESTINATIONS, city);
}

// Fetch remaining sailings for a given destination on a given date via the server-side proxy.
// Returns [] on any failure — never silently invents sailing times.
async function getSailings(destinationCity, isoDate) {
  const dest = FERRY_DESTINATIONS[destinationCity];
  if (!dest) return [];
  if (!ANACORTES_TERMINAL_ID || !dest.terminalId) {
    console.warn(`Ferry terminal IDs not configured yet for ${destinationCity} — see wsdot-schedule.js setup notes.`);
    return [];
  }
  try {
    const url = `/api/ferry-schedule?action=sailings&departingTerminalId=${ANACORTES_TERMINAL_ID}&arrivingTerminalId=${dest.terminalId}&date=${isoDate}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    // WSF's scheduletoday response shape: { TerminalCombos: [{ Times: [{ DepartingTime, ArrivingTime, ... }] }] }
    // Times come back as .NET JSON dates like "/Date(1737000000000-0700)/" — normalize to JS Date.
    const combos = data.TerminalCombos || [];
    const times = combos.flatMap(c => c.Times || []);
    return times.map(t => ({
      departing: parseWsfDate(t.DepartingTime),
      arriving: parseWsfDate(t.ArrivingTime),
    })).filter(t => t.departing);
  } catch (err) {
    console.error('getSailings failed:', err);
    return [];
  }
}

function parseWsfDate(str) {
  if (!str) return null;
  const m = str.match(/\/Date\((\d+)([+-]\d{4})?\)\//);
  if (!m) return null;
  return new Date(Number(m[1]));
}

// Given a destination + date + the estimator's required on-site time, find the earliest
// sailing that gets them there in time, respecting the 45-min check-in cutoff.
// Returns { sailing, checkInBy, arrivalOnIsland } or null if nothing works.
async function findEarliestFerrySlot(destinationCity, isoDate) {
  const sailings = await getSailings(destinationCity, isoDate);
  if (sailings.length === 0) return null;

  const now = new Date();
  const viable = sailings.filter(s => {
    const checkInBy = new Date(s.departing.getTime() - CHECK_IN_CUTOFF_MINUTES * 60000);
    return checkInBy > now; // must still be able to check in
  });

  if (viable.length === 0) return null;

  const next = viable[0];
  return {
    sailing: next,
    checkInBy: new Date(next.departing.getTime() - CHECK_IN_CUTOFF_MINUTES * 60000),
    arrivalOnIsland: next.arriving,
  };
}

// ── RESERVATION TASK TRACKING ──────────────────────────────────────────────
// Once a ferry-dependent appointment is booked, it needs a physical ferry
// reservation made through WSF (separate from the sailing lookup above —
// WSF reservations are their own system). This tracks that follow-up task
// per appointment block.

function createFerryReservationTask(appointmentId, sailing) {
  return {
    appointmentId,
    sailingDeparting: sailing.departing.toISOString(),
    sailingArriving: sailing.arriving.toISOString(),
    status: 'pending', // 'pending' | 'confirmed' | 'not_needed'
    confirmationNumber: null,
    confirmedBy: null,
    confirmedAt: null,
  };
}

function confirmFerryReservation(task, confirmationNumber, confirmedBy) {
  task.status = 'confirmed';
  task.confirmationNumber = confirmationNumber;
  task.confirmedBy = confirmedBy;
  task.confirmedAt = new Date().toISOString();
  return task;
}

// Render a print-ready confirmation sheet for a confirmed reservation.
// Call window.print() after injecting this into a hidden print container.
function renderFerryConfirmationSheet(task, jobTitle, estimatorName) {
  return `
    <div style="font-family:Arial,sans-serif;padding:24px;max-width:500px">
      <h2 style="margin-bottom:4px">Ferry Reservation Confirmation</h2>
      <p style="color:#666;margin-bottom:16px">Topside Construction — Estimator Scheduler</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr><td style="padding:4px 0;font-weight:bold">Job:</td><td>${jobTitle}</td></tr>
        <tr><td style="padding:4px 0;font-weight:bold">Estimator:</td><td>${estimatorName}</td></tr>
        <tr><td style="padding:4px 0;font-weight:bold">Sailing (Depart):</td><td>${new Date(task.sailingDeparting).toLocaleString()}</td></tr>
        <tr><td style="padding:4px 0;font-weight:bold">Sailing (Arrive):</td><td>${new Date(task.sailingArriving).toLocaleString()}</td></tr>
        <tr><td style="padding:4px 0;font-weight:bold">Confirmation #:</td><td>${task.confirmationNumber || '—'}</td></tr>
        <tr><td style="padding:4px 0;font-weight:bold">Confirmed By:</td><td>${task.confirmedBy || '—'}</td></tr>
      </table>
      <p style="margin-top:20px;font-size:11px;color:#999">Check in at least ${CHECK_IN_CUTOFF_MINUTES} minutes before sailing.</p>
    </div>
  `;
}

// Exported for use in estimator_scheduler.html
if (typeof window !== 'undefined') {
  window.FerrySchedule = {
    isFerryDependent,
    getSailings,
    findEarliestFerrySlot,
    createFerryReservationTask,
    confirmFerryReservation,
    renderFerryConfirmationSheet,
    CHECK_IN_CUTOFF_MINUTES,
    FERRY_DESTINATIONS,
  };
}
