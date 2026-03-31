'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function AddJobPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [link, setLink] = useState('')
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ link, title, company, location, description }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Failed to add job')
      setSaving(false)
      return
    }

    router.push(`/jobs/${data.id}`)
  }

  return (
    <>
      <div className="top-bar">
        <Link href="/jobs" className="btn">← Back to Jobs</Link>
        <h1 style={{ margin: 0 }}>Add Job Manually</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: 20 }}>

          <div className="field" style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
              Job URL <span style={{ color: '#991b1b' }}>*</span>
            </label>
            <input
              type="url"
              value={link}
              onChange={e => setLink(e.target.value)}
              placeholder="https://www.linkedin.com/jobs/view/..."
              required
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="field">
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
                Job Title <span style={{ color: '#991b1b' }}>*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Senior DevOps Engineer"
                required
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}
              />
            </div>
            <div className="field">
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Company</label>
              <input
                type="text"
                value={company}
                onChange={e => setCompany(e.target.value)}
                placeholder="e.g. Acme GmbH"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}
              />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Location</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Berlin, Germany (Remote)"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}
            />
          </div>

          <div className="field">
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
              Job Description{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                (optional — paste from LinkedIn for CV tailoring)
              </span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Paste the full job description here…"
              rows={12}
              style={{
                width: '100%',
                resize: 'vertical',
                padding: '10px 12px',
                fontSize: 13,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontFamily: 'inherit',
                lineHeight: 1.6,
              }}
            />
          </div>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="btn primary" disabled={saving} style={{ minWidth: 120 }}>
            {saving ? 'Adding…' : 'Add Job'}
          </button>
          <Link href="/jobs" className="btn">Cancel</Link>
        </div>
      </form>
    </>
  )
}
