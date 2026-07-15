import { kv } from '@vercel/kv';

// Returns the full computed dashboard bundle (see lib/leapProcess.js for shape).
// All three dashboards (operations, phil-dashboard, exec-snapshot) fetch from here.
export default async function handler(req, res) {
  const bundle = await kv.get('leap:bundle');
  const updatedAt = await kv.get('leap:updated_at');

  if (!bundle) {
    return res.status(200).json({
      bundle: null,
      updated_at: null,
      message: 'No data uploaded yet. Use /leap-upload.html to upload the morning Leap export.',
    });
  }

  res.status(200).json({ bundle, updated_at: updatedAt });
}
