# Leap export inbox

Drop the daily Leap CRM exports here (fixed filenames, overwritten each time —
do not add timestamped copies, that would bloat repo history with customer PII):

| File | Required | Report |
|---|---|---|
| `master-list.csv` | **Yes** | Leap "Master List Report" |
| `stage-entered.csv` | No | Leap "Master List Stage Entered Report" |
| `appointments.xlsx` (or `.csv`) | No | Leap "Appointments Report" |
| `job-schedules.xlsx` (or `.csv`) | No | Leap "Job Schedules Report" — preferred crew source |
| `work-order.xlsx` (or `.csv`) | No | Leap "Work Order Report" — fallback crew source |

Any push touching this folder triggers `.github/workflows/leap-sync.yml`,
which reads these files, converts XLSX to CSV as needed, and POSTs the
result to the live dashboard API (`/api/leap-upload`) so all three
dashboards refresh automatically. No manual dashboard step needed once
files land here.

This repo is private specifically so this folder can safely hold live
customer data (names, addresses, job pricing) between syncs.
