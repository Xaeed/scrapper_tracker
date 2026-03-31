require('dotenv').config();
const { startScheduler, runAgent } = require('./src/scheduler');
const { getStats } = require('./src/storage');

const args = process.argv.slice(2);

if (args.includes('--run-now')) {
  // Immediate single run (useful for testing or manual trigger)
  runAgent('Manual run').then(() => process.exit(0));

} else if (args.includes('--test')) {
  // Quick test: scrape just 1 keyword × 1 location
  const { chromium } = require('playwright');
  const config = require('./config');

  (async () => {
    console.log('[test] Running a quick single-search test...');
    const { scrapeAllJobs } = require('./src/scraper');

    // Temporarily narrow scope for test
    config.jobKeywords = ['DevOps Engineer Contract'];
    config.locations = ['Germany'];

    const jobs = await scrapeAllJobs();
    console.log('\n[test] Sample jobs found:');
    jobs.slice(0, 5).forEach(j => {
      console.log(`  • ${j.title} @ ${j.company} — ${j.location}`);
      console.log(`    ${j.link}`);
    });

    const stats = getStats();
    console.log('\n[test] Storage stats:', stats);
    process.exit(0);
  })();

} else if (args.includes('--stats')) {
  // Print storage statistics
  const stats = getStats();
  console.log('\n[stats] Job database statistics:');
  console.log(`  Total jobs stored: ${stats.total}`);
  console.log('\n  By location:');
  Object.entries(stats.byLocation).forEach(([k, v]) => console.log(`    ${k}: ${v}`));
  console.log('\n  By keyword:');
  Object.entries(stats.byKeyword).forEach(([k, v]) => console.log(`    ${k}: ${v}`));

} else {
  // Default: start daemon with cron scheduler
  startScheduler();
}
