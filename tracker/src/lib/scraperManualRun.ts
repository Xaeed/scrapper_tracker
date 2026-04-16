import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '@/lib/prisma'

const STALE_MS = 2 * 60 * 60 * 1000 // 2h — consider run stuck and allow new start

export function resolveScraperRoot(): string | null {
  const raw = process.env.SCRAPER_ROOT?.trim()
  if (!raw) return null
  const root = path.resolve(raw)
  if (!fs.existsSync(path.join(root, 'index.js'))) return null
  return root
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(-max)
}

async function getState() {
  let row = await prisma.scraperRunState.findUnique({ where: { id: 1 } })
  if (!row) {
    row = await prisma.scraperRunState.create({
      data: { id: 1, running: false },
    })
  }
  return row
}

export async function getManualRunStatus() {
  const enabled = resolveScraperRoot() !== null
  let row = await getState()
  let running = row.running
  let staleCleared = false

  if (running && row.startedAt) {
    const age = Date.now() - row.startedAt.getTime()
    if (age > STALE_MS) {
      await prisma.scraperRunState.update({
        where: { id: 1 },
        data: {
          running: false,
          finishedAt: new Date(),
          lastError: 'Previous run exceeded max duration; lock cleared.',
          lastExitCode: null,
        },
      })
      row = await getState()
      running = false
      staleCleared = true
    }
  }

  return {
    enabled,
    running,
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    lastExitCode: row.lastExitCode,
    lastError: row.lastError,
    staleCleared,
  }
}

/**
 * Starts `node index.js --run-now` from SCRAPER_ROOT. Updates DB on exit.
 * Returns { ok, error?, code? } — ok false if already running or misconfigured.
 */
export async function startManualScraperRun(): Promise<{ ok: boolean; error?: string; code?: string }> {
  const root = resolveScraperRoot()
  if (!root) {
    return {
      ok: false,
      error:
        'Scraper is not configured for manual runs. Set SCRAPER_ROOT in the tracker environment to the absolute path of the linkedin-job-scraper project (the folder that contains index.js).',
      code: 'NOT_CONFIGURED',
    }
  }

  const row = await getState()
  if (row.running && row.startedAt && Date.now() - row.startedAt.getTime() <= STALE_MS) {
    return { ok: false, error: 'A scraper run is already in progress.', code: 'BUSY' }
  }

  if (row.running) {
    await prisma.scraperRunState.update({
      where: { id: 1 },
      data: { running: false },
    })
  }

  const startedAt = new Date()
  await prisma.scraperRunState.update({
    where: { id: 1 },
    data: {
      running: true,
      startedAt,
      finishedAt: null,
      lastError: null,
      lastExitCode: null,
    },
  })

  const node = process.execPath
  const child = spawn(node, ['index.js', '--run-now'], {
    cwd: root,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  })

  let stderr = ''
  child.stderr?.on('data', chunk => {
    stderr += String(chunk)
    if (stderr.length > 8000) stderr = stderr.slice(-8000)
  })

  child.on('error', async err => {
    await prisma.scraperRunState.update({
      where: { id: 1 },
      data: {
        running: false,
        finishedAt: new Date(),
        lastExitCode: -1,
        lastError: truncate(err.message || String(err), 2000),
      },
    })
  })

  child.on('exit', async (code, signal) => {
    const exitCode = code ?? (signal ? -1 : 0)
    const failed = exitCode !== 0
    const errMsg = failed
      ? truncate(
          stderr || `Exited with code ${exitCode}${signal ? ` (${signal})` : ''}`,
          2000
        )
      : null
    await prisma.scraperRunState.update({
      where: { id: 1 },
      data: {
        running: false,
        finishedAt: new Date(),
        lastExitCode: exitCode,
        lastError: errMsg,
      },
    })
  })

  return { ok: true }
}
