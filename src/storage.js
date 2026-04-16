const fs = require('fs');
const path = require('path');
const config = require('../config');

const filePath = path.resolve(__dirname, '..', config.storage.filePath);

// ─── Ensure data directory and file exist ───────────────────────────────────

function ensureFile() {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify([], null, 2));
}

// ─── Load all stored jobs ────────────────────────────────────────────────────

function loadJobs() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return [];
  }
}

// ─── Save jobs to file ───────────────────────────────────────────────────────

function saveJobs(jobs) {
  ensureFile();
  fs.writeFileSync(filePath, JSON.stringify(jobs, null, 2));
}

// ─── Filter out jobs older than maxAgeDays ───────────────────────────────────

function pruneOldJobs(jobs) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - config.storage.maxAgeDays);
  return jobs.filter(j => new Date(j.scrapedAt) > cutoff);
}

// ─── Merge new jobs, return only the genuinely new ones ─────────────────────

function mergeAndGetNew(freshJobs) {
  const stored = loadJobs();
  const storedIds = new Set(stored.map(j => j.id));

  const newJobs = freshJobs.filter(j => !storedIds.has(j.id));

  const merged = pruneOldJobs([...stored, ...newJobs]);
  saveJobs(merged);

  console.log(`[storage] New jobs: ${newJobs.length} | Total stored: ${merged.length}`);
  return newJobs;
}

// ─── Stats ───────────────────────────────────────────────────────────────────

function getStats() {
  const jobs = loadJobs();
  const byLocation = {};
  const byKeyword = {};

  for (const job of jobs) {
    byLocation[job.searchLocation] = (byLocation[job.searchLocation] || 0) + 1;
    byKeyword[job.searchKeyword] = (byKeyword[job.searchKeyword] || 0) + 1;
  }

  return { total: jobs.length, byLocation, byKeyword };
}

// ─── Push jobs to the local tracker web app ─────────────────────────────────

async function pushToTracker(jobs) {
  const baseUrl = process.env.TRACKER_URL;
  if (!baseUrl || jobs.length === 0) return;

  try {
    const res = await fetch(`${baseUrl}/api/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobs),
    });
    const data = await res.json();
    console.log(`[tracker] Push complete → inserted: ${data.inserted}, skipped: ${data.skipped}${data.errors?.length ? `, errors: ${data.errors.length}` : ''}`);
  } catch (err) {
    console.warn(`[tracker] Push failed (tracker may not be running): ${err.message}`);
  }
}

// ─── Fetch live scraper config from tracker ──────────────────────────────────

async function fetchRemoteConfig() {
  const baseUrl = process.env.TRACKER_URL;
  if (!baseUrl) return null;

  try {
    const res = await fetch(`${baseUrl}/api/scraper-config`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data.keywords) && Array.isArray(data.locations)) {
      return {
        keywords: data.keywords,
        locations: data.locations,
        excludedCompanies: Array.isArray(data.excludedCompanies) ? data.excludedCompanies : [],
      };
    }
  } catch {
    // tracker offline or unreachable — fall back to local config
  }
  return null;
}

module.exports = { mergeAndGetNew, loadJobs, getStats, pushToTracker, fetchRemoteConfig };
