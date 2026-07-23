# TOPSIDE INTELLIGENCE PLATFORM — COMPLETE BUILD SCRIPT

Copy this entire file into Claude Code while the Topside Intelligence Platform repository is open.

## ROLE

Act as the lead software architect, business-intelligence engineer, UX designer, and full-stack developer for the Topside Intelligence Platform.

Do not create decorative mockups or empty dashboard shells. Build functional modules with data contracts, validation, KPI formulas, alerts, historical comparison, findings, recommendations, action tracking, report generation, loading states, empty states, error handling, tests, and documentation.

Never invent company data. When information is unavailable, display `Data Not Connected` or `Data Not Provided`, explain what source is required, and do not silently convert missing values to zero.

Preserve the existing dark visual theme and all working functionality. Inspect the repository before editing and adapt to its actual framework, routing, state management, and component structure.

## REQUIRED PRIMARY NAVIGATION

1. Executive Intelligence
2. Marketing Intelligence
3. Sales Intelligence
4. Project Intelligence
5. Financial Intelligence
6. Brand Intelligence
7. Company Intelligence
8. Reports
9. Tools
10. Administration

## SHARED REQUIREMENTS FOR ALL SEVEN INTELLIGENCE CENTERS

Every intelligence center must include:

- Page title and clear purpose
- Reporting-period selector
- Last-refresh timestamp
- Data-confidence indicator
- Source-status panel
- KPI summary cards
- Trend comparison
- Filters
- Findings
- Alerts and exceptions
- Risks
- Opportunities
- Recommendations
- Action register
- Historical comparison
- Report-generation control
- Data limitations
- Loading state
- Empty state
- Error state
- Responsive layout
- Accessible labels

Use these status values:

- Healthy
- Watch
- At Risk
- Critical
- Data Incomplete
- Not Connected

Use these recommendation priorities:

- Critical
- High
- Medium
- Low

Use these action statuses:

- Not Started
- In Progress
- Blocked
- Under Review
- Complete

Every important finding must record:

- Source
- Reporting period
- Metric
- Comparison or threshold
- Business meaning
- Recommended action
- Assigned owner
- Due date
- Confidence level

---

# 1. EXECUTIVE INTELLIGENCE

## Route

`/executive-intelligence`

## Purpose

Create the ownership-facing command center. It must summarize approved information from Marketing, Sales, Project, Financial, Brand, and Company Intelligence without duplicating the detailed department dashboards.

## Required KPI cards

- Overall Company Health Score
- Marketing Health Score
- Sales Health Score
- Project Health Score
- Financial Health Score
- Brand Health Score
- Qualified Leads
- Sold Revenue
- Active Project Value
- Projects at Risk
- Outstanding Receivables
- Marketing ROI
- Open Critical Actions

## Required sections

### Executive Snapshot

Show:

- Three strongest results
- Three largest risks
- Three decisions required
- Three highest-priority actions
- Current data-confidence rating

### Department Scorecards

For every intelligence center show:

- Current grade or score
- Prior-period grade or score
- Trend
- Primary finding
- Primary risk
- Primary recommendation
- Drill-down link

### Critical Alerts

Trigger alerts for:

- Material revenue decline
- Qualified-lead decline
- Cost per qualified lead above target
- Sales close rate below target
- Projects stalled beyond stage threshold
- Negative or low projected margin
- Large overdue receivable
- Brand reputation decline
- Missing critical source data
- Overdue critical action

### Decisions Register

Fields:

- Decision
- Evidence
- Available options
- Recommended option
- Decision owner
- Required date
- Status

### Reports

Generate:

- Weekly Executive Brief
- Monthly Business Report
- Quarterly Strategic Report
- Annual Performance Report

## Rules

- Use only validated department metrics.
- Show the source dashboard for every metric.
- Do not average department grades unless a documented weighting model exists.
- Make category weights configurable.
- Show when a score is limited by missing data.

---

# 2. MARKETING INTELLIGENCE

## Route

`/marketing-intelligence`

## Purpose

Create the Marketing Manager's primary working dashboard for lead generation, advertising accountability, SEO, local visibility, website conversion, content, reviews, competitors, vendors, and attribution.

## Required sources

- Google Ads
- Local Services Ads
- Google Analytics
- Google Search Console
- Google Business Profile
- Meta Ads
- Facebook
- Instagram
- Website forms
- Call tracking
- Marketing360 reports
- Review platforms
- Manual campaign records

## KPI cards

- Marketing Spend
- Leads
- Qualified Leads
- Appointments
- Cost per Lead
- Cost per Qualified Lead
- Marketing-Sourced Sold Revenue
- ROAS
- Marketing ROI
- Organic Conversions
- GBP Calls
- New Reviews
- Average Rating
- Website Conversion Rate

## Funnel

