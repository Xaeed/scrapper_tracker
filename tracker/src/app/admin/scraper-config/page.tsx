'use client'

import { useEffect, useRef, useState } from 'react'

interface Config {
  keywords: string[]
  locations: string[]
  excludedCompanies: string[]
  updatedAt: string
}

export default function ScraperConfigPage() {
  const [keywords, setKeywords] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [excludedCompanies, setExcludedCompanies] = useState<string[]>([])
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
        setUpdatedAt(data.updatedAt)
        setLoading(false)
      })
  }, [])

  function addKeyword() {
    const val = kwInput.current?.value.trim()
    if (!val) return
    if (!keywords.includes(val)) setKeywords(prev => [...prev, val])
    kwInput.current!.value = ''
  }

  function addLocation() {
    const val = locInput.current?.value.trim()
    if (!val) return
    if (!locations.includes(val)) setLocations(prev => [...prev, val])
    locInput.current!.value = ''
  }

  function addExcludedCompany() {
    const val = exclInput.current?.value.trim()
    if (!val) return
    if (!excludedCompanies.includes(val)) setExcludedCompanies(prev => [...prev, val])
    exclInput.current!.value = ''
  }

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/scraper-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords, locations, excludedCompanies }),
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

  return (
    <>
      <div className="top-bar">
        <h1 style={{ margin: 0 }}>Scraper Config</h1>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {updatedAt ? `Last saved: ${new Date(updatedAt).toLocaleString('en-GB')}` : ''}
        </span>
        <button
          className="btn primary"
          onClick={save}
          disabled={saving || keywords.length === 0 || locations.length === 0}
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Changes'}
        </button>
      </div>

      {error && (
        <div style={{ margin: '0 0 16px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#991b1b', fontSize: 14 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

        {/* Keywords */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Search Keywords <span className="text-muted text-sm">({keywords.length})</span></h2>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>
            LinkedIn job title terms. The scraper already filters by contract type — no need to add "Contract".
          </p>

          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {keywords.map(kw => (
              <li key={kw} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }}>
                <span style={{ flex: 1 }}>{kw}</span>
                <button
                  onClick={() => setKeywords(prev => prev.filter(k => k !== kw))}
                  style={{ padding: '2px 8px', fontSize: 12, color: '#991b1b', borderColor: '#fecaca', lineHeight: 1.4 }}
                  title="Remove"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={kwInput}
              type="text"
              placeholder="e.g. Azure Data Engineer"
              style={{ flex: 1 }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }}
            />
            <button className="btn primary" onClick={addKeyword}>Add</button>
          </div>
        </div>

        {/* Locations */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Target Countries <span className="text-muted text-sm">({locations.length})</span></h2>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>
            LinkedIn location filter values. Use country names exactly as LinkedIn recognises them.
          </p>

          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {locations.map(loc => (
              <li key={loc} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }}>
                <span style={{ flex: 1 }}>{loc}</span>
                <button
                  onClick={() => setLocations(prev => prev.filter(l => l !== loc))}
                  style={{ padding: '2px 8px', fontSize: 12, color: '#991b1b', borderColor: '#fecaca', lineHeight: 1.4 }}
                  title="Remove"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={locInput}
              type="text"
              placeholder="e.g. Switzerland"
              style={{ flex: 1 }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLocation() } }}
            />
            <button className="btn primary" onClick={addLocation}>Add</button>
          </div>
        </div>

      </div>

      {/* Excluded Companies */}
      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Excluded Companies <span className="text-muted text-sm">({excludedCompanies.length})</span></h2>
        </div>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>
          Jobs from these companies are hidden from the jobs list. Partial name matching — e.g. "peopleworth" will hide any company containing that word.
        </p>

        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {excludedCompanies.map(company => (
            <li key={company} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 20, fontSize: 13 }}>
              <span style={{ color: '#991b1b' }}>{company}</span>
              <button
                onClick={() => setExcludedCompanies(prev => prev.filter(c => c !== company))}
                style={{ padding: '0 4px', fontSize: 12, color: '#991b1b', border: 'none', background: 'none', cursor: 'pointer', lineHeight: 1 }}
                title="Remove"
              >
                ✕
              </button>
            </li>
          ))}
          {excludedCompanies.length === 0 && (
            <li style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No companies excluded — all jobs are shown.</li>
          )}
        </ul>

        <div style={{ display: 'flex', gap: 8, maxWidth: 480 }}>
          <input
            ref={exclInput}
            type="text"
            placeholder="e.g. peopleworth"
            style={{ flex: 1 }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addExcludedCompany() } }}
          />
          <button className="btn primary" onClick={addExcludedCompany}>Add</button>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)' }}>
        <strong style={{ color: 'var(--text)' }}>Total searches per run:</strong>{' '}
        {keywords.length} keywords × {locations.length} locations = <strong style={{ color: 'var(--primary)' }}>{keywords.length * locations.length}</strong> searches
      </div>
    </>
  )
}
