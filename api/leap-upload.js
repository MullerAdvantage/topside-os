import { kv } from '@vercel/kv';
import Papa from 'papaparse';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { csvText } = req.body;
  if (!csvText) {
    return res.status(400).json({ error: 'Missing csvText in request body' });
  }
  const parsed = Papa.parse(csvText, { header: true });
  await kv.set('leap:latest', JSON.stringify(parsed.data));
  await kv.set('leap:updated_at', new Date().toISOString());
  res.status(200).json({ success: true, rows: parsed.data.length });
}