`Impressions → Clicks/Engagements → Leads → Qualified Leads → Appointments → Estimates → Sold Jobs → Attributed Revenue`

## Calculations

- CPL = Spend / Leads
- CPQL = Spend / Qualified Leads
- Appointment Rate = Appointments / Qualified Leads
- Estimate Rate = Completed Estimates / Appointments
- Marketing Close Rate = Sold Jobs / Marketing-Sourced Completed Estimates
- ROAS = Attributed Revenue / Advertising Spend
- Marketing ROI = (Attributed Gross Profit - Marketing Cost) / Marketing Cost
- Website Conversion Rate = Website Conversions / Website Sessions
- Review Growth = Current Review Count - Prior Review Count

Return `Unavailable` when required inputs are missing or zero.

## Required sections

- Marketing Overview
- Lead Funnel
- Paid Advertising
- SEO and Local Search
- Google Business Profile
- Website and Conversion
- Content
- Social Media
- Reviews and Reputation
- Competitor Intelligence
- Vendor Reconciliation
- Lead Attribution
- Recommendations
- Reports

## Vendor reconciliation

Compare:

- Vendor-reported leads
- Source-platform conversions
- CRM leads
- Qualified leads
- Appointments
- Sold jobs

Flag unexplained differences.

## Alerts

- Budget pacing too fast
- CPQL above target
- Spend with no qualified leads
- Tracking mismatch
- Declining organic conversions
- Ranking loss
- Review-response backlog
- Missing attribution
- Duplicate leads
- Vendor/source discrepancy

## Reports

- Marketing Intelligence Report
- Advertising Performance Report
- SEO and Local Visibility Report
- Vendor Accountability Report
- Campaign Report

---

# 3. SALES INTELLIGENCE

## Route

`/sales-intelligence`

## Purpose

Track how incoming demand becomes contacted leads, appointments, estimates, sold jobs, and revenue.

## Required sources

- LEAP CRM
- Lead log
- Call records
- Appointment records
- Estimate records
- Sold jobs
- Lost jobs
- Estimator assignments
- Follow-up records
- Lead-source attribution

## KPI cards

- New Leads
- Qualified Leads
- Contact Rate
- Appointment Rate
- Estimates Completed
- Estimate Completion Rate
- Jobs Sold
- Close Rate
- Average Sold Value
- Sold Revenue
- Average Sales Cycle
- Unfollowed Leads

## Funnel

`Lead → Qualified → Contacted → Appointment → Estimate Completed → Sold or Lost`

## Calculations

- Contact Rate = Contacted Leads / Qualified Leads
- Appointment Rate = Appointments / Contacted Qualified Leads
- Estimate Completion Rate = Completed Estimates / Appointments
- Close Rate = Sold Jobs / Completed Estimates
- Average Sold Value = Sold Revenue / Sold Jobs
- Lead-to-Sale Rate = Sold Jobs / Qualified Leads
- Follow-Up Compliance = Leads Followed Up Within Standard / Leads Requiring Follow-Up
- Average Sales Cycle = Average(Sold Date - Lead Date)

## Required sections

- Sales Overview
- Funnel
- Estimator Performance
- Lead-Source Performance
- County Performance
- Service-Line Performance
- Lost-Reason Analysis
- Follow-Up Gaps
- Capacity and Scheduling Risks
- Recommendations
- Reports

## Estimator table

Show:

- Assigned leads
- Contacted leads
- Appointments
- Estimates
- Sold jobs
- Close rate
- Sold revenue
- Average sale
- Follow-up compliance
- Cancellation rate
- Lost reasons

Do not rank estimators without a minimum sample-size rule.

## Alerts

- Lead not contacted within standard
- Appointment not confirmed
- Estimate not completed
- No follow-up after estimate
- Close rate below target
- Large-value opportunity aging
- High unknown-lost-reason rate
- Estimator capacity imbalance
- Missing attribution

## Reports

- Sales Intelligence Report
- Estimator Performance Report
- Lost Opportunity Report
- Lead Source Quality Report

---

# 4. PROJECT INTELLIGENCE

## Route

`/project-intelligence`

## Purpose

Create the project, production, workflow, scheduling, financial-exposure, and risk center using weekly LEAP exports and authorized project data.

## Required sources

- LEAP project export
- Project ID
- Stage
- Stage-entered date
- Planned start
- Actual start
- Planned completion
- Forecast or actual completion
- Estimated revenue
- Materials
- Labor
- Subcontractors
- Permits/licenses
- Equipment
- Payments received
- Balance due
- Project owner
- Crew
- Risk notes

## KPI cards

- Active Projects
- Pipeline Value
- Projects Started
- Projects Completed
- Projects at Risk
- Delayed Projects
- Average Days in Stage
- Estimated Gross Margin
- Outstanding Project Balances
- Missing-Data Projects

