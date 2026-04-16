'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

interface ProfileRow {
  id: string
  name: string
  fileName: string
  mimeType: string
  createdAt: string
}

export default function CvProfilesPage() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/cv-profiles')
      const data = await res.json()
      setProfiles(Array.isArray(data.profiles) ? data.profiles : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (!name.trim()) {
      setError('Profile name is required.')
      return
    }
    if (!file || file.size === 0) {
      setError('Please choose a CV file to upload.')
      return
    }
    setSaving(true)
    const form = new FormData()
    form.append('name', name.trim())
    form.append('file', file)
    const res = await fetch('/api/cv-profiles', { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Failed to save profile')
      return
    }
    setSuccess(`Profile “${data.name || name.trim()}” saved.`)
    setName('')
    setFile(null)
    load()
  }

  async function handleDelete(p: ProfileRow) {
    if (!confirm(`Delete profile “${p.name}”?`)) return
    setDeletingId(p.id)
    const res = await fetch(`/api/cv-profiles/${p.id}`, { method: 'DELETE' })
    setDeletingId(null)
    if (res.ok) {
      setProfiles(prev => prev.filter(x => x.id !== p.id))
    } else {
      setError('Could not delete profile.')
    }
  }

  return (
    <>
      <div className="top-bar">
        <Link href="/cv" className="btn">← Back to Create CV</Link>
        <h1 style={{ margin: 0 }}>CV profiles</h1>
      </div>

      <p style={{ color: 'var(--text-muted)', marginBottom: 20, maxWidth: 720 }}>
        Upload HTML-based CVs to use as the base for tailored CV generation (same pipeline as the built-in DevOps/Backend templates).
        PDF/Word are not supported — export or save your CV as HTML first.
      </p>

      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Add profile</h2>
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
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>CV file (HTML)</label>
            <input
              type="file"
              accept=".html,.htm,text/html"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
        {error && (
          <div className="alert alert-error" style={{ marginTop: 16 }}>
            {error}
          </div>
        )}
        {success && (
          <div className="alert" style={{ marginTop: 16, background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>
            {success}
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Saved profiles</h2>
        {loading ? (
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
                        View CV
                      </a>
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
