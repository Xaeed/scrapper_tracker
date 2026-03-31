# Job Tracker

A personal web app to import, track, and manage LinkedIn job listings scraped by the companion scraper.

**Live:** http://85.9.201.105:3000

---

## Table of Contents

1. [Stack](#stack)
2. [Project Structure](#project-structure)
3. [Features](#features)
4. [Running Locally](#running-locally)
5. [How the Scraper Auto-Pushes Jobs](#how-the-scraper-auto-pushes-jobs)
6. [Production Server](#production-server)
7. [Re-deploying After Code Changes](#re-deploying-after-code-changes)
8. [Useful Server Commands](#useful-server-commands)

---

## Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Framework  | Next.js 14 (App Router)           |
| Language   | TypeScript                        |
| Database   | SQLite (via Prisma ORM)           |
| Styling    | Plain CSS (no component library)  |
| Process mgr| PM2                               |
| Hosting    | UpCloud VPS — Ubuntu 24.04        |

---

## Project Structure

```
tracker/
├── .env                          # DATABASE_URL
├── next.config.mjs
├── package.json
├── tsconfig.json
├── prisma/
│   ├── schema.prisma             # Job model definition
│   ├── dev.db                    # SQLite database (auto-created)
│   └── migrations/
│       └── 20260303223835_init/
│           └── migration.sql
└── src/
    ├── lib/
    │   ├── prisma.ts             # PrismaClient singleton
    │   └── jobFilters.ts         # Shared buildWhere() filter helper
    └── app/
        ├── globals.css           # All styles (no external CSS libraries)
        ├── layout.tsx            # Root layout + nav
        ├── page.tsx              # Redirects / → /jobs
        ├── import/
        │   └── page.tsx          # File upload UI
        ├── jobs/
        │   ├── page.tsx          # Jobs table with filters, inline edit, delete
        │   └── [id]/
        │       └── page.tsx      # Job detail + status/notes editor
        └── api/
            ├── import/
            │   └── route.ts      # POST — accepts JSON body or file upload
            ├── jobs/
            │   ├── route.ts      # GET (list/filter) + DELETE (bulk)
            │   └── [id]/
            │       └── route.ts  # GET + PATCH (status/notes) + DELETE
            └── export/
                └── route.ts      # GET — returns filtered CSV download
```

---

## Features

- **Import** — Upload a JSON file from the scraper, or jobs are pushed automatically
- **Deduplication** — Jobs are matched by LinkedIn ID then URL; duplicates are skipped, not re-inserted
- **Jobs table** — Filter by search text, status, keyword, posted date range; sortable columns; pagination
- **Inline editing** — Change status via dropdown, edit notes in-place (auto-saves after 800ms)
- **Delete** — Delete individual jobs (per-row ✕ button) or bulk-delete all/filtered jobs
- **Open job** — Direct link to the LinkedIn posting
- **Export CSV** — Downloads all jobs matching current filters

### Job Status Flow

```
NEW → VIEWED → APPLIED → REJECTED
```

---

## Running Locally

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
# From the repo root
cd tracker

# 1. Install dependencies
npm install

# 2. Create the database
npm run db:migrate
# This runs: prisma migrate dev --name init
# Creates tracker/prisma/dev.db

# 3. Start the dev server
npm run dev
# Open http://localhost:3000
```

### Available Scripts

```bash
npm run dev          # Start dev server with hot reload
npm run build        # Build for production
npm start            # Start production server (requires build first)
npm run db:migrate   # Run Prisma migrations (dev)
npm run db:studio    # Open Prisma Studio (DB GUI)
```

---

## How the Scraper Auto-Pushes Jobs

The companion scraper (`../index.js`) automatically pushes scraped jobs to the tracker after every run — no manual import needed.

### How it works

1. The scraper runs on its cron schedule (9am, 1pm, 5pm Berlin time)
2. After scraping, `src/storage.js` calls `pushToTracker(freshJobs)`
3. This POSTs the jobs as JSON to `TRACKER_URL/api/import`
4. The tracker deduplicates and inserts only new jobs

### Configuration

In the scraper's `.env` (at the repo root, **not** inside `tracker/`):

```env
TRACKER_URL=http://localhost:3000       # local dev
TRACKER_URL=http://85.9.201.105:3000    # production (already set on server)
```

Set `TRACKER_URL=` (empty) to disable auto-push.

### Manual trigger (run scraper now)

```bash
# From repo root
node index.js --run-now
```

---

## Production Server

**Provider:** UpCloud
**IP:** `85.9.201.105`
**OS:** Ubuntu 24.04
**Specs:** 1 vCPU, 1GB RAM + 2GB swap, 10GB SSD
**App path:** `/opt/linkedin-job-scraper/`

### What's running

| PM2 Name  | What it does                                 |
|-----------|----------------------------------------------|
| `tracker` | Next.js production server on port 3000       |
| `scraper` | Node.js cron daemon (scrapes + auto-pushes)  |

Both processes start automatically on server reboot via `pm2 startup systemd`.

### Firewall (UFW)

| Port | Purpose       |
|------|---------------|
| 22   | SSH           |
| 3000 | Tracker web app |

---

## Re-deploying After Code Changes

This is the process to push local changes to the production server.

### Step 1 — Make your changes locally

Edit any files inside `tracker/` on your machine. Test with `npm run dev` if needed.

### Step 2 — Sync files to the server

```bash
rsync -avz \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='tracker/node_modules' \
  --exclude='tracker/.next' \
  --exclude='prisma/dev.db' \
  -e "ssh -o StrictHostKeyChecking=no" \
  /Users/saeedbutt/Documents/Node/linkedin-job-scraper/ \
  root@85.9.201.105:/opt/linkedin-job-scraper/
```

### Step 3 — Build and restart on the server

```bash
ssh root@85.9.201.105 "
  cd /opt/linkedin-job-scraper/tracker &&
  npm install &&
  npm run build &&
  pm2 reload tracker
"
```

> `npm install` is only needed if you changed `package.json`. Safe to always include.

### One-liner (copy-paste friendly)

```bash
rsync -avz --exclude='node_modules' --exclude='.next' --exclude='tracker/node_modules' --exclude='tracker/.next' --exclude='prisma/dev.db' -e "ssh -o StrictHostKeyChecking=no" /Users/saeedbutt/Documents/Node/linkedin-job-scraper/ root@85.9.201.105:/opt/linkedin-job-scraper/ && ssh root@85.9.201.105 "cd /opt/linkedin-job-scraper/tracker && npm install && npm run build && pm2 reload tracker"
```

### If you changed the Prisma schema

If you added/changed fields in `prisma/schema.prisma`, run the migration on the server after syncing:

```bash
ssh root@85.9.201.105 "
  cd /opt/linkedin-job-scraper/tracker &&
  npx prisma migrate deploy
"
```

> `migrate deploy` applies pending migrations safely. It does **not** wipe data.

### If you changed the scraper (not the tracker)

```bash
ssh root@85.9.201.105 "pm2 reload scraper"
```

---

## Useful Server Commands

```bash
# SSH in
ssh root@85.9.201.105

# Check both processes are running
pm2 list

# Live logs — tracker
pm2 logs tracker

# Live logs — scraper
pm2 logs scraper

# Restart everything
pm2 reload all

# Trigger a scrape immediately (also pushes to tracker)
cd /opt/linkedin-job-scraper && node index.js --run-now

# Check scraper stats (jobs stored in JSON file)
node index.js --stats

# Open the SQLite database interactively
cd /opt/linkedin-job-scraper/tracker && npx prisma studio
# (then SSH tunnel: ssh -L 5555:localhost:5555 root@85.9.201.105)

# Check memory usage
free -h

# Check disk usage
df -h /
```

---

## Troubleshooting

### Tracker not responding

```bash
ssh root@85.9.201.105 "pm2 logs tracker --lines 50"
# If crashed:
pm2 restart tracker
```

### Scraper not running

```bash
ssh root@85.9.201.105 "pm2 logs scraper --lines 50"
pm2 restart scraper
```

### Build runs out of memory

The server has 1GB RAM. The swap file handles this, but if a build fails:

```bash
ssh root@85.9.201.105 "free -h && swapon --show"
# If swap is missing, re-add it:
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
```

### Port 3000 not accessible from browser

```bash
ssh root@85.9.201.105 "ufw status"
# If port 3000 is missing:
ufw allow 3000/tcp
```