## Configurable pipeline stages

- Lead
- Estimate
- Sold
- Pre-Production
- Scheduled
- In Production
- Quality Review
- Completed
- Invoiced
- Paid
- Warranty

## Calculations

- Days in Stage = Current Date - Stage Entered Date
- Schedule Variance = Forecast Completion - Planned Completion
- Estimated Direct Cost = Materials + Labor + Subcontractors + Permits + Equipment + Other Direct Cost
- Estimated Gross Profit = Estimated Revenue - Estimated Direct Cost
- Estimated Gross Margin = Estimated Gross Profit / Estimated Revenue
- Balance Due = Contract or Estimated Revenue - Payments Received
- At-Risk Rate = At-Risk Projects / Active Projects
- Pipeline Value = Sum of Estimated Revenue for Included Stages

## Required views

- Pipeline
- Stage Aging
- Schedule
- Production
- Project Financials
- Risk Register
- Bottlenecks
- Data Quality
- County and Service Distribution

## Alerts

- Stage age above threshold
- Missing planned dates
- Forecast completion after planned completion
- Negative or low estimated margin
- Missing deposit
- Large balance due
- Permit delay
- Material delay
- Crew constraint
- Customer communication risk
- Missing owner
- Missing next action
- Duplicate project

## Reports

- Project Intelligence Report
- Weekly Pipeline Report
- Delay and Risk Report
- Project Profitability Exception Report
- Data Quality Report

---

# 5. FINANCIAL INTELLIGENCE

## Route

`/financial-intelligence`

## Purpose

Build an internal management center for revenue, expenses, cash flow, marketing efficiency, receivables, budgets, trends, and project profitability.

This is decision support and does not replace licensed accounting, tax, or legal advice.

## Replace the current "Not Built" cards with functional modules

1. Revenue
2. Expenses
3. Cash Flow
4. Marketing ROI
5. Outstanding Receivables
6. Budget Tracking
7. Trend Analysis
8. Project Profitability

## Required sources

- QuickBooks exports
- Revenue summaries
- Direct project costs
- Labor
- Materials
- Subcontractors
- Permits and licenses
- Equipment
- Overhead
- Marketing spend
- Cash inflow
- Cash outflow
- Accounts receivable
- Accounts payable
- Project estimates and payments

## KPI cards

- Revenue
- Gross Profit
- Gross Margin
- Direct Costs
- Overhead
- Marketing Spend
- Net Cash Movement
- Accounts Receivable
- Accounts Payable
- Marketing ROI
- Projects Below Margin Target
- Budget Variance

## Calculations

- Gross Profit = Revenue - Direct Costs
- Gross Margin = Gross Profit / Revenue
- Net Cash Movement = Cash Inflow - Cash Outflow
- Budget Variance = Actual - Budget
- Budget Variance Percent = (Actual - Budget) / Budget
- Marketing ROI = (Attributed Gross Profit - Marketing Cost) / Marketing Cost
- Receivable Age = Current Date - Invoice Due Date
- Estimated Project Margin = (Estimated Revenue - Known Direct Costs) / Estimated Revenue

## Receivable aging buckets

- Current
- 1–30 days
- 31–60 days
- 61–90 days
- More than 90 days

## Alerts

- Negative cash movement
- Revenue below target
- Expense category above budget
- Marketing ROI below threshold
- Large overdue receivable
- Project below margin target
- Missing cost information
- Unreconciled totals
- Unusual period-over-period change

## Reports

- Financial Intelligence Report
- Cash and Receivables Report
- Budget Variance Report
- Marketing Financial Efficiency Report
- Project Profitability Exception Report

---

# 6. BRAND INTELLIGENCE

## Route

`/brand-intelligence`

## Purpose

Monitor brand consistency, market perception, reputation, content alignment, differentiation, and public relations. Franchesca is the primary agent owner.

## Required sources

- Brand guidelines
- Website content
- Social posts
- Advertising creative
- Google Business Profile
- Reviews
- Customer comments
- PR activity
- Competitor messaging
- Photography and design assets
- Approved value propositions
- Mission, vision, and values

## KPI cards

- Brand Consistency Score
- Reputation Score
- Average Review Rating
- Review Response Rate
- Positive Sentiment Rate
- Negative Sentiment Rate
- Content Compliance Rate
- Message Consistency
- County Visibility
- Brand Differentiation Score
- Unresolved Reputation Issues
- Approved Asset Coverage

## Audit dimensions

- Logo use
- Color use
- Typography
- Photography
- Voice and tone
- Service claims
- Geographic claims
- Certifications and awards
- Calls to action
- Customer promise
- Mission and values
- Differentiation

## Brand asset record

Store:

- Channel
- URL or file
- Publish date
- Owner
- Approval status
- Compliance result
- Issues
- Required correction
- Deadline

