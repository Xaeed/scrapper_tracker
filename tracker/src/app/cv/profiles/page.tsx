'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

interface SampleCvMeta {
  fileName: string
  mimeType: string
  updatedAt: string
}

interface ProfileRow {
  id: string
  name: string
  fileName: string
  mimeType: string
  hasPdf: boolean
  createdAt: string
}

export default function CvProfilesPage() {
  const [sample, setSample] = useState<SampleCvMeta | null>(null)
  const [sampleLoading, setSampleLoading] = useState(true)
  const [sampleFile, setSampleFile] = useState<File | null>(null)
  const [sampleSaving, setSampleSaving] = useState(false)
  const [sampleError, setSampleError] = useState<string | null>(null)
  const [sampleSuccess, setSampleSuccess] = useState<string | null>(null)

  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [profilesLoading, setProfilesLoading] = useState(true)
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const isPdf = !!file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))

  const loadSample = useCallback(async () => {
    setSampleLoading(true)
    try {
      const res = await fetch('/api/sample-cv')
      const data = await res.json()
      setSample(data.sample ?? null)
    } finally {
      setSampleLoading(false)
    }
  }, [])

  const loadProfiles = useCallback(async () => {
    setProfilesLoading(true)
    try {
      const res = await fetch('/api/cv-profiles')
      const data = await res.json()
      setProfiles(Array.isArray(data.profiles) ? data.profiles : [])
    } finally {
      setProfilesLoading(false)
    }
  }, [])

  useEffect(() => { loadSample(); loadProfiles() }, [loadSample, loadProfiles])

  async function handleSampleUpload(e: React.FormEvent) {
    e.preventDefault()
    setSampleError(null)
    setSampleSuccess(null)
    if (!sampleFile || sampleFile.size === 0) { setSampleError('Please choose an HTML file.'); return }
    setSampleSaving(true)
    const form = new FormData()
    form.append('file', sampleFile)
    const res = await fetch('/api/sample-cv', { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))
    setSampleSaving(false)
    if (!res.ok) { setSampleError(typeof data.error === 'string' ? data.error : 'Failed to save sample CV'); return }
    setSampleSuccess('Sample CV template saved.')
    setSampleFile(null)
    loadSample()
  }

  async function handleSampleDelete() {
    if (!confirm('Clear the sample CV template? Future PDF uploads will use built-in styling.')) return
    setSampleError(null)
    const res = await fetch('/api/sample-cv', { method: 'DELETE' })
    if (res.ok) { setSample(null); setSampleSuccess('Sample CV template cleared.') }
    else { setSampleError('Could not clear sample CV.') }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (!name.trim()) { setError('Profile name is required.'); return }
    if (!file || file.size === 0) { setError('Please choose a CV file to upload.'); return }
    setSaving(true)
    const form = new FormData()
    form.append('name', name.trim())
    form.append('file', file)
    const res = await fetch('/api/cv-profiles', { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError(typeof data.error === 'string' ? data.error : 'Failed to save profile'); return }
    const label = data.source === 'pdf-converted' ? ' (PDF converted to HTML)' : ''
    setSuccess(`Profile "${data.name || name.trim()}" saved${label}.`)
    setName('')
    setFile(null)
    loadProfiles()
  }

  async function handleDelete(p: ProfileRow) {
    if (!confirm(`Delete profile "${p.name}"?`)) return
    setDeletingId(p.id)
    const res = await fetch(`/api/cv-profiles/${p.id}`, { method: 'DELETE' })
    setDeletingId(null)
    if (res.ok) setProfiles(prev => prev.filter(x => x.id !== p.id))
    else setError('Could not delete profile.')
  }

  return (
    <>
      <div className="top-bar">
        <Link href="/cv" className="btn">← Back to Create CV</Link>
        <h1 style={{ margin: 0 }}>CV profiles</h1>
      </div>

      {/* ── Sample CV Template ─────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 24, borderLeft: '3px solid var(--accent, #2563eb)' }}>
        <h2 style={{ marginTop: 0 }}>Sample CV template</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: 13 }}>
          Upload an HTML CV here to use as the style reference for all PDF-to-HTML conversions.
          Claude will copy the layout, CSS, and structure from this template while filling in content from the uploaded PDF.
          {!sample && ' No template set — a built-in style will be used instead.'}
        </p>

        {sampleLoading ? (
          <p className="text-muted" style={{ fontSize: 13 }}>Loading…</p>
        ) : sample ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{sample.fileName}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Updated {new Date(sample.updatedAt).toLocaleDateString('en-GB')}
            </span>
            <a
              href="/api/sample-cv/preview"
              target="_blank"
              rel="noopener noreferrer"
              className="btn"
              style={{ fontSize: 12, padding: '4px 10px' }}
              onClick={async e => {
                e.preventDefault()
                const res = await fetch('/api/sample-cv?html=1')
                const data = await res.json()
                if (data?.sample?.html) {
                  const w = window.open('', '_blank')
                  w?.document.write(data.sample.html)
                  w?.document.close()
                }
              }}
            >
              Preview
            </a>
            <button
              type="button"
              onClick={handleSampleDelete}
              className="btn"
              style={{ fontSize: 12, padding: '4px 10px', color: '#991b1b', borderColor: '#fecaca' }}
            >
              Clear template
            </button>
          </div>
        ) : null}

        <form onSubmit={handleSampleUpload} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <input
            type="file"
            accept=".html,.htm,text/html"
            onChange={e => setSampleFile(e.target.files?.[0] ?? null)}
          />
          <button type="submit" className="btn primary" disabled={sampleSaving} style={{ fontSize: 13 }}>
            {sampleSaving ? 'Saving…' : sample ? 'Replace template' : 'Set template'}
          </button>
        </form>

        {sampleError && (
          <div className="alert alert-error" style={{ marginTop: 12 }}>{sampleError}</div>
        )}
        {sampleSuccess && (
          <div className="alert" style={{ marginTop: 12, background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>
            {sampleSuccess}
          </div>
        )}
      </div>

      {/* ── Add profile ───────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Add profile</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: 13 }}>
          Upload an HTML or PDF CV. PDFs are converted to HTML by Claude
          {sample ? ', styled to match the sample template above.' : ' using built-in styling (set a sample template above for best results).'}
        </p>
        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Profile name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Backend Senior"
              style={{ maxWidth: 360, width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}
            />
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>CV file (HTML or PDF)</label>
            <input
              type="file"
              accept=".html,.htm,text/html,.pdf,application/pdf"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
            {isPdf && (
              <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                PDF detected — Claude will convert it to HTML using the{' '}
                {sample ? 'sample template above' : 'built-in style'} (may take ~60 seconds).
              </p>
            )}
          </div>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving
              ? (isPdf ? 'Converting PDF… (up to 60s)' : 'Saving…')
              : 'Save profile'}
          </button>
        </form>
        {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}
        {success && (
          <div className="alert" style={{ marginTop: 16, background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>
            {success}
          </div>
        )}
      </div>

      {/* ── Saved profiles ────────────────────────────────────────────── */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Saved profiles</h2>
        {profilesLoading ? (
          <p className="text-muted">Loading…</p>
        ) : profiles.length === 0 ? (
          <p className="text-muted">No custom profiles yet. Built-in DevOps and Backend remain available on the Create CV page.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>File</th>
                  <th>Added</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {profiles.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{p.fileName}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                      {new Date(p.createdAt).toLocaleDateString('en-GB')}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <a
                        href={`/api/cv-profiles/${p.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn"
                        style={{ fontSize: 12, padding: '4px 10px' }}
                      >
                        View HTML
                      </a>
                      {p.hasPdf && (
                        <a
                          href={`/api/cv-profiles/${p.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn"
                          style={{ fontSize: 12, padding: '4px 10px', marginLeft: 6 }}
                        >
                          Source PDF
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(p)}
                        disabled={deletingId === p.id}
                        style={{ fontSize: 12, padding: '4px 10px', color: '#991b1b', borderColor: '#fecaca', marginLeft: 6 }}
                      >
                        {deletingId === p.id ? '…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
