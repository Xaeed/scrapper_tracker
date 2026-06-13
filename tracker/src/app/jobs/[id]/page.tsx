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
  appliedProfiles?: string
  createdAt: string
  updatedAt: string
}

interface JobCvMeta {
  id: string
  profileKey: string
  profileName: string
  cvProfileId: string | null
  fileName: string | null
  createdAt: string
}

interface AppliedProfile {
  key: string
  name: string
}

interface ProfileOption {
  key: string
  name: string
  builtin: boolean
}

const BUILTIN_PROFILES: ProfileOption[] = [
  { key: 'devops', name: 'DevOps', builtin: true },
  { key: 'backend', name: 'Backend', builtin: true },
]

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
  const [jobCvs, setJobCvs] = useState<JobCvMeta[]>([])
  const [previewCvId, setPreviewCvId] = useState<string | null>(null)
  const [deletingCvId, setDeletingCvId] = useState<string | null>(null)
  const [savedProfiles, setSavedProfiles] = useState<ProfileOption[]>([])
  const [applied, setApplied] = useState<AppliedProfile[]>([])
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
          try {
            const arr = JSON.parse(data.appliedProfiles || '[]') as unknown
            setApplied(
              Array.isArray(arr)
                ? arr
                    .filter((p): p is AppliedProfile => !!p && typeof p === 'object' && 'key' in p && 'name' in p)
                    .map(p => ({ key: String(p.key), name: String(p.name) }))
                : []
            )
          } catch {
            setApplied([])
          }
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    fetch(`/api/jobs/${id}/cvs`)
      .then(r => r.json())
      .then(data => setJobCvs(Array.isArray(data.cvs) ? data.cvs : []))
      .catch(() => {})
  }, [id])

  useEffect(() => {
    fetch('/api/cv-profiles')
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data.profiles) ? data.profiles : []
        setSavedProfiles(list.map((p: { id: string; name: string }) => ({ key: p.id, name: p.name, builtin: false })))
      })
      .catch(() => {})
  }, [])

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
        appliedProfiles: applied,
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

  async function handleDeleteJobCv(cv: JobCvMeta) {
    if (!confirm(`Delete the "${cv.profileName}" CV for this job?`)) return
    setDeletingCvId(cv.id)
    const res = await fetch(`/api/jobs/${id}/cvs/${cv.id}`, { method: 'DELETE' })
    if (res.ok) {
      setJobCvs(prev => prev.filter(c => c.id !== cv.id))
      setPreviewCvId(prev => (prev === cv.id ? null : prev))
    }
    setDeletingCvId(null)
  }

  function toggleApplied(opt: ProfileOption) {
    setApplied(prev =>
      prev.some(a => a.key === opt.key)
        ? prev.filter(a => a.key !== opt.key)
        : [...prev, { key: opt.key, name: opt.name }]
    )
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

  // Union of all selectable profiles + any applied profile whose source no longer exists.
  const appliedOptions: ProfileOption[] = [
    ...BUILTIN_PROFILES,
    ...savedProfiles,
    ...applied
      .filter(a => ![...BUILTIN_PROFILES, ...savedProfiles].some(o => o.key === a.key))
      .map(a => ({ key: a.key, name: a.name, builtin: false })),
  ]

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
              job.importMethod === 'manual'
                ? ['Added at', fmt(job.createdAt)]
                : ['Scraped at', fmt(job.scrapedAt)],
              ['Search keyword', job.searchKeyword],
              ['Search location', job.searchLocation],
              ['Import method', job.importMethod === 'manual' ? 'manual' : 'scraped'],
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
              className="status-select"
              data-status={job.status}
              value={job.status}
              onChange={e => setJob({ ...job, status: e.target.value })}
              style={{ maxWidth: 200 }}
            >
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Applied with profiles</label>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '8px 10px',
              }}
            >
              {appliedOptions.map(opt => (
                <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={applied.some(a => a.key === opt.key)}
                    onChange={() => toggleApplied(opt)}
                  />
                  <span>
                    {opt.name}
                    {opt.builtin && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}> · built-in</span>}
                  </span>
                </label>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Tick every profile you applied to this job with. Saved with the Save button below.
            </p>
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

        {/* Generated CVs — one per profile */}
        <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: jobCvs.length ? 12 : 0, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 500, minWidth: 120, color: 'var(--text-muted)' }}>Generated CVs</span>
            <a
              href={`/cv?jobId=${id}&title=${encodeURIComponent(job.title)}&company=${encodeURIComponent(job.company)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn"
              style={{ fontSize: 12, padding: '4px 12px' }}
            >
              {jobCvs.length ? 'Generate more ↗' : 'Create CVs ↗'}
            </a>
          </div>

          {jobCvs.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              No profile CVs yet — generate one or more above.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {jobCvs.map(cv => (
                <div key={cv.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, minWidth: 160 }}>{cv.profileName}</span>
                    <a
                      href={`/api/jobs/${id}/cvs/${cv.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn primary"
                      style={{ fontSize: 12, padding: '4px 12px' }}
                    >
                      View ↗
                    </a>
                    <a
                      href={`/api/jobs/${id}/cvs/${cv.id}`}
                      download={cv.fileName || `cv-${cv.profileName.replace(/\s+/g, '-').toLowerCase()}.html`}
                      className="btn"
                      style={{ fontSize: 12, padding: '4px 12px' }}
                    >
                      Download
                    </a>
                    <button
                      onClick={() => setPreviewCvId(prev => (prev === cv.id ? null : cv.id))}
                      className="btn"
                      style={{ fontSize: 12, padding: '4px 12px' }}
                    >
                      {previewCvId === cv.id ? 'Hide Preview' : 'Preview'}
                    </button>
                    <button
                      onClick={() => handleDeleteJobCv(cv)}
                      disabled={deletingCvId === cv.id}
                      style={{ fontSize: 12, padding: '4px 10px', color: '#991b1b', borderColor: '#fecaca' }}
                    >
                      {deletingCvId === cv.id ? '…' : 'Delete'}
                    </button>
                  </div>
                  {previewCvId === cv.id && (
                    <iframe
                      src={`/api/jobs/${id}/cvs/${cv.id}`}
                      style={{ width: '100%', height: 780, border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginTop: 10 }}
                      title={`CV Preview — ${cv.profileName}`}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Legacy single CV (pre-dates per-profile CVs) */}
          {job.cvHtml && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, minWidth: 160, color: 'var(--text-muted)' }}>Legacy CV</span>
                <a
                  href={`/api/jobs/${id}/cv`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn"
                  style={{ fontSize: 12, padding: '4px 12px' }}
                >
                  View ↗
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
                  {deletingCv ? '…' : 'Delete'}
                </button>
              </div>
              {showCvPreview && (
                <iframe
                  src={`/api/jobs/${id}/cv`}
                  style={{ width: '100%', height: 780, border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginTop: 10 }}
                  title="Legacy CV Preview"
                />
              )}
            </div>
          )}
        </div>

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