## Reputation intelligence

Track:

- Review volume
- Average rating
- Rating distribution
- Response time
- Response rate
- Common praise
- Common complaints
- Service-specific sentiment
- County-specific sentiment
- Escalation status

## Alerts

- Unapproved asset
- Incorrect logo or colors
- Generic or copied content
- Unsupported claim
- Review unanswered beyond standard
- Negative review requiring escalation
- Conflicting service-area language
- Inconsistent company naming
- Competitor messaging advantage
- Missing brand evidence

## Reports

- Brand Intelligence Report
- Brand Compliance Audit
- Reputation Report
- Competitor Positioning Report
- Content Consistency Report

---

# 7. COMPANY INTELLIGENCE

## Route

`/company-intelligence`

## Purpose

Create the company-wide health gradebook and historical operating record.

Company Intelligence stores and explains organizational health. Executive Intelligence summarizes the immediate decisions.

## Required features

- Daily Health Entry
- Weekly Gradebook
- Monthly Gradebook
- Quarterly Gradebook
- Annual Gradebook
- Historical Calendar
- Category Trends
- Risk Register
- Recommendation History
- Action Accountability

## Health categories

- Marketing
- Sales
- Projects
- Financial
- Operations
- Brand
- Customer Reputation
- Data Quality
- Technology
- Risk
- Overall Company

## Grade scale

- A: Strong and controlled
- B: Generally healthy
- C: Mixed; corrective work required
- D: Material weakness
- F: Critical condition
- N/A: Insufficient data

## Rules

- Every grade requires evidence.
- Missing data reduces confidence but must not automatically become a failing grade.
- Category weights must be configurable.
- Preserve every published grade historically.
- Corrections must create a new version and audit note.

## Health-entry fields

- Period
- Category
- Grade
- Numerical score where used
- Prior grade
- Trend
- Evidence
- Main risk
- Main opportunity
- Recommendation
- Owner
- Due date
- Status
- Data confidence
- Source reports
- Approval
- Version

## Historical calendar

Allow selection of any date or period and display:

- Overall grade
- Category grades
- Report links
- Decisions
- Actions
- Notes
- Subsequent outcome

## Alerts

- Category falls by one or more grades
- Repeated C or lower grade
- Critical action overdue
- Material risk unresolved
- Low data confidence
- Missing weekly or monthly entry
- Recommendation repeatedly ignored
- Department score conflicts with source report

## Reports

- Company Health Gradebook
- Weekly Company Health Report
- Monthly Health Report
- Quarterly Health Review
- Annual Company Health Report
- Corrective Action Report

---

# CROSS-DASHBOARD DATA FLOW

## Marketing to Sales

Pass:

- Lead ID
- Source
- Campaign
- County
- Service
- Qualified status
- Marketing cost allocation

## Sales to Projects

Pass:

- Sold job
- Contract value
- Project identifier
- Service
- County
- Estimator
- Promised timing

## Projects to Financial

Pass:

- Project revenue
- Known direct costs
- Payments
- Balance due
- Margin estimate
- Cost-related schedule risk

## Brand to Marketing

Pass:

- Approved messaging
- Compliance status
- Reputation risks
- Differentiation guidance

## All intelligence centers to Company Intelligence

Pass:

- Health score
- Evidence
- Risks
- Recommendations
- Action status
- Data confidence

## Company Intelligence to Executive Intelligence

Pass:

- Approved category health
- Largest changes
- Critical risks
- Decisions required
- Overdue actions

---

# REQUIRED TECHNICAL DELIVERABLES

1. Inspect the existing repository and identify its framework.
2. List existing routes and working modules.
3. Create a concise implementation plan before editing.
4. Build or refactor reusable components.
5. Add data types or schemas.
6. Add source adapters.
7. Add validation functions.
8. Add KPI calculation functions.
9. Add alert rules.
10. Add recommendation structures.
11. Add report mappings.
12. Update navigation and routing.
13. Add empty, loading, and error states.
14. Add unit tests for calculations.
15. Run the production build.
16. Fix all build and test errors.
17. Update README and CHANGELOG.
18. Provide a final list of changed files.
19. Identify remaining external data integrations.
20. Do not claim completion if a module is only a placeholder.

# DEFINITION OF DONE

A module is complete only when:

- Its route loads.
- Navigation works.
- Data can be imported or connected.
- Validation errors display correctly.
- KPI calculations work.
- Filters work.
- Alerts work.
- Recommendations display.
- Actions can be tracked.
- Reports can be generated or queued.
- Empty state works.
- Loading state works.
- Error state works.
- Historical comparison works or has a documented implementation boundary.
- Tests pass.
- Production build passes.
- Documentation is updated.

Begin by auditing the existing repository. Do not make destructive changes until you understand what already works.
