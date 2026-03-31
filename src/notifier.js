const nodemailer = require('nodemailer');
const config = require('../config');

// ─── Console Notification ────────────────────────────────────────────────────

function printJobsToConsole(jobs, runLabel = '') {
  if (!jobs.length) {
    console.log('\n[notifier] No new jobs found in this run.\n');
    return;
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(` NEW CONTRACT JOBS${runLabel ? ' — ' + runLabel : ''} (${jobs.length} found)`);
  console.log(`${'═'.repeat(70)}\n`);

  jobs.forEach((job, i) => {
    console.log(`[${i + 1}] ${job.title}`);
    console.log(`    Company  : ${job.company || 'N/A'}`);
    console.log(`    Location : ${job.location}`);
    console.log(`    Posted   : ${job.postedAt || 'N/A'}`);
    console.log(`    Link     : ${job.link}`);
    console.log(`    Search   : "${job.searchKeyword}" → ${job.searchLocation}`);
    console.log('');
  });

  console.log(`${'═'.repeat(70)}\n`);
}

// ─── Build HTML Email Body ───────────────────────────────────────────────────

function buildEmailHtml(jobs, runLabel = '') {
  const rows = jobs.map((job, i) => `
    <tr style="background:${i % 2 === 0 ? '#f9f9f9' : '#ffffff'}">
      <td style="padding:10px;border-bottom:1px solid #eee;">
        <strong><a href="${job.link}" style="color:#0a66c2;text-decoration:none;">${job.title}</a></strong><br/>
        <span style="color:#555;font-size:13px;">${job.company || 'N/A'}</span>
      </td>
      <td style="padding:10px;border-bottom:1px solid #eee;font-size:13px;">${job.location}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;font-size:13px;">${job.postedAt || 'N/A'}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;font-size:12px;color:#777;">${job.searchKeyword}</td>
    </tr>
  `).join('');

  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="UTF-8"/></head>
  <body style="font-family:Arial,sans-serif;margin:0;padding:20px;background:#f4f4f4;">
    <div style="max-width:900px;margin:auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
      <div style="background:#0a66c2;padding:20px 30px;">
        <h1 style="color:#fff;margin:0;font-size:20px;">
          LinkedIn Contract Job Alerts
          ${runLabel ? `<span style="font-size:14px;opacity:.8"> — ${runLabel}</span>` : ''}
        </h1>
        <p style="color:#cce0ff;margin:5px 0 0;font-size:13px;">
          ${jobs.length} new remote contract role(s) in Europe • ${new Date().toLocaleString('en-GB')}
        </p>
      </div>
      <div style="padding:20px 30px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:#0a66c2;color:#fff;">
              <th style="padding:10px;text-align:left;">Job Title & Company</th>
              <th style="padding:10px;text-align:left;">Location</th>
              <th style="padding:10px;text-align:left;">Posted</th>
              <th style="padding:10px;text-align:left;">Search Term</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="padding:15px 30px;background:#f9f9f9;border-top:1px solid #eee;font-size:12px;color:#999;">
        LinkedIn Job Scraper Agent • Auto-generated alert
      </div>
    </div>
  </body>
  </html>`;
}

// ─── Send Gmail Alert ────────────────────────────────────────────────────────

async function sendEmailAlert(jobs, runLabel = '') {
  if (!config.email.enabled) {
    console.log('[notifier] Email not configured — skipping. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env');
    return;
  }

  if (!jobs.length) {
    console.log('[notifier] No new jobs — skipping email.');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.email.gmailUser,
      pass: config.email.gmailAppPassword,
    },
  });

  const subject = `[Job Alert] ${jobs.length} new contract role(s) in Europe${runLabel ? ' — ' + runLabel : ''}`;

  try {
    await transporter.sendMail({
      from: `"LinkedIn Job Agent" <${config.email.from}>`,
      to: config.email.to,
      subject,
      html: buildEmailHtml(jobs, runLabel),
    });
    console.log(`[notifier] Email sent to ${config.email.to} with ${jobs.length} job(s).`);
  } catch (err) {
    console.error(`[notifier] Email failed: ${err.message}`);
  }
}

// ─── Main Notify Function ────────────────────────────────────────────────────

async function notify(newJobs, runLabel = '') {
  printJobsToConsole(newJobs, runLabel);
  await sendEmailAlert(newJobs, runLabel);
}

module.exports = { notify };
