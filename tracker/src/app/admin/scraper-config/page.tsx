'use client'

import { useEffect, useRef, useState } from 'react'

interface ConfigItem { label: string; enabled: boolean }

interface Config {
  keywords: ConfigItem[]
  locations: ConfigItem[]
  excludedCompanies: string[]
  jobTypes: string[]
  workplaceTypes: string[]
  updatedAt: string
}

interface ScraperRunApi {
  enabled: boolean
  running: boolean
  startedAt: string | null
  finishedAt: string | null
  lastExitCode: number | null
  lastError: string | null
}

const JOB_TYPE_OPTIONS = [
  { code: 'F', label: 'Full-time' },
  { code: 'C', label: 'Contract' },
  { code: 'P', label: 'Part-time' },
  { code: 'T', label: 'Temporary' },
  { code: 'I', label: 'Internship' },
]

const WORKPLACE_OPTIONS = [
  { code: '1', label: 'On-site' },
  { code: '2', label: 'Remote' },
  { code: '3', label: 'Hybrid' },
]

export default function ScraperConfigPage() {
  const [runStatus, setRunStatus] = useState<ScraperRunApi | null>(null)
  const [runLoading, setRunLoading] = useState(false)
  const [runMessage, setRunMessage] = useState<string | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  const [keywords, setKeywords] = useState<ConfigItem[]>([])
  const [locations, setLocations] = useState<ConfigItem[]>([])
  const [excludedCompanies, setExcludedCompanies] = useState<string[]>([])
  const [jobTypes, setJobTypes] = useState<string[]>(['F', 'C'])
  const [workplaceTypes, setWorkplaceTypes] = useState<string[]>(['1', '2', '3'])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const kwInput = useRef<HTMLInputElement>(null)
  const locInput = useRef<HTMLInputElement>(null)
  const exclInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/scraper-config')
      .then(r => r.json())
      .then((data: Config) => {
        setKeywords(data.keywords)
        setLocations(data.locations)
        setExcludedCompanies(data.excludedCompanies ?? [])
        setJobTypes(data.jobTypes ?? ['F', 'C'])
        setWorkplaceTypes(data.workplaceTypes ?? ['1', '2', '3'])
        setUpdatedAt(data.updatedAt)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    async function pollRun() {
      try {
        const res = await fetch('/api/admin/scraper', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as ScraperRunApi
        if (!cancelled) setRunStatus(data)
      } catch { /* ignore */ }
    }
    pollRun()
    const t = setInterval(pollRun, 3000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  async function triggerManualRun() {
    setRunLoading(true)
    setRunError(null)
    setRunMessage(null)
    try {
      const res = await fetch('/api/admin/scraper', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setRunError(typeof data.error === 'string' ? data.error : 'Could not start scraper'); return }
      setRunMessage('Scraper started — this can take several minutes.')
      const st = await fetch('/api/admin/scraper', { cache: 'no-store' }).then(r => r.json())
      setRunStatus(st as ScraperRunApi)
    } catch {
      setRunError('Network error')
    } finally {
      setRunLoading(false)
    }
  }

  function addKeyword() {
    const val = kwInput.current?.value.trim()
    if (!val) return
    if (!keywords.some(k => k.label === val)) setKeywords(prev => [...prev, { label: val, enabled: true }])
    kwInput.current!.value = ''
  }

  function addLocation() {
    const val = locInput.current?.value.trim()
    if (!val) return
    if (!locations.some(l => l.label === val)) setLocations(prev => [...prev, { label: val, enabled: true }])
    locInput.current!.value = ''
  }

  function addExcludedCompany() {
    const val = exclInput.current?.value.trim()
    if (!val) return
    if (!excludedCompanies.includes(val)) setExcludedCompanies(prev => [...prev, val])
    exclInput.current!.value = ''
  }

  function toggleKeyword(label: string) {
    setKeywords(prev => prev.map(k => k.label === label ? { ...k, enabled: !k.enabled } : k))
  }

  function toggleLocation(label: string) {
    setLocations(prev => prev.map(l => l.label === label ? { ...l, enabled: !l.enabled } : l))
  }

  function toggleCode(arr: string[], setArr: (v: string[]) => void, code: string) {
    setArr(arr.includes(code) ? arr.filter(c => c !== code) : [...arr, code])
  }

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/scraper-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords, locations, excludedCompanies, jobTypes, workplaceTypes }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Save failed')
      } else {
        setUpdatedAt(data.updatedAt)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Loading…</div>

  const activeKeywords = keywords.filter(k => k.enabled).length
  const activeLocations = locations.filter(l => l.enabled).length

  return (
    <>
      {/* ── Manual run card ── */}
      {runStatus && (
        <div className="card" style={{
          marginBottom: 20,
          borderColor: runStatus.running ? '#86efac' : 'var(--border)',
          background: runStatus.running ? '#f0fdf4' : 'var(--surface)',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: runStatus.enabled ? 8 : 0 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Manual scraper run</h2>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span className={runStatus.running ? 'scraper-run-dot--active' : undefined} style={{
                width: 10, height: 10, borderRadius: '50%',
                background: runStatus.running ? '#22c55e' : '#94a3b8',
              }} />
              <strong>{runStatus.running ? 'Running…' : 'Idle'}</strong>
            </span>
            <button type="button" className="btn primary"
              disabled={runLoading || runStatus.running || !runStatus.enabled}
              onClick={() => void triggerManualRun()}
              style={{ marginLeft: 'auto' }}>
              {runLoading ? 'Starting…' : runStatus.running ? 'Run in progress' : 'Run scraper now'}
            </button>
          </div>
          {!runStatus.enabled && (
            <p style={{ fontSize: 13, color: '#92400e', margin: 0, background: '#fffbeb', padding: 10, borderRadius: 6, border: '1px solid #fcd34d' }}>
              Manual runs are disabled until you set <code style={{ fontSize: 12 }}>SCRAPER_ROOT</code> on the server.
            </p>
          )}
          {runStatus.enabled && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              Runs <code style={{ fontSize: 11 }}>node index.js --run-now</code>.
              {runStatus.startedAt && runStatus.running && <span> Started {new Date(runStatus.startedAt).toLocaleString('en-GB')}.</span>}
            </p>
          )}
          {runMessage && <p style={{ fontSize: 13, color: '#166534', marginTop: 10, marginBottom: 0 }}>{runMessage}</p>}
          {runError && <p style={{ fontSize: 13, color: '#991b1b', marginTop: 10, marginBottom: 0 }}>{runError}</p>}
          {runStatus.enabled && !runStatus.running && runStatus.finishedAt && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, marginBottom: 0 }}>
              Last finished: {new Date(runStatus.finishedAt).toLocaleString('en-GB')}
              {runStatus.lastExitCode != null && <span> · Exit code: {runStatus.lastExitCode}</span>}
            </p>
          )}
          {runStatus.lastError && !runStatus.running && (
            <pre style={{ marginTop: 10, fontSize: 11, padding: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, maxHeight: 120, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {runStatus.lastError}
            </pre>
          )}
        </div>
      )}

      <div className="top-bar">
        <h1 style={{ margin: 0 }}>Scraper Config</h1>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {updatedAt ? `Last saved: ${new Date(updatedAt).toLocaleString('en-GB')}` : ''}
        </span>
        <button className="btn primary" onClick={save}
          disabled={saving || keywords.length === 0 || locations.length === 0}>
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Changes'}
        </button>
      </div>

      {error && (
        <div style={{ margin: '0 0 16px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#991b1b', fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* ── Job Type + Workplace Type ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        <div className="card">
          <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Job Type</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {JOB_TYPE_OPTIONS.map(({ code, label }) => {
              const active = jobTypes.includes(code)
              return (
                <label key={code} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 14, padding: '6px 12px', borderRadius: 6, border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`, background: active ? '#eff6ff' : 'var(--bg)', color: active ? 'var(--primary)' : 'var(--text)', userSelect: 'none' }}>
                  <input type="checkbox" checked={active} onChange={() => toggleCode(jobTypes, setJobTypes, code)} style={{ accentColor: 'var(--primary)' }} />
                  {label}
                </label>
              )
            })}
          </div>
        </div>

        <div className="card">
          <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Workplace Type</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {WORKPLACE_OPTIONS.map(({ code, label }) => {
              const active = workplaceTypes.includes(code)
              return (
                <label key={code} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 14, padding: '6px 12px', borderRadius: 6, border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`, background: active ? '#eff6ff' : 'var(--bg)', color: active ? 'var(--primary)' : 'var(--text)', userSelect: 'none' }}>
                  <input type="checkbox" checked={active} onChange={() => toggleCode(workplaceTypes, setWorkplaceTypes, code)} style={{ accentColor: 'var(--primary)' }} />
                  {label}
                </label>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Keywords + Locations ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>
              Search Keywords{' '}
              <span className="text-muted text-sm">({activeKeywords}/{keywords.length} active)</span>
            </h2>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>
            Toggle to enable/disable without deleting. Only active keywords are scraped.
          </p>

          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {keywords.map(kw => (
              <li key={kw.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg)', border: `1px solid ${kw.enabled ? 'var(--border)' : '#e5e7eb'}`, borderRadius: 6, fontSize: 14, opacity: kw.enabled ? 1 : 0.5 }}>
                <button
                  onClick={() => toggleKeyword(kw.label)}
                  title={kw.enabled ? 'Disable' : 'Enable'}
                  style={{ flexShrink: 0, width: 36, padding: '2px 6px', fontSize: 11, fontWeight: 600, borderRadius: 4, background: kw.enabled ? '#dcfce7' : '#f3f4f6', color: kw.enabled ? '#166534' : '#6b7280', borderColor: kw.enabled ? '#86efac' : '#d1d5db' }}
                >
                  {kw.enabled ? 'ON' : 'OFF'}
                </button>
                <span style={{ flex: 1 }}>{kw.label}</span>
                <button
                  onClick={() => setKeywords(prev => prev.filter(k => k.label !== kw.label))}
                  style={{ padding: '2px 8px', fontSize: 12, color: '#991b1b', borderColor: '#fecaca', lineHeight: 1.4 }}
                  title="Remove"
                >✕</button>
              </li>
            ))}
          </ul>

          <div style={{ display: 'flex', gap: 8 }}>
            <input ref={kwInput} type="text" placeholder="e.g. Azure Data Engineer" style={{ flex: 1 }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }} />
            <button className="btn primary" onClick={addKeyword}>Add</button>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>
              Target Countries{' '}
              <span className="text-muted text-sm">({activeLocations}/{locations.length} active)</span>
            </h2>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>
            Toggle to enable/disable. Use country names exactly as LinkedIn recognises them.
          </p>

          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {locations.map(loc => (
              <li key={loc.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg)', border: `1px solid ${loc.enabled ? 'var(--border)' : '#e5e7eb'}`, borderRadius: 6, fontSize: 14, opacity: loc.enabled ? 1 : 0.5 }}>
                <button
                  onClick={() => toggleLocation(loc.label)}
                  title={loc.enabled ? 'Disable' : 'Enable'}
                  style={{ flexShrink: 0, width: 36, padding: '2px 6px', fontSize: 11, fontWeight: 600, borderRadius: 4, background: loc.enabled ? '#dcfce7' : '#f3f4f6', color: loc.enabled ? '#166534' : '#6b7280', borderColor: loc.enabled ? '#86efac' : '#d1d5db' }}
                >
                  {loc.enabled ? 'ON' : 'OFF'}
                </button>
                <span style={{ flex: 1 }}>{loc.label}</span>
                <button
                  onClick={() => setLocations(prev => prev.filter(l => l.label !== loc.label))}
                  style={{ padding: '2px 8px', fontSize: 12, color: '#991b1b', borderColor: '#fecaca', lineHeight: 1.4 }}
                  title="Remove"
                >✕</button>
              </li>
            ))}
          </ul>

          <div style={{ display: 'flex', gap: 8 }}>
            <input ref={locInput} type="text" placeholder="e.g. Switzerland" style={{ flex: 1 }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLocation() } }} />
            <button className="btn primary" onClick={addLocation}>Add</button>
          </div>
        </div>
      </div>

      {/* ── Excluded Companies ── */}
      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Excluded Companies <span className="text-muted text-sm">({excludedCompanies.length})</span></h2>
        </div>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>
          Jobs from these companies are hidden from the jobs list. Partial name matching.
        </p>

        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {excludedCompanies.map(company => (
            <li key={company} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 20, fontSize: 13 }}>
              <span style={{ color: '#991b1b' }}>{company}</span>
              <button onClick={() => setExcludedCompanies(prev => prev.filter(c => c !== company))}
                style={{ padding: '0 4px', fontSize: 12, color: '#991b1b', border: 'none', background: 'none', cursor: 'pointer', lineHeight: 1 }}
                title="Remove">✕</button>
            </li>
          ))}
          {excludedCompanies.length === 0 && (
            <li style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No companies excluded.</li>
          )}
        </ul>

        <div style={{ display: 'flex', gap: 8, maxWidth: 480 }}>
          <input ref={exclInput} type="text" placeholder="e.g. peopleworth" style={{ flex: 1 }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addExcludedCompany() } }} />
          <button className="btn primary" onClick={addExcludedCompany}>Add</button>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)' }}>
        <strong style={{ color: 'var(--text)' }}>Total searches per run:</strong>{' '}
        {activeKeywords} active keywords × {activeLocations} active locations ={' '}
        <strong style={{ color: 'var(--primary)' }}>{activeKeywords * activeLocations}</strong> searches
      </div>
    </>
  )
}
