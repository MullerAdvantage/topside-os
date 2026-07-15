#!/usr/bin/env node
// Reads Leap export files from data/leap-exports/, converts any XLSX to CSV,
// and POSTs the bundle to the live Vercel API. Runs inside GitHub Actions,
// which has normal internet access (unlike the sandbox this was authored in).
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

const DATA_DIR = path.join(process.cwd(), 'data', 'leap-exports');
const API_URL = process.env.LEAP_API_URL || 'https://topside-roofing.vercel.app/api/leap-upload';

const SLOT_PATTERNS = [
  { key: 'stageEntered', test: n => /stage[-_ ]?entered/i.test(n) },
  { key: 'masterList',   test: n => /master[-_ ]?list/i.test(n) },
  { key: 'jobSchedules', test: n => /job[-_ ]?schedules|schedule/i.test(n) && !/appointment/i.test(n) },
  { key: 'appointments', test: n => /appointment/i.test(n) },
  { key: 'workOrder',    test: n => /work[-_ ]?order/i.test(n) },
];

function detectSlot(filename) {
  for (const { key, test } of SLOT_PATTERNS) {
    if (test(filename)) return key;
  }
  return null;
}

function fileToCsvText(filepath) {
  if (/\.csv$/i.test(filepath)) {
    return fs.readFileSync(filepath, 'utf-8');
  }
  const buf = fs.readFileSync(filepath);
  const wb = XLSX.read(buf, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_csv(sheet);
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) {
    console.log(`No ${DATA_DIR} directory found — nothing to sync.`);
    return;
  }

  const files = fs.readdirSync(DATA_DIR).filter(f => /\.(csv|xlsx|xls)$/i.test(f));
  if (!files.length) {
    console.log('No export files found in data/leap-exports/ — nothing to sync.');
    return;
  }

  const payload = {};
  const matchedFiles = {};
  for (const f of files) {
    const slot = detectSlot(f);
    if (!slot) {
      console.log(`Skipping unrecognized file: ${f}`);
      continue;
    }
    const full = path.join(DATA_DIR, f);
    payload[slot] = fileToCsvText(full);
    matchedFiles[slot] = f;
  }

  if (!payload.masterList) {
    console.error('No Master List Report found among the export files. Aborting — this is required.');
    process.exit(1);
  }

  console.log('Matched files:', matchedFiles);
  console.log(`Posting to ${API_URL} ...`);
  console.log('Payload sizes (chars):', Object.fromEntries(Object.entries(payload).map(([k,v]) => [k, v.length])));

  let resp;
  try {
    resp = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('Network error calling the API:', err.message);
    process.exit(1);
  }

  const contentType = resp.headers.get('content-type') || '';
  const rawText = await resp.text();
  console.log('Response status:', resp.status, resp.statusText);
  console.log('Response content-type:', contentType);

  if (!contentType.includes('application/json')) {
    console.error('Response was not JSON. Raw body (first 2000 chars):');
    console.error(rawText.slice(0, 2000));
    process.exit(1);
  }

  let json;
  try {
    json = JSON.parse(rawText);
  } catch (err) {
    console.error('Failed to parse JSON response:', err.message);
    console.error('Raw body (first 2000 chars):', rawText.slice(0, 2000));
    process.exit(1);
  }

  if (!resp.ok) {
    console.error('Upload failed:', json);
    process.exit(1);
  }

  console.log('Upload succeeded:', json);
}

main().catch(err => {
  console.error('Sync script error:', err);
  process.exit(1);
});
