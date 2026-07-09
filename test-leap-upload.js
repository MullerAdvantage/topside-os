import { readFileSync } from 'fs';

const BASE_URL = 'https://topside-roofing.vercel.app';
const csvPath = process.argv[2];

if (!csvPath) {
  console.error('Usage: node test-leap-upload.js "path/to/file.csv"');
  process.exit(1);
}

async function main() {
  const csvText = readFileSync(csvPath, 'utf-8');
  console.log(`Read ${csvText.split('\n').length} lines from ${csvPath}`);

  console.log('\n--- POSTing to /api/leap-upload ---');
  const uploadRes = await fetch(`${BASE_URL}/api/leap-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csvText }),
  });

  const uploadJson = await uploadRes.json();
  console.log(`Status: ${uploadRes.status}`);
  console.log(uploadJson);

  if (!uploadRes.ok) {
    console.error('\nUpload failed. Stopping before verification.');
    process.exit(1);
  }

  console.log('\n--- Verifying via GET /api/leap-data ---');
  const dataRes = await fetch(`${BASE_URL}/api/leap-data`);
  const dataJson = await dataRes.json();

  console.log(`Status: ${dataRes.status}`);
  console.log(`Rows stored: ${dataJson.data?.length ?? 'unknown'}`);
  console.log(`Updated at: ${dataJson.updated_at}`);
  console.log('\nFirst 3 rows:');
  console.log(JSON.stringify(dataJson.data?.slice(0, 3), null, 2));
}

main().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});