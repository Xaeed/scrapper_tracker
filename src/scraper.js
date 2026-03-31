const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());
const config = require('../config');

// ─── Helpers ────────────────────────────────────────────────────────────────

function randomDelay(range) {
  return new Promise(resolve =>
    setTimeout(resolve, Math.floor(Math.random() * (range.max - range.min)) + range.min)
  );
}

function buildSearchUrl(keyword, location) {
  const { jobType, workType, timeRange } = config.linkedInFilters;
  const params = new URLSearchParams({
    keywords: keyword,
    location: location,
    f_JT: jobType,
    f_WT: workType,
    f_TPR: timeRange,
    position: '1',
    pageNum: '0',
  });
  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

// ─── Browser Setup ──────────────────────────────────────────────────────────

async function createBrowser() {
  const browser = await chromium.launch({
    headless: config.scraper.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1366,768',
    ],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    locale: 'en-US',
    timezoneId: config.timezone,
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  // Remove webdriver flag
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
  });

  return { browser, context };
}

// ─── Accept Cookie Banner (first page only) ─────────────────────────────────

let cookiesAccepted = false;

async function acceptCookiesIfNeeded(page) {
  if (cookiesAccepted) return;
  try {
    const acceptBtn = page.locator('button:has-text("Accept")').first();
    await acceptBtn.waitFor({ timeout: 5000 });
    await acceptBtn.click();
    await page.waitForTimeout(1500);
    cookiesAccepted = true;
  } catch (_) {
    // No cookie banner found — that's fine
  }
}

// ─── Parse Jobs from Page ───────────────────────────────────────────────────

async function parseJobsFromPage(page, keyword, location) {
  return await page.evaluate(({ kw, loc }) => {
    const jobs = [];
    const cards = document.querySelectorAll('.job-search-card');

    cards.forEach(card => {
      try {
        const titleEl   = card.querySelector('.base-search-card__title');
        const companyEl = card.querySelector('.base-search-card__subtitle');
        const locationEl = card.querySelector('.job-search-card__location');
        const linkEl    = card.querySelector('a.base-card__full-link') || card.querySelector('a');
        const dateEl    = card.querySelector('time');

        const title      = titleEl?.textContent?.trim() || '';
        const company    = companyEl?.textContent?.trim() || '';
        const jobLocation = locationEl?.textContent?.trim() || loc;
        const link       = linkEl?.href || '';
        const postedAt   = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || '';

        // LinkedIn job IDs are 10-digit numbers at the end of the slug
        const idMatch = link.match(/-(\d{8,})(?:[?#]|$)/);
        const jobId = idMatch ? idMatch[1] : null;

        if (title && jobId) {
          // Clean link — strip tracking params
          jobs.push({
            id: jobId,
            title,
            company,
            location: jobLocation,
            link: `https://www.linkedin.com/jobs/view/${jobId}`,
            postedAt,
            searchKeyword: kw,
            searchLocation: loc,
            scrapedAt: new Date().toISOString(),
          });
        }
      } catch (_) {}
    });

    return jobs;
  }, { kw: keyword, loc: location });
}

// ─── Scroll to Load More Jobs ───────────────────────────────────────────────

async function scrollToLoadJobs(page) {
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 700));
    await randomDelay(config.scraper.delayBetweenScrolls);
  }
}

// ─── Scrape Single Search Query ─────────────────────────────────────────────

async function scrapeSearch(context, keyword, location) {
  const page = await context.newPage();
  const url = buildSearchUrl(keyword, location);
  const jobs = [];

  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: config.scraper.pageLoadTimeout,
    });

    // Handle cookie consent (once per browser session)
    await acceptCookiesIfNeeded(page);

    // Wait for job cards
    await page.waitForSelector('.job-search-card', { timeout: 12000 }).catch(() => {});

    // Scroll to trigger lazy-loaded cards
    await scrollToLoadJobs(page);

    const found = await parseJobsFromPage(page, keyword, location);

    // Debug: save screenshot on first search with 0 results
    if (found.length === 0 && process.env.SCRAPER_DEBUG === 'true') {
      const fs = require('fs');
      const screenshotPath = `./logs/debug-screenshot.png`;
      fs.mkdirSync('./logs', { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`  [debug] 0 results — screenshot saved to ${screenshotPath}`);
      process.env.SCRAPER_DEBUG = 'done'; // only screenshot once
    }

    jobs.push(...found);
  } catch (err) {
    console.error(`  [scraper] Error on "${keyword}" / ${location}: ${err.message}`);
  } finally {
    await page.close();
  }

  return jobs;
}

// ─── Main Scrape Function ───────────────────────────────────────────────────

async function scrapeAllJobs(onBatch = null) {
  // Reset cookie flag for new browser session
  cookiesAccepted = false;

  console.log('\n[scraper] Starting LinkedIn job scrape...');
  console.log(`[scraper] ${config.jobKeywords.length} keywords × ${config.locations.length} locations = ${config.jobKeywords.length * config.locations.length} searches\n`);

  const { browser, context } = await createBrowser();
  const allJobs = [];

  try {
    for (const keyword of config.jobKeywords) {
      for (const location of config.locations) {
        process.stdout.write(`  [+] "${keyword}" in ${location} ... `);

        const jobs = await scrapeSearch(context, keyword, location);
        allJobs.push(...jobs);

        console.log(`${jobs.length} job(s)`);

        // Push this batch to the tracker immediately (incremental save)
        if (onBatch && jobs.length > 0) {
          await onBatch(jobs);
        }

        await randomDelay(config.scraper.delayBetweenSearches);
      }
    }
  } finally {
    await browser.close();
  }

  // Deduplicate by job ID across all searches
  const unique = new Map();
  for (const job of allJobs) {
    if (!unique.has(job.id)) unique.set(job.id, job);
  }

  const results = Array.from(unique.values());
  console.log(`\n[scraper] Done. Unique jobs found: ${results.length}`);
  return results;
}

module.exports = { scrapeAllJobs };
