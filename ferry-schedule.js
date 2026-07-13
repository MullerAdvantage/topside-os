// /api/ferry-schedule.js
//
// Server-side proxy for the Washington State Ferries (WSF) Schedule API.
// Keeps WSDOT_ACCESS_CODE out of the browser — same pattern as /api/claude.js.
//
// REQUIRED Vercel env var: WSDOT_ACCESS_CODE
//   (Settings → Environment Variables → add WSDOT_ACCESS_CODE = <your code>)
//
// Usage from the client:
//   GET /api/ferry-schedule?action=terminals
//   GET /api/ferry-schedule?action=sailings&departingTerminalId=X&arrivingTerminalId=Y&date=YYYY-MM-DD
//
// "terminals" returns the full WSF terminal list — use this ONCE to look up the
// numeric terminal IDs for Anacortes, Friday Harbor, Orcas Island, Lopez Island,
// and Shaw Island. Terminal IDs are NOT hardcoded anywhere in this integration
// because guessing them wrong would silently point bookings at the wrong route —
// look them up live and drop the confirmed IDs into wsdot-schedule.js once you have them.

const WSF_BASE = 'https://www.wsdot.wa.gov/ferries/api/schedule/rest';

module.exports = async function handler(req, res) {
  const accessCode = process.env.WSDOT_ACCESS_CODE;

  if (!accessCode) {
    return res.status(500).json({
      error: 'WSDOT_ACCESS_CODE is not set in this environment. Add it in Vercel → Settings → Environment Variables, then redeploy.'
    });
  }

  const { action, departingTerminalId, arrivingTerminalId, date } = req.query;

  try {
    let url;

    if (action === 'terminals') {
      // Full terminal list — use this to find the correct IDs for the San Juan route.
      url = `${WSF_BASE}/terminals?apiaccesscode=${accessCode}`;
    } else if (action === 'sailings') {
      if (!departingTerminalId || !arrivingTerminalId) {
        return res.status(400).json({ error: 'departingTerminalId and arrivingTerminalId are required for action=sailings' });
      }
      const tripDate = date || new Date().toISOString().slice(0, 10);
      // scheduletoday gives remaining sailings for the given terminal pair on a given date
      url = `${WSF_BASE}/scheduletoday/${departingTerminalId}/${arrivingTerminalId}/false?apiaccesscode=${accessCode}&tripdate=${tripDate}`;
    } else {
      return res.status(400).json({ error: 'Unknown or missing action. Use action=terminals or action=sailings.' });
    }

    const wsfRes = await fetch(url);
    if (!wsfRes.ok) {
      const text = await wsfRes.text();
      return res.status(wsfRes.status).json({ error: 'WSF API error', status: wsfRes.status, detail: text });
    }

    const data = await wsfRes.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate'); // sailing times don't need to be hit on every keystroke
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Ferry schedule proxy failed', detail: String(err) });
  }
};
