// /api/wsdot-schedule.js
//
// Serverless proxy for the WSDOT Traveler Information API — same pattern as
// your existing /api/claude.js proxy for the Anthropic key. Keeps the WSDOT
// Access Code server-side instead of exposed in browser localStorage/JS.
//
// SETUP:
// 1. Add WSDOT_ACCESS_CODE as a Vercel environment variable (same way
//    ANTHROPIC_API_KEY is already set). Get the code from whoever on the
//    team already has WSDOT Traveler API access.
// 2. Deploy this file to /api/wsdot-schedule.js in the topside-os repo.
// 3. The estimator scheduler's loadFerrySchedule() already calls
//    GET /api/wsdot-schedule?route=anacortes-sanjuan — no front-end changes
//    needed once this is deployed.
//
// NOTE ON SCOPE: this only pulls published SAILING SCHEDULES (departure
// times) — it does NOT touch myWSF vehicle reservations. There is no public
// API for checking or booking reservations; that stays a manual step via
// wsdot.wa.gov/ferries/reservations. This proxy only tells the scheduler
// "what time do boats leave," not "do we have a reservation on one."
//
// VERIFY BEFORE RELYING ON THIS: WSDOT's exact endpoint paths/params should
// be checked against their current API docs (https://wsdot.wa.gov/traffic/api/)
// at deploy time — API details can change, and this scaffold reflects the
// general shape of that API rather than a tested-live call.

export default async function handler(req, res) {
  const ACCESS_CODE = process.env.WSDOT_ACCESS_CODE;

  if (!ACCESS_CODE) {
    return res.status(500).json({
      error: 'WSDOT_ACCESS_CODE not set in Vercel environment variables.',
    });
  }

  const route = req.query.route || 'anacortes-sanjuan';

  // WSDOT Ferries API terminal IDs — verify these against current WSDOT docs,
  // they occasionally get renumbered. Anacortes = 1 is the commonly cited ID
  // for the Anacortes/San Juan Islands route as of last check.
  const ROUTE_TERMINALS = {
    'anacortes-sanjuan': { departingTerminalId: 1, arrivingTerminalId: 15 }, // Anacortes -> Friday Harbor leg; San Juans route has multiple stops
  };

  const terminals = ROUTE_TERMINALS[route];
  if (!terminals) {
    return res.status(400).json({ error: `Unknown route: ${route}` });
  }

  const today = new Date().toISOString().slice(0, 10);

  try {
    const url = `https://www.wsdot.wa.gov/ferries/api/schedule/rest/schedule/${today}/${terminals.departingTerminalId}/${terminals.arrivingTerminalId}?apiaccesscode=${ACCESS_CODE}`;

    const wsdotResp = await fetch(url);
    if (!wsdotResp.ok) {
      return res.status(502).json({ error: `WSDOT API returned ${wsdotResp.status}` });
    }
    const raw = await wsdotResp.json();

    // Transform WSDOT's response shape into what the scheduler expects:
    // { schedule: { 0: ['07:15','09:50',...], 1: [...], ... } } with
    // 0=Mon..4=Fri (weekend sailings intentionally dropped — the scheduler
    // only operates Mon-Fri). ADAPT THIS MAPPING once you see WSDOT's real
    // response shape — the exact field names below are a best-guess based
    // on the general structure of their schedule API and need verification.
    const schedule = { 0: [], 1: [], 2: [], 3: [], 4: [] };

    (raw.TerminalCombos || []).forEach(combo => {
      (combo.Times || []).forEach(sailing => {
        const dep = new Date(sailing.DepartingTime);
        const dow = dep.getDay(); // 0=Sun..6=Sat
        if (dow === 0 || dow === 6) return; // weekend, out of scope
        const dayIdx = dow - 1; // Mon=1->0 ... Fri=5->4
        const hh = String(dep.getHours()).padStart(2, '0');
        const mm = String(dep.getMinutes()).padStart(2, '0');
        schedule[dayIdx].push(`${hh}:${mm}`);
      });
    });

    return res.status(200).json({ schedule, source: 'wsdot-live', fetchedAt: new Date().toISOString() });
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach WSDOT API', detail: String(err) });
  }
}
