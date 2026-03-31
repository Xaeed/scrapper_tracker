# Hosting: VPS Setup Guide

## ✅ Chosen: UpCloud VPS — DE-FRA1

| | |
|---|---|
| **IP** | 85.9.201.105 |
| **CPU** | 1 vCPU |
| **RAM** | 2 GB |
| **Storage** | 10 GB |
| **Location** | Frankfurt, Germany |
| **Cost** | €8/month |

---

## What We're Hosting

| Service | Tech | RAM Usage | Status |
|---|---|---|---|
| **Scraper** | Node.js + Playwright | ~400–600 MB peak | ✅ Running (PM2: `scraper`) |
| **Tracker** | Next.js + SQLite | ~150–200 MB idle | ✅ Running (PM2: `tracker`) |
| **n8n** | Docker container | ~200–300 MB idle | ⏳ Needs deploying |

**Peak total:** ~950 MB — fits comfortably in 2 GB with ~1 GB headroom.

---

## Services & Ports

| Service | Port | URL |
|---|---|---|
| Tracker (Next.js) | 3000 | http://85.9.201.105:3000 |
| n8n | 5678 | http://85.9.201.105:5678 |

---

## What's Already Done

- [x] Node.js + PM2 installed
- [x] Scraper running on PM2 (`pm2 list` → `scraper`)
- [x] Tracker running on PM2 (`pm2 list` → `tracker`)
- [x] PM2 auto-starts on reboot via systemd
- [x] App lives at `/opt/linkedin-job-scraper/`

---

## What Still Needs Doing

### 1. Install Docker

```bash
ssh root@85.9.201.105
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
```

### 2. Copy CV files to VPS

Your CV HTML source files live locally at `/Users/saeedbutt/Documents/n8nCvs/`.
Copy them to the VPS:

```bash
# Run from your Mac
ssh root@85.9.201.105 "mkdir -p /opt/n8n-cv-files/generated"
scp /Users/saeedbutt/Documents/n8nCvs/* root@85.9.201.105:/opt/n8n-cv-files/
```

### 3. Create n8n docker-compose on VPS

Create `/opt/linkedin-job-scraper/n8nWorkflows/docker-compose.prod.yaml`:

```yaml
services:
  n8n:
    image: docker.n8n.io/n8nio/n8n
    container_name: n8n
    ports:
      - "5678:5678"
    environment:
      GENERIC_TIMEZONE: Europe/Berlin
      TZ: Europe/Berlin
      N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS: "true"
      N8N_RUNNERS_ENABLED: "true"
      N8N_BLOCK_ENV_ACCESS_IN_NODE: "false"
      NODE_FUNCTION_ALLOW_BUILTIN: "fs,path"
      ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY}"
    volumes:
      - n8n_data:/home/node/.n8n
      - /opt/n8n-cv-files:/home/node/.n8n-files
    restart: unless-stopped

volumes:
  n8n_data:
```

> **Note:** The API key is passed via env variable, not hardcoded.
> On the VPS, create `/opt/linkedin-job-scraper/.env.n8n`:
> ```
> ANTHROPIC_API_KEY=your-key-here
> ```

### 4. Start n8n on VPS

```bash
ssh root@85.9.201.105
cd /opt/linkedin-job-scraper/n8nWorkflows
docker compose -f docker-compose.prod.yaml --env-file ../.env.n8n up -d
```

Verify it's running:
```bash
docker ps
curl http://localhost:5678/healthz
```

### 5. Import n8n Workflow

1. Open http://85.9.201.105:5678 in your browser
2. Go to **Workflows → Import from file**
3. Upload `n8nWorkflows/cv_workflows.json`
4. **Activate** the workflow (toggle top-right)

### 6. Update Tracker .env on VPS

```bash
ssh root@85.9.201.105
echo 'N8N_WEBHOOK_URL=http://localhost:5678/webhook/job-description' >> /opt/linkedin-job-scraper/tracker/.env
pm2 reload tracker
```

### 7. Auto-start n8n on Reboot

```bash
ssh root@85.9.201.105

# Create a systemd service for docker compose
cat > /etc/systemd/system/n8n.service << 'EOF'
[Unit]
Description=n8n workflow automation
After=docker.service
Requires=docker.service

[Service]
WorkingDirectory=/opt/linkedin-job-scraper/n8nWorkflows
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yaml --env-file ../.env.n8n up
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yaml down
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable n8n
systemctl start n8n
```

---

## Deploy Script (Updated)

The root `package.json` `deploy` script syncs code and rebuilds. After adding n8n,
the full deploy order on the server is:

```
rsync → npm install → tracker:build → pm2 reload all
        (n8n restarts automatically via systemd)
```

No changes needed to the deploy script — n8n is managed separately by Docker/systemd.

---

## Firewall (Optional but Recommended)

By default, both ports 3000 and 5678 are publicly accessible. To restrict n8n to local-only (only the tracker needs it):

```bash
ssh root@85.9.201.105
ufw allow 22       # SSH
ufw allow 3000     # Tracker (public)
ufw deny 5678      # n8n (block external — tracker calls it via localhost)
ufw enable
```

n8n is still reachable from the tracker (`http://localhost:5678`) but not from the internet.

---

## Monitoring

```bash
# Check all services
pm2 status
docker ps

# Logs
pm2 logs scraper
pm2 logs tracker
docker logs n8n --tail 50 -f

# RAM usage
free -h
```

---

## Storage Budget

| Item | Estimated size |
|---|---|
| App code + node_modules | ~600 MB |
| SQLite DB (tracker) | ~10–50 MB |
| n8n Docker image | ~500 MB |
| n8n data volume | ~50 MB |
| Generated CVs | ~5 MB |
| Playwright Chromium | ~300 MB |
| **Total** | **~1.5 GB** of 10 GB |

You have plenty of storage headroom.
