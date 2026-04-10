'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

interface Job {
  id: string
  title: string
  company: string
  location: string | null
  link: string
  postedAt: string | null
  searchKeyword: string | null
  status: string
  notes: string | null
  createdAt: string
}

interface ApiResponse {
  jobs: Job[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const STATUSES = ['', 'NEW', 'VIEWED', 'READY', 'APPLIED', 'REJECTED', 'NOT_INTERESTED']

const STATUS_COLORS: Record<string, string> = {
  NEW: 'badge badge-NEW',
  VIEWED: 'badge badge-VIEWED',
  READY: 'badge badge-READY',
  APPLIED: 'badge badge-APPLIED',
  REJECTED: 'badge badge-REJECTED',
  NOT_INTERESTED: 'badge badge-NOT_INTERESTED',
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [keyword, setKeyword] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingAll, setDeletingAll] = useState(false)
  const notesTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const buildQuery = useCallback(() => {
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (status) p.set('status', status)
    if (keyword) p.set('searchKeyword', keyword)
    if (dateFrom) p.set('dateFrom', dateFrom)
    if (dateTo) p.set('dateTo', dateTo)
    p.set('sortBy', sortBy)
    p.set('sortDir', sortDir)
    p.set('page', String(page))
    return p.toString()
  }, [search, status, keyword, dateFrom, dateTo, sortBy, sortDir, page])

  const exportUrl = useCallback(() => {
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (status) p.set('status', status)
    if (keyword) p.set('searchKeyword', keyword)
    if (dateFrom) p.set('dateFrom', dateFrom)
    if (dateTo) p.set('dateTo', dateTo)
    return `/api/export?${p.toString()}`
  }, [search, status, keyword, dateFrom, dateTo])

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/jobs?${buildQuery()}`)
      const data: ApiResponse = await res.json()
      setJobs(data.jobs)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } finally {
      setLoading(false)
    }
  }, [buildQuery])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  function toggleSort(field: string) {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortDir('desc') }
    setPage(1)
  }

  function sortIndicator(field: string) {
    if (sortBy !== field) return ' ⇅'
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  async function patchJob(id: string, data: Partial<{ status: string; notes: string }>) {
    setSavingId(id)
    await fetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    setSavingId(null)
  }

  function handleStatusChange(job: Job, newStatus: string) {
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: newStatus } : j))
    patchJob(job.id, { status: newStatus })
  }

  async function handleDelete(job: Job) {
    if (!confirm(`Delete "${job.title}" at ${job.company}? This cannot be undone.`)) return
    setDeletingId(job.id)
    await fetch(`/api/jobs/${job.id}`, { method: 'DELETE' })
    setDeletingId(null)
    setJobs(prev => prev.filter(j => j.id !== job.id))
    setTotal(t => t - 1)
  }

  function handleNotesChange(job: Job, notes: string) {
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, notes } : j))
    clearTimeout(notesTimers.current[job.id])
    notesTimers.current[job.id] = setTimeout(() => patchJob(job.id, { notes }), 800)
  }

  async function handleDeleteAll() {
    const hasFilters = !!(search || status || keyword || dateFrom || dateTo)
    const label = hasFilters ? `${total} filtered job${total !== 1 ? 's' : ''}` : `all ${total} job${total !== 1 ? 's' : ''}`
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return

    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (status) p.set('status', status)
    if (keyword) p.set('searchKeyword', keyword)
    if (dateFrom) p.set('dateFrom', dateFrom)
    if (dateTo) p.set('dateTo', dateTo)

    setDeletingAll(true)
    await fetch(`/api/jobs?${p.toString()}`, { method: 'DELETE' })
    setDeletingAll(false)
    fetchJobs()
  }

  function reset() {
    setSearch(''); setStatus(''); setKeyword(''); setDateFrom(''); setDateTo('')
    setPage(1)
  }

  return (
    <>
      <div className="top-bar">
        <h1 style={{ margin: 0 }}>Jobs <span className="text-muted text-sm">({total})</span></h1>
        <a className="btn primary" href={exportUrl()} download>Export CSV</a>
        {total > 0 && (
          <button
            onClick={handleDeleteAll}
            disabled={deletingAll}
            style={{ color: '#991b1b', borderColor: '#fecaca' }}
          >
            {deletingAll
              ? 'Deleting…'
              : (search || status || keyword || dateFrom || dateTo)
                ? `Delete Filtered (${total})`
                : `Delete All (${total})`}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="filters">
        <div className="filter-field">
          <label>Search</label>
          <input
            type="search"
            placeholder="Title, company, location…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <div className="filter-field short">
          <label>Status</label>
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
            {STATUSES.map(s => <option key={s} value={s}>{s || 'All'}</option>)}
          </select>
        </div>
        <div className="filter-field">
          <label>Keyword</label>
          <input
            type="text"
            placeholder="Search keyword"
            value={keyword}
            onChange={e => { setKeyword(e.target.value); setPage(1) }}
          />
        </div>
        <div className="filter-field short">
          <label>Posted from</label>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }} />
        </div>
        <div className="filter-field short">
          <label>Posted to</label>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }} />
        </div>
        <div className="filter-actions">
          <button onClick={reset}>Reset</button>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        {loading && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading…
          </div>
        )}
        {!loading && jobs.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No jobs found. <Link href="/import">Import some →</Link>
          </div>
        )}
        {!loading && jobs.length > 0 && (
          <table>
            <thead>
              <tr>
                <th className="sortable" onClick={() => toggleSort('title')}>Title{sortIndicator('title')}</th>
                <th className="sortable" onClick={() => toggleSort('company')}>Company{sortIndicator('company')}</th>
                <th>Location</th>
                <th className="sortable" onClick={() => toggleSort('postedAt')}>Posted{sortIndicator('postedAt')}</th>
                <th>Keyword</th>
                <th className="sortable" onClick={() => toggleSort('status')}>Status{sortIndicator('status')}</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id}>
                  <td style={{ maxWidth: 280 }}>
                    <a href={job.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
                      {job.title}
                    </a>
                  </td>
                  <td>{job.company}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{job.location || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmt(job.postedAt)}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{job.searchKeyword || '—'}</td>
                  <td>
                    <select
                      className="status-select"
                      value={job.status}
                      onChange={e => handleStatusChange(job, e.target.value)}
                      disabled={savingId === job.id}
                    >
                      {['NEW', 'VIEWED', 'READY', 'APPLIED', 'REJECTED', 'NOT_INTERESTED'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ minWidth: 200 }}>
                    <textarea
                      rows={1}
                      style={{ width: '100%', minHeight: 32, resize: 'vertical', padding: '4px 6px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'inherit' }}
                      value={job.notes ?? ''}
                      placeholder="Add notes…"
                      onChange={e => handleNotesChange(job, e.target.value)}
                    />
                  </td>
                  <td style={{ whiteSpace: 'nowrap', display: 'flex', gap: 6 }}>
                    <a
                      href={job.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn"
                      style={{ fontSize: 12, padding: '4px 10px' }}
                    >
                      Open ↗
                    </a>
                    <a
                      href={`/cv?jobId=${job.id}&title=${encodeURIComponent(job.title)}&company=${encodeURIComponent(job.company)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn"
                      style={{ fontSize: 12, padding: '4px 10px', color: '#1d4ed8', borderColor: '#bfdbfe' }}
                      title="Create tailored CV for this job"
                    >
                      CV ↗
                    </a>
                    <button
                      onClick={() => handleDelete(job)}
                      disabled={deletingId === job.id}
                      style={{ fontSize: 12, padding: '4px 10px', color: '#991b1b', borderColor: '#fecaca' }}
                      title="Delete job"
                    >
                      {deletingId === job.id ? '…' : '✕'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button onClick={() => setPage(1)} disabled={page === 1}>«</button>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
          <span>Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
        </div>
      )}
    </>
  )
}
