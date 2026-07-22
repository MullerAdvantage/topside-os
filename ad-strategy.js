// /api/ad-strategy.js
// Server-side proxy: receives a performance summary, calls the Anthropic API
// with the ANTHROPIC_API_KEY env var (never exposed to the browser), and
// returns the ad-strategy suggestions as JSON.

const SYSTEM_PROMPT = `You are an advertising and campaign strategist for Topside Construction Inc. (dba Topside Roofing, Siding & Gutters), a roofing and exterior contractor serving Whatcom, Skagit, Island, and San Juan counties in Washington State. GAF Master Elite, 35+ years in business, Complete Exterior bundle, video estimates. Primary competitors: Mt. Baker Roofing, Axiom Roofing, SRS Roofing, Roofscapes NW.

You'll be given a performance summary (ad spend, leads, close rates, campaign or geographic breakdowns, whatever is on hand). Your job:
1. Identify the specific weak areas the summary actually shows evidence for — don't invent problems it doesn't support.
2. For each weak area, give 2-3 concrete, specific campaign or ad-strategy moves to address it (channel, targeting, offer, creative angle, budget shift — be specific, not generic advice).
3. If the summary is too thin to support a real diagnosis in some area, say so plainly rather than guessing.
4. Close with a short prioritized action list (top 3 things to do first).

Keep it direct and practical — this is going straight to the business owner, not a client-facing document.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { summary } = req.body || {};

  if (!summary || typeof summary !== 'string' || !summary.trim()) {
    return res.status(400).json({ error: 'Missing performance summary text.' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY is not set on this Vercel project. Add it in Project Settings → Environment Variables, then redeploy.'
    });
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: `Here is the performance summary:\n\n${summary.trim()}` }
        ]
      })
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      return res.status(anthropicRes.status).json({ error: `Anthropic API error: ${errBody}` });
    }

    const data = await anthropicRes.json();
    const text = (data.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n\n');

    return res.status(200).json({ result: text });
  } catch (err) {
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
}
