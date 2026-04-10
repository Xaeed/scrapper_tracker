require('dotenv').config();

module.exports = {
  // ─── Job Search Keywords ───────────────────────────────────────────────────
  jobKeywords: [
    // ── DevOps / Platform / Cloud / Infra ──────────────────────────────────
    'DevOps Engineer',
    'Platform Engineer',
    'Cloud Infrastructure Engineer',
    'Site Reliability Engineer',
    'AWS DevOps Engineer',
    'Azure DevOps Engineer',
    'GCP Engineer',
    'Kubernetes Engineer',

    // ── Data Engineering ───────────────────────────────────────────────────
    'Data Engineer',
    'Cloud Data Engineer',
    'Data Platform Engineer',

    // ── Backend — .NET / Node.js ───────────────────────────────────────────
    'Backend Engineer Node.js',
    'Backend Engineer .NET',
    '.NET Developer',
    'Node.js Developer',
  ],

  // ─── Target European Countries ─────────────────────────────────────────────
  locations: [
    'Germany',
    'Netherlands',
    'France',
    'Luxembourg',
    'Sweden',
    'Denmark',
    'Norway',
    'Austria',
    'Belgium',
    'Poland',
    'Portugal',
    'United kingdom'
  ],

  // ─── LinkedIn Filter Codes ──────────────────────────────────────────────────
  // f_JT=C      → Contract job type
  // f_WT=2      → Remote
  // f_TPR=r86400 → Posted in last 24 hours
  linkedInFilters: {
    jobType: 'C',            // Contract
    workType: '2',           // Remote
    timeRange: 'r86400',     // Last 24 hours
  },

  // ─── Scrape Schedule (node-cron syntax) ────────────────────────────────────
  // Run at 9:00, 13:00, 17:00
  schedules: [
    '0 9 * * *',   // 9:00 AM
    '0 13 * * *',  // 1:00 PM
    '0 17 * * *',  // 5:00 PM
  ],

  timezone: process.env.TIMEZONE || 'Europe/Berlin',

  // ─── Scraper Behaviour ──────────────────────────────────────────────────────
  scraper: {
    headless: true,          // Set false to watch the browser
    maxJobsPerSearch: 25,    // LinkedIn public limit per query
    delayBetweenSearches: { min: 4000, max: 8000 }, // ms, random human-like delay
    delayBetweenScrolls:  { min: 1500, max: 3000 },
    pageLoadTimeout: 30000,
  },

  // ─── Storage ────────────────────────────────────────────────────────────────
  storage: {
    filePath: './data/jobs.json',
    maxAgeDays: 30,   // Remove jobs older than 30 days from storage
  },

  // ─── Email ──────────────────────────────────────────────────────────────────
  email: {
    enabled: !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
    from: process.env.GMAIL_USER,
    to: process.env.ALERT_EMAIL || process.env.GMAIL_USER,
    gmailUser: process.env.GMAIL_USER,
    gmailAppPassword: process.env.GMAIL_APP_PASSWORD,
  },
};
