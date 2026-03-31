const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../logs/scraper.log');

function ensureLogDir() {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function timestamp() {
  return new Date().toLocaleString('en-GB', { timeZone: process.env.TIMEZONE || 'Europe/Berlin' });
}

// Clear log file and write the first line (called at run start)
function startLog(label) {
  ensureLogDir();
  fs.writeFileSync(LOG_FILE, `[${timestamp()}] === RUN STARTED: ${label} ===\n`);
}

function log(msg) {
  ensureLogDir();
  const line = `[${timestamp()}] ${msg}\n`;
  process.stdout.write(line);
  fs.appendFileSync(LOG_FILE, line);
}

function error(msg) {
  ensureLogDir();
  const line = `[${timestamp()}] ERROR: ${msg}\n`;
  process.stderr.write(line);
  fs.appendFileSync(LOG_FILE, line);
}

module.exports = { startLog, log, error, LOG_FILE };
