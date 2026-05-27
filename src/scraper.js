const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());
const config = require('../config');

// ─── Helpers ────────────────────────────────────────────────────────────────

// LinkedIn's Remote filter ignores geography — a "Germany" search can return
// US/global jobs. This checks the job's scraped location against allowed countries.
function isLocationAllowed(jobLocation, allowedLocations) {
  if (!jobLocation) return false;
  const loc = jobLocation.toLowerCase();
  return allowedLocations.some(country => loc.includes(country.toLowerCase()));
}

function randomDelay(range) {
  return new Promise(resolve =>
    setTimeout(resolve, Math.floor(Math.random() * (range.max - range.min)) + range.min)
  );
}

// LinkedIn's URL filters (f_JT / f_WT) are not honoured reliably for public,
// unauthenticated searches — low-volume queries get padded with off-filter results.
// These maps drive a post-scrape verification pass against each job's detail page.
const JOB_TYPE_LABELS = {
  F: ['full-time', 'full time'],
  C: ['contract', 'freelance', 'b2b', 'contractor', 'interim'],
  P: ['part-time', 'part time'],
  T: ['temporary'],
  I: ['internship', 'intern'],
  V: ['volunteer'],
};
const WORKPLACE_LABELS = {
  '1': ['on-site', 'on site', 'onsite'],
  '2': ['remote'],
  '3': ['hybrid'],
};

function matchesLabel(text, allowedCodes, labelMap) {
  if (!text) return null; // unknown — caller decides
  const t = text.toLowerCase();
  return allowedCodes.some(code => (labelMap[code] || []).some(label => t.includes(label)));
}

function buildSearchUrl(keyword, location) {
  const { jobTypes, workplaceTypes, jobType, workType, timeRange } = config.linkedInFilters;
  // Support both new array fields and legacy single-value fields
  const jt = (jobTypes && jobTypes.length ? jobTypes : jobType ? [jobType] : ['C']).join(',');
  const wt = (workplaceTypes && workplaceTypes.length ? workplaceTypes : workType ? [workType] : ['2']).join(',');
  const params = new URLSearchParams({
    keywords: keyword,
    location: location,
    f_JT: jt,
    f_WT: wt,
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

// ─── Fetch Job Detail Page (for type/workplace verification) ────────────────

async function fetchJobDetails(page, jobId) {
  try {
    await page.goto(`https://www.linkedin.com/jobs/view/${jobId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });
    await page
      .waitForSelector('.description__job-criteria-list, .top-card-layout__entity-info', { timeout: 8000 })
      .catch(() => {});

    return await page.evaluate(() => {
      const result = { employmentType: '', workplaceType: '' };
      document.querySelectorAll('.description__job-criteria-item').forEach(item => {
        const header = item.querySelector('.description__job-criteria-subheader')?.textContent?.trim().toLowerCase() || '';
        const value = item.querySelector('.description__job-criteria-text')?.textContent?.trim().toLowerCase() || '';
        if (header.includes('employment type')) result.employmentType = value;
        if (header.includes('workplace')) result.workplaceType = value;
      });
      // Workplace is often shown as a pill in the top card instead of the criteria list.
      if (!result.workplaceType) {
        const top = document.querySelector('.top-card-layout__entity-info')?.textContent?.toLowerCase() || '';
        if (top.includes('remote')) result.workplaceType = 'remote';
        else if (top.includes('hybrid')) result.workplaceType = 'hybrid';
        else if (top.includes('on-site') || top.includes('on site')) result.workplaceType = 'on-site';
      }
      return result;
    });
  } catch {
    return null;
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

    // Drop jobs whose scraped location doesn't match any configured country.
    // LinkedIn's Remote filter returns global results regardless of search location.
    const locationFiltered = found.filter(job => isLocationAllowed(job.location, config.locations));
    if (locationFiltered.length < found.length) {
      console.log(`  [filter] Dropped ${found.length - locationFiltered.length} out-of-region job(s) for "${keyword}" / ${location}`);
    }

    // Drop jobs from excluded companies
    const excluded = config.excludedCompanies || [];
    const companyFiltered = excluded.length
      ? locationFiltered.filter(job => !excluded.some(ex => job.company.toLowerCase().includes(ex.toLowerCase())))
      : locationFiltered;
    if (companyFiltered.length < locationFiltered.length) {
      console.log(`  [filter] Dropped ${locationFiltered.length - companyFiltered.length} excluded company job(s)`);
    }

    // Debug: save screenshot on first search with 0 results
    if (locationFiltered.length === 0 && process.env.SCRAPER_DEBUG === 'true') {
      const fs = require('fs');
      const screenshotPath = `./logs/debug-screenshot.png`;
      fs.mkdirSync('./logs', { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`  [debug] 0 results — screenshot saved to ${screenshotPath}`);
      process.env.SCRAPER_DEBUG = 'done'; // only screenshot once
    }

    // Verify each remaining job by reading its detail page. LinkedIn's URL filter
    // pads results with off-filter jobs for low-volume queries, so we re-check.
    // Skipped if the configured filter is fully permissive (matches everything).
    const allowedJobTypes = config.linkedInFilters.jobTypes || [];
    const allowedWorkplaces = config.linkedInFilters.workplaceTypes || [];
    const filterIsPermissive =
      allowedJobTypes.length >= 5 && allowedWorkplaces.length >= 3;

    if (companyFiltered.length > 0 && !filterIsPermissive) {
      const detailPage = await context.newPage();
      let droppedType = 0, droppedWorkplace = 0, droppedUnknown = 0;
      const verified = [];
      try {
        for (const job of companyFiltered) {
          const details = await fetchJobDetails(detailPage, job.id);
          if (!details) { droppedUnknown++; continue; }

          const typeOk = matchesLabel(details.employmentType, allowedJobTypes, JOB_TYPE_LABELS);
          const wpOk   = matchesLabel(details.workplaceType, allowedWorkplaces, WORKPLACE_LABELS);

          // Be strict on employment type (LinkedIn always shows it). Be lenient
          // on workplace (often missing from public view) — only drop on explicit mismatch.
          if (typeOk === false) { droppedType++; continue; }
          if (typeOk === null)  { droppedUnknown++; continue; }
          if (wpOk === false)   { droppedWorkplace++; continue; }

          verified.push({
            ...job,
            employmentType: details.employmentType,
            workplaceType: details.workplaceType,
          });

          await randomDelay({ min: 500, max: 1500 });
        }
      } finally {
        await detailPage.close();
      }
      if (droppedType + droppedWorkplace + droppedUnknown > 0) {
        console.log(`  [verify] dropped: type=${droppedType}, workplace=${droppedWorkplace}, unknown=${droppedUnknown} — kept ${verified.length}/${companyFiltered.length}`);
      }
      jobs.push(...verified);
    } else {
      jobs.push(...companyFiltered);
    }
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
