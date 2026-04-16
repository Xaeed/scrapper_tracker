'use client'

import { useEffect, useState } from 'react'

interface StatusPayload {
  enabled: boolean
  running: boolean
  startedAt: string | null
  finishedAt: string | null
  lastExitCode: number | null
  lastError: string | null
}

export default function ScraperStatusBadge() {
  const [data, setData] = useState<StatusPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const res = await fetch('/api/admin/scraper', { cache: 'no-store' })
        if (!res.ok) return
        const json = (await res.json()) as StatusPayload
        if (!cancelled) setData(json)
      } catch {
        /* ignore */
      }
    }
    poll()
    const id = setInterval(poll, 4000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  if (!data?.enabled) return null

  return (
    <span
      title={
        data.running
          ? 'LinkedIn scraper run in progress (manual)'
          : 'Scraper idle — Scraper Config → Run scraper now'
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: 'var(--text-muted)',
        marginRight: 4,
      }}
    >
      <span
        className={data.running ? 'scraper-run-dot--active' : undefined}
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: data.running ? '#22c55e' : '#94a3b8',
          flexShrink: 0,
        }}
      />
      {data.running ? 'Scraping…' : 'Scraper idle'}
    </span>
  )
}
