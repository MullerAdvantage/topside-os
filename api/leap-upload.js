import { kv } from '@vercel/kv';
import { buildBundle } from '../lib/leapProcess.js';

// Body shape: { masterList: "<csv text>", stageEntered?: "...", appointments?: "...", workOrder?: "..." }
// masterList is the only required field — it's the primary source for all three dashboards.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { masterList, stageEntered, appointments, jobSchedules, workOrder } = req.body || {};

  if (!masterList) {
    return res.status(400).json({
      error: 'Missing masterList in request body. This must be the CSV text of the Leap "Master List Report" export.',
    });
  }

  let bundle;
  try {
    bundle = buildBundle({ masterList, stageEntered, appointments, jobSchedules, workOrder });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  await kv.set('leap:bundle', bundle);
  await kv.set('leap:updated_at', bundle.meta.generatedAt);

  res.status(200).json({
    success: true,
    totalJobs: bundle.totalJobs,
    totalActive: bundle.totalActive,
    sourcesUsed: bundle.meta.sources,
    updated_at: bundle.meta.generatedAt,
  });
}
