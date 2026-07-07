# Topside Digital Marketing & Diagnostics Agency Tool Configuration

version: "1.0"

# Global System Diagnostics Interface (SDI) Settings
sdi_dashboard:
  enabled: true
  refresh_interval_seconds: 30
  storage_silos:
    - system_audits_table
    - marketing_audits_table
    - company_audits_table

# API Health Check endpoints and parameters
api_connections:
  meta_ads:
    endpoint: "https://facebook.com"
    timeout_seconds: 10
  openai:
    endpoint: "https://openai.com"
    timeout_seconds: 15
  stripe:
    endpoint: "https://stripe.com"
    timeout_seconds: 10
  google_ads:
    endpoint: "https://googleapis.com"
    timeout_seconds: 15
  leap_software:
    endpoint: "https://leaptofortune.com"
    timeout_seconds: 12

# Guardrails to prevent infinite loops and runaway costs
token_burn_protection:
  max_tokens_per_minute: 50000
  max_cost_per_hour_usd: 10.00
  action_on_breach: "KILL_PROCESS_AND_ALERT"

# Automated Problem Solving & Log Requirements
auto_remediation:
  enabled: true
  retry_attempts: 3
  required_log_fields:
    - timestamp
    - date
    - failure_description
    - resolution_applied
    - preventative_patch_logic
