const cron = require('node-cron');
const config = require('../config');
const { scrapeAllJobs } = require('./scraper');
const { mergeAndGetNew, pushToTracker, fetchRemoteConfig } = require('./storage');
const { notify } = require('./notifier');
const logger = require('./logger');

// ─── Run Labels for each schedule slot ──────────────────────────────────────

const scheduleLabels = {
  '0 6 * * *':  'Morning run (9:00 AM)',
  '0 12 * * *': 'Afternoon run (1:00 PM)',
  '0 17 * * *': 'Evening run (5:00 PM)',
};

// ─── Single Agent Run ────────────────────────────────────────────────────────

async function runAgent(label = 'Manual run') {
  // Clear log file and record run start
  logger.startLog(label);
  logger.log(`[agent] Starting: ${label}`);

  // Pull latest keywords/locations from tracker (if available), else use local config
  const remoteConfig = await fetchRemoteConfig();
  if (remoteConfig) {
    config.jobKeywords                  = remoteConfig.keywords;
    config.locations                    = remoteConfig.locations;
    config.excludedCompanies            = remoteConfig.excludedCompanies;
    config.linkedInFilters.jobTypes       = remoteConfig.jobTypes;
    config.linkedInFilters.workplaceTypes = remoteConfig.workplaceTypes;
    config.linkedInFilters.timeRange      = remoteConfig.timeRange;
    logger.log(`[agent] Config loaded from tracker: ${remoteConfig.keywords.length} keywords, ${remoteConfig.locations.length} locations, jobTypes=${remoteConfig.jobTypes.join(',')}, workplaceTypes=${remoteConfig.workplaceTypes.join(',')}, timeRange=${remoteConfig.timeRange}`);
  } else {
    logger.log(`[agent] Using local config: ${config.jobKeywords.length} keywords, ${config.locations.length} locations`);
  }

  try {
    // Pass pushToTracker as onBatch — saves each search result to tracker immediately
    const freshJobs = await scrapeAllJobs(pushToTracker);
    logger.log(`[agent] Scrape complete — ${freshJobs.length} jobs found`);

    const newJobs = mergeAndGetNew(freshJobs);
    logger.log(`[agent] New jobs (not seen before): ${newJobs.length}`);

    await notify(newJobs, label);
    logger.log(`[agent] Notification sent`);
    logger.log(`[agent] === RUN SUCCEEDED: ${label} ===`);
  } catch (err) {
    logger.error(`[agent] Run failed: ${err.message}`);
    logger.error(err.stack);
    logger.log(`[agent] === RUN FAILED: ${label} ===`);
  }

  logger.log(`[agent] Finished: ${label}`);
}

// ─── Start Cron Scheduler ────────────────────────────────────────────────────

function startScheduler() {
  console.log('[scheduler] Starting LinkedIn job scraper agent...');
  console.log(`[scheduler] Timezone: ${config.timezone}`);
  console.log(`[scheduler] Log file: ${logger.LOG_FILE}`);
  console.log('[scheduler] Scheduled runs:');

  for (const schedule of config.schedules) {
    const label = scheduleLabels[schedule] || schedule;
    console.log(`  • ${label}  (cron: ${schedule})`);

    cron.schedule(schedule, () => runAgent(label), {
      timezone: config.timezone,
    });
  }

  console.log('\n[scheduler] Agent is running. Waiting for next scheduled run...');
  console.log('[scheduler] Run "node index.js --run-now" to trigger immediately.\n');
}

module.exports = { startScheduler, runAgent };
