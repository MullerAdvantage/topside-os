import { kv } from '@vercel/kv';
import Papa from 'papaparse';

// NOTE: This bundle-building logic used to live in ../lib/leapProcess.js and
// was imported here. It's now inlined directly in this file (kept 1:1
// identical in logic) because Vercel's legacy build config (see vercel.json)
// wasn't reliably tracing/bundling the cross-folder relative import, which
// caused this function to 500 at runtime with no usable error. Self-contained
// avoids that class of bug entirely. lib/leapProcess.js still exists for the
// GitHub Actions sync script's tests, but is not imported by this file.

const CLOSED_STAGES = ['Completed', 'Invoiced', 'Follow Up'];

function parseCsv(text) {
  if (!text) return [];
  const parsed = Papa.parse(text.trim(), { header: true, skipEmptyLines: true });
  return parsed.data;
}

function cleanMoney(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function primaryOf(field) {
  if (!field) return 'Unassigned';
  return String(field).split(',')[0].trim();
}

function primaryTrade(field) {
  if (!field) return 'OTHER';
  return String(field).split(',')[0].trim().toUpperCase();
}

function yymm(jobId) {
  const m = String(jobId || '').match(/^(\d{4})-/);
  return m ? m[1] : null;
}

function stripFilterRow(text) {
  if (!text) return text;
  const firstLine = text.split('\n')[0];
  if (firstLine.startsWith('Filters:') || firstLine.startsWith('"Filters:')) {
    return text.split('\n').slice(1).join('\n');
  }
  return text;
}

function buildBundle(raw, opts = {}) {
  const now = opts.now ? new Date(opts.now) : new Date();

  if (!raw.masterList) {
    throw new Error('masterList CSV is required — this is the primary data source for all three dashboards.');
  }

  const ml = parseCsv(stripFilterRow(raw.masterList));
  if (!ml.length) throw new Error('masterList parsed to 0 rows — check the export format.');

  const addrByJobId = {};
  let appts = [];
  if (raw.appointments) {
    appts = parseCsv(stripFilterRow(raw.appointments));
    appts.forEach(a => {
      if (a['Job Id'] && a['Location']) addrByJobId[a['Job Id']] = a['Location'].trim();
    });
  }

  const stageCounts = {};
  const tradeCounts = {};
  const repJobCounts = {};
  const activeJobs = [];
  let totalJobs = 0;

  ml.forEach(r => {
    const jobId = r['Job Id'];
    if (!jobId) return;
    totalJobs++;

    const stage = r['Stage'] || 'Unknown';
    stageCounts[stage] = (stageCounts[stage] || 0) + 1;

    const trade = primaryTrade(r['Trades']);
    tradeCounts[trade] = (tradeCounts[trade] || 0) + 1;

    const rep = primaryOf(r['Job Rep / Estimator']);
    repJobCounts[rep] = (repJobCounts[rep] || 0) + 1;

    if (!CLOSED_STAGES.includes(stage)) {
      const price = cleanMoney(r['Job Price']);
      activeJobs.push({
        'Customer Name': r['Customer Name'] || '',
        'Job Id': jobId,
        'Trades': r['Trades'] || '',
        'Stage': stage,
        'Job Rep / Estimator': r['Job Rep / Estimator'] || '',
        'Job Price': price && price > 0 ? price : '',
        'Job Address': addrByJobId[jobId] || '',
      });
    }
  });

  const totalActive = activeJobs.length;

  const monthly = {};
  ml.forEach(r => {
    const ym = yymm(r['Job Id']);
    if (ym) monthly[ym] = (monthly[ym] || 0) + 1;
  });
  const monthlySorted = Object.fromEntries(Object.keys(monthly).sort().map(k => [k, monthly[k]]));

  const upcoming = [];
  if (appts.length) {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    appts.forEach(a => {
      const dt = new Date(a['Start Date Time']);
      if (isNaN(dt)) return;
      if (dt >= todayStart) {
        upcoming.push({
          Title: a['Title'] || '',
          'Customer Name': a['Customer Name'] || '',
          'Appointment For': a['Appointment For'] || '',
          'Start Date Time': dt.toLocaleString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          }),
          Location: (a['Location'] || '').trim(),
        });
      }
    });
    upcoming.sort((a, b) => new Date(a['Start Date Time']) - new Date(b['Start Date Time']));
  }

  const crew = [];
  if (raw.jobSchedules) {
    const js = parseCsv(stripFilterRow(raw.jobSchedules));
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    js.forEach(s => {
      const start = new Date(s['Start Date Time']);
      const end = new Date(s['End Date Time']);
      if (isNaN(start) || isNaN(end)) return;
      if (start <= todayStart && end >= todayStart) {
        crew.push({
          'Customer Name': s['Customer Name'] || '',
          'Job Id': s['Job Id'] || '',
          'Work Crew': s['Work Crew'] || '',
          'Start Date Time': start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          'End Date Time': end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          'Job Address': s['Job Address'] || '',
          'Job Rep/Estimator': s['Job Rep/Estimator'] || '',
        });
      }
    });
  } else if (raw.workOrder) {
    const wo = parseCsv(stripFilterRow(raw.workOrder));
    wo.forEach(w => {
      if (!w['Customer Name'] && !w['Job Number']) return;
      crew.push({
        'Customer Name': w['Customer Name'] || '',
        'Job Id': w['Job Number'] || '',
        'Work Crew': w['Trade Type'] || '',
        'Start Date Time': w['Created Date'] || '',
        'End Date Time': w['Updated Date'] || '',
        'Job Address': '',
        'Job Rep/Estimator': '',
      });
    });
  }

  let followUp = { total: stageCounts['Follow Up'] || 0, buckets: null, byRep: null, ageSource: 'unavailable' };
  if (raw.stageEntered) {
    const se = parseCsv(stripFilterRow(raw.stageEntered));
    const repByJobId = {};
    ml.forEach(r => { if (r['Job Id']) repByJobId[r['Job Id']] = r['Job Rep / Estimator']; });

    const fu = se.filter(r => r['Current Stage'] === 'Follow Up');
    const buckets = { '0-30': 0, '31-90': 0, '91-180': 0, '6-12mo': 0, '12mo+': 0 };
    const byRep = {};
    let matchedDates = 0;

    fu.forEach(r => {
      const entered = new Date(r['Stage Entered Date']);
      if (!isNaN(entered)) {
        matchedDates++;
        const days = Math.floor((now - entered) / 86400000);
        if (days <= 30) buckets['0-30']++;
        else if (days <= 90) buckets['31-90']++;
        else if (days <= 180) buckets['91-180']++;
        else if (days <= 365) buckets['6-12mo']++;
        else buckets['12mo+']++;
      }
      const rep = primaryOf(repByJobId[r['Job Id']]);
      byRep[rep] = (byRep[rep] || 0) + 1;
    });

    followUp = {
      total: fu.length,
      buckets,
      byRep,
      ageSource: matchedDates === fu.length ? 'stage_entered_date' : 'partial_stage_entered_date',
      datedRecords: matchedDates,
    };
  }

  const revenueByTradeAll = {};
  const revenueByTradeConfirmed = {};
  const revenueByRepAll = {};
  const revenueByRepConfirmed = {};
  const confirmedJobs = [];
  let pipelineRevenue = 0, pipelinePricedCount = 0;

  ml.forEach(r => {
    const price = cleanMoney(r['Job Price']);
    const trade = primaryTrade(r['Trades']);
    const rep = primaryOf(r['Job Rep / Estimator']);
    const stage = r['Stage'];
    const isConfirmed = stage === 'Completed' || stage === 'Invoiced';

    if (isConfirmed) {
      confirmedJobs.push({
        'Customer Name': r['Customer Name'] || '',
        'Job Id': r['Job Id'],
        'Trades': r['Trades'] || '',
        'Stage': stage,
        'Job Rep / Estimator': r['Job Rep / Estimator'] || '',
        'Job Price': price && price > 0 ? price : '',
      });
    }

    if (price) {
      revenueByTradeAll[trade] = (revenueByTradeAll[trade] || 0) + price;
      revenueByRepAll[rep] = (revenueByRepAll[rep] || 0) + price;
      if (isConfirmed) {
        revenueByTradeConfirmed[trade] = (revenueByTradeConfirmed[trade] || 0) + price;
        revenueByRepConfirmed[rep] = (revenueByRepConfirmed[rep] || 0) + price;
      }
      if (!CLOSED_STAGES.includes(stage)) {
        pipelineRevenue += price;
        pipelinePricedCount++;
      }
    }
  });

  return {
    stageCounts,
    tradeCounts,
    repJobCounts,
    activeJobs,
    upcoming,
    crew,
    monthly: monthlySorted,
    totalJobs,
    totalActive,
    followUp,
    confirmedJobs,
    revenue: {
      byTradeAll: revenueByTradeAll,
      byTradeConfirmed: revenueByTradeConfirmed,
      byRepAll: revenueByRepAll,
      byRepConfirmed: revenueByRepConfirmed,
      pipelineRevenue,
      pipelinePricedCount,
      avgPipelineJobValue: pipelinePricedCount ? pipelineRevenue / pipelinePricedCount : 0,
    },
    meta: {
      generatedAt: now.toISOString(),
      sources: {
        masterList: true,
        stageEntered: !!raw.stageEntered,
        appointments: !!raw.appointments,
        jobSchedules: !!raw.jobSchedules,
        workOrder: !!raw.workOrder,
      },
    },
  };
}

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
