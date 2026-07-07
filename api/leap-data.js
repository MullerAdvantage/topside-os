import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const data = await kv.get('leap:latest');
  const updatedAt = await kv.get('leap:updated_at');
  res.status(200).json({ data: data || [], updated_at: updatedAt });
}
