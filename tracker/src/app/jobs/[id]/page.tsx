'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

interface Job {
  id: string
  linkedinId: string | null
  title: string
  company: string
  location: string | null
  link: string
  postedAt: string | null
  searchKeyword: string | null
  searchLocation: string | null
  scrapedAt: string | null
  status: string
  description: string | null
  notes: string | null
  cvHtml: string | null
  attachmentName: string | null
  attachmentType: string | null
  importMethod?: string
  tags?: string
  createdAt: string
  updatedAt: string
}

const STATUSES = ['NEW', 'VIEWED', 'READY', 'APPLIED', 'REJECTED', 'NOT_INTERESTED']

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showCvPreview, setShowCvPreview] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [removingAttachment, setRemovingAttachment] = useState(false)
  const [deletingCv, setDeletingCv] = useState(false)
  const [tagsInput, setTagsInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/jobs/${id}`)
      .then(r => { if (r.status === 404) { setNotFound(true); return null } return r.json() })
      .then(data => {
        if (data) {
          setJob(data)
          try {
            const arr = JSON.parse(data.tags || '[]') as unknown
            setTagsInput(Array.isArray(arr) ? arr.map(String).join(', ') : '')
          } catch {
            setTagsInput('')
          }
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  async function handleDelete() {
    if (!job) return
    if (!confirm(`Delete "${job.title}" at ${job.company}? This cannot be undone.`)) return
    setDeleting(true)
    await fetch(`/api/jobs/${id}`, { method: 'DELETE' })
    router.push('/jobs')
  }

  async function save() {
    if (!job) return
    setSaving(true)
    const tagList = tagsInput
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    const res = await fetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: job.status,
        notes: job.notes,
        description: job.description,
        tags: tagList,
      }),
    })
    const data = await res.json().catch(() => null)
    if (res.ok && data && typeof data === 'object' && 'id' in data) {
      setJob(data as Job)
      try {
        const arr = JSON.parse((data as Job).tags || '[]') as unknown
        setTagsInput(Array.isArray(arr) ? arr.map(String).join(', ') : '')
      } catch {
        /* keep */
      }
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`/api/jobs/${id}/attachment`, { method: 'POST', body: form })
    const data = await res.json()
    if (res.ok) {
      setJob(prev => prev ? { ...prev, attachmentName: data.name, attachmentType: data.type } : prev)
    } else {
      alert(data.error || 'Upload failed')
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleDeleteCv() {
    if (!confirm('Delete the generated CV for this job?')) return
    setDeletingCv(true)
    await fetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cvHtml: null }),
    })
    setJob(prev => prev ? { ...prev, cvHtml: null } : prev)
    setShowCvPreview(false)
    setDeletingCv(false)
  }

  async function handleRemoveAttachment() {
    if (!confirm('Remove this attachment?')) return
    setRemovingAttachment(true)
    await fetch(`/api/jobs/${id}/attachment`, { method: 'DELETE' })
    setJob(prev => prev ? { ...prev, attachmentName: null, attachmentType: null } : prev)
    setRemovingAttachment(false)
  }

  if (loading) return <p className="text-muted">Loading…</p>
  if (notFound) return (
    <>
      <div className="alert alert-error">Job not found.</div>
      <Link href="/jobs" className="btn">← Back to Jobs</Link>
    </>
  )
  if (!job) return null

  return (
    <>
      <div className="top-bar">
        <Link href="/jobs" className="btn">← Back</Link>
        <a
          href={`/cv?jobId=${id}&title=${encodeURIComponent(job.title)}&company=${encodeURIComponent(job.company)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn primary"
        >
          {job.cvHtml ? 'Regenerate CV ↗' : 'Create CV ↗'}
        </a>
        <a
          href={job.link}
          target="_blank"
          rel="noopener noreferrer"
          className="btn"
          title="Open the original posting (e.g. LinkedIn)"
        >
          Original post ↗
        </a>
        <button
          onClick={handleDelete}
          disabled={deleting}
          style={{ marginLeft: 'auto', color: '#991b1b', borderColor: '#fecaca' }}
        >
          {deleting ? 'Deleting…' : 'Delete Job'}
        </button>
      </div>

      <h1 style={{ marginBottom: 4 }}>{job.title}</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
        {job.company}{job.location ? ` · ${job.location}` : ''}
      </p>
      <p style={{ marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span
          className="badge"
          style={
            job.importMethod === 'manual'
              ? { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }
              : { background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' }
          }
        >
          {job.importMethod === 'manual' ? 'Manually imported' : 'Scraped'}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Job URL:{' '}
          <a href={job.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
            {job.link}
          </a>
        </span>
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Info card */}
        <div className="card">
          <h2>Details</h2>
          <div className="detail-grid">
            {[
              ['LinkedIn ID', job.linkedinId],
              ['Posted', fmt(job.postedAt)],
              ['Scraped at', fmt(job.scrapedAt)],
              ['Search keyword', job.searchKeyword],
              ['Search location', job.searchLocation],
              ['Import method', job.importMethod === 'manual' ? 'manual' : 'scraped'],
              ['Created in app', fmt(job.createdAt)],
              ['Last updated', fmt(job.updatedAt)],
            ].map(([k, v]) => (
              <div key={String(k)} className="detail-row">
                <span className="key">{k}</span>
                <span className="val">{v || '—'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Edit card */}
        <div className="card">
          <h2>Status &amp; Notes</h2>
          <div className="field">
            <label>Status</label>
            <select
              value={job.status}
              onChange={e => setJob({ ...job, status: e.target.value })}
              style={{ maxWidth: 200 }}
            >
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Tags</label>
            <input
              type="text"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="devops, azure, kubernetes — comma-separated"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}
            />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Saved with Status &amp; Notes (Save below). Duplicates and casing are normalized.</p>
          </div>
          <div className="field">
            <label>Job Description</label>
            <textarea
              className="notes-area"
              value={job.description ?? ''}
              placeholder="Paste the job description here — used to auto-fill CV creation…"
              rows={6}
              onChange={e => setJob({ ...job, description: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea
              className="notes-area"
              value={job.notes ?? ''}
              placeholder="Add private notes about this job…"
              onChange={e => setJob({ ...job, notes: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            {saved && <span style={{ color: '#166534', fontSize: 13 }}>Saved ✓</span>}
          </div>
        </div>
      </div>

      {/* CV & Attachments */}
      <div className="card">
        <h2>CV &amp; Attachments</h2>

        {/* Generated CV row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 16, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 500, minWidth: 120, color: 'var(--text-muted)' }}>Generated CV</span>
          {job.cvHtml ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <a
                href={`/api/jobs/${id}/cv`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn primary"
                style={{ fontSize: 12, padding: '4px 12px' }}
              >
                View CV ↗
              </a>
              <a
                href={`/api/jobs/${id}/cv`}
                download={`cv-${job.title.replace(/\s+/g, '-').toLowerCase()}.html`}
                className="btn"
                style={{ fontSize: 12, padding: '4px 12px' }}
              >
                Download
              </a>
              <button
                onClick={() => setShowCvPreview(p => !p)}
                className="btn"
                style={{ fontSize: 12, padding: '4px 12px' }}
              >
                {showCvPreview ? 'Hide Preview' : 'Preview'}
              </button>
              <button
                onClick={handleDeleteCv}
                disabled={deletingCv}
                style={{ fontSize: 12, padding: '4px 10px', color: '#991b1b', borderColor: '#fecaca' }}
              >
                {deletingCv ? '…' : 'Delete CV'}
              </button>
            </div>
          ) : (
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              No CV yet —{' '}
              <a
                href={`/cv?jobId=${id}&title=${encodeURIComponent(job.title)}&company=${encodeURIComponent(job.company)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--primary)' }}
              >
                Create one ↗
              </a>
            </span>
          )}
        </div>

        {/* Inline CV preview (toggle) */}
        {showCvPreview && job.cvHtml && (
          <div style={{ marginBottom: 16 }}>
            <iframe
              src={`/api/jobs/${id}/cv`}
              style={{ width: '100%', height: 780, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
              title="CV Preview"
            />
          </div>
        )}

        {/* Manual attachment row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 500, minWidth: 120, color: 'var(--text-muted)' }}>Attachment</span>
          {job.attachmentName ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--text)' }}>{job.attachmentName}</span>
              <a
                href={`/api/jobs/${id}/attachment`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
                style={{ fontSize: 12, padding: '4px 12px' }}
              >
                View ↗
              </a>
              <a
                href={`/api/jobs/${id}/attachment`}
                download={job.attachmentName}
                className="btn"
                style={{ fontSize: 12, padding: '4px 12px' }}
              >
                Download
              </a>
              <button
                onClick={handleRemoveAttachment}
                disabled={removingAttachment}
                style={{ fontSize: 12, padding: '4px 10px', color: '#991b1b', borderColor: '#fecaca' }}
              >
                {removingAttachment ? '…' : 'Remove'}
              </button>
            </div>
          ) : (
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>None</span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.html,.htm,.txt"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          <button
            className="btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{ fontSize: 12, padding: '4px 12px', marginLeft: job.attachmentName ? 0 : 0 }}
          >
            {uploading ? 'Uploading…' : job.attachmentName ? 'Replace' : 'Upload file'}
          </button>
        </div>
      </div>
    </>
  )
}
