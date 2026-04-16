'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { DEFAULT_CV_TAILORING_PROMPT } from '@/lib/defaultCvTailoringPrompt'

interface Props {
  title?: string
  company?: string
  jobId?: string
}

interface CvResult {
  success: boolean
  profile: string
  file_name: string
  cv_html: string
  requested_at: string
}

interface SavedProfile {
  id: string
  name: string
}

type ProfileSelection = 'devops' | 'backend' | string

export default function CvForm({ title, company, jobId }: Props) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [profile, setProfile] = useState<ProfileSelection>('devops')
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>([])
  const [description, setDescription] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [loadingDescription, setLoadingDescription] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => setIsAdmin(data.user?.role === 'admin'))
      .catch(() => setIsAdmin(false))
  }, [])

  useEffect(() => {
    fetch('/api/cv-profiles')
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data.profiles) ? data.profiles : []
        setSavedProfiles(list.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
      })
      .catch(() => {})
  }, [])

  // Auto-fetch job description when opened from a job page
  useEffect(() => {
    if (!jobId) return
    setLoadingDescription(true)
    fetch(`/api/jobs/${jobId}`)
      .then(r => r.json())
      .then(data => {
        if (data.description) setDescription(data.description)
      })
      .finally(() => setLoadingDescription(false))
  }, [jobId])
  const [error, setError] = useState<string | null>(null)
  const [defaultPromptCopied, setDefaultPromptCopied] = useState(false)
  const [saveWarning, setSaveWarning] = useState<string | null>(null)
  const [result, setResult] = useState<CvResult | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    setLoading(true)
    setError(null)
    setSaveWarning(null)
    setResult(null)
    setSaved(false)

    try {
      const body: Record<string, string> = {
        job_description: description,
        ...(customPrompt.trim() ? { custom_prompt: customPrompt.trim() } : {}),
      }
      if (profile === 'devops' || profile === 'backend') {
        body.profile = profile
      } else {
        body.cv_profile_id = profile
      }

      const res = await fetch('/api/cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const text = await res.text()
      let parsed: unknown
      try {
        parsed = text ? JSON.parse(text) : null
      } catch {
        setError(
          res.ok
            ? 'Invalid response from server (not JSON).'
            : `Request failed (${res.status}). The server did not return JSON.`
        )
        return
      }
      if (!res.ok) {
        const msg =
          parsed && typeof parsed === 'object' && parsed !== null && 'error' in parsed
            ? String((parsed as { error: unknown }).error)
            : `Request failed (${res.status})`
        setError(msg || 'Something went wrong')
        return
      }

      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setError(
          'CV service returned an invalid payload (expected a JSON object with cv_html). Check the n8n workflow “Respond to Webhook” output.'
        )
        return
      }

      const data = parsed as CvResult & { error?: string }
      if (typeof data.cv_html !== 'string' || !data.cv_html.trim()) {
        setError(
          'CV service did not return HTML (cv_html). Ensure the n8n workflow returns the same field names the app expects (cv_html, profile, file_name, …).'
        )
        return
      }

      setResult(data)

      // Auto-save CV to the job (separate from /api/cv — failures must not look like "network" on generate)
      if (jobId) {
        try {
          const patchRes = await fetch(`/api/jobs/${jobId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cvHtml: data.cv_html }),
          })
          const patchText = await patchRes.text()
          let patchJson: { error?: string } = {}
          try {
            patchJson = patchText ? JSON.parse(patchText) : {}
          } catch {
            /* ignore */
          }
          if (patchRes.ok) {
            setSaved(true)
          } else {
            setSaveWarning(
              patchJson.error ||
                `Could not save CV to this job (HTTP ${patchRes.status}). You can still download it below.`
            )
          }
        } catch (patchErr) {
          const hint =
            patchErr instanceof TypeError
              ? ' (connection problem — check proxy/body limits if this is a remote server)'
              : ''
          setSaveWarning(`Could not save CV to the job${hint}. You can still download it below.`)
        }
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      const isFetchFailure =
        (err instanceof TypeError &&
          /failed to fetch|load failed|fetch|network|aborted/i.test(detail)) ||
        (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError')
      setError(
        isFetchFailure
          ? `Could not complete the request to generate a CV (${detail}). If the tracker is running, a reverse proxy may be closing long requests — increase timeout for /api/cv, or ensure n8n is reachable from the server.`
          : `Something went wrong: ${detail}`
      )
    } finally {
      setLoading(false)
    }
  }

  async function copyDefaultAtsPrompt() {
    try {
      await navigator.clipboard.writeText(DEFAULT_CV_TAILORING_PROMPT)
      setDefaultPromptCopied(true)
      setTimeout(() => setDefaultPromptCopied(false), 2500)
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = DEFAULT_CV_TAILORING_PROMPT
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        setDefaultPromptCopied(true)
        setTimeout(() => setDefaultPromptCopied(false), 2500)
      } catch {
        window.alert('Could not copy automatically. Open “Show default prompt” below and copy manually.')
      }
    }
  }

  function appendDefaultToCustomPrompt() {
    setCustomPrompt(prev => {
      const d = DEFAULT_CV_TAILORING_PROMPT
      const p = prev.trim()
      if (!p) return d
      return `${p}\n\n${d}`
    })
  }

  function downloadCv() {
    if (!result) return
    const blob = new Blob([result.cv_html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = result.file_name
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="top-bar">
        {jobId && <Link href={`/jobs/${jobId}`} className="btn">← Back to Job</Link>}
        <h1 style={{ margin: 0 }}>Create CV</h1>
      </div>

      {(title || company) && (
        <div className="card" style={{ marginBottom: 20, background: '#eff6ff', borderColor: '#bfdbfe' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 2 }}>Generating CV for:</p>
          <p style={{ fontWeight: 600 }}>{title}{company ? ` · ${company}` : ''}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="field" style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>CV profile</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <select
                value={profile}
                onChange={e => setProfile(e.target.value)}
                style={{ maxWidth: 320 }}
              >
                <option value="devops">Built-in: DevOps</option>
                <option value="backend">Built-in: Backend</option>
                {savedProfiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {isAdmin && (
                <Link href="/cv/profiles" className="btn" style={{ fontSize: 12, padding: '4px 10px' }}>
                  Manage profiles…
                </Link>
              )}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, marginBottom: 0 }}>
              {isAdmin
                ? 'Custom profiles use HTML files you upload under Manage profiles. Built-in templates use the server-side n8n paths.'
                : 'Custom profiles are uploaded by an administrator; everyone can use them here. Built-in templates use the server-side n8n paths.'}
            </p>
          </div>

          <div className="field" style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
              Job Description{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                {loadingDescription ? '(loading from job…)' : '(paste from LinkedIn or saved from job page)'}
              </span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Paste the full job description here…"
              required
              style={{
                width: '100%',
                minHeight: 300,
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

          <div className="field">
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
              Custom prompt{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                (optional — overrides the default ATS-friendly tailoring instructions)
              </span>
            </label>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
              Leave empty to use the built-in default. To tweak it, copy the default text (or append it into the box), edit, then generate — profile, job description, and base CV are still added automatically by the workflow.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <button
                type="button"
                className="btn"
                style={{ fontSize: 12, padding: '5px 12px' }}
                onClick={() => void copyDefaultAtsPrompt()}
              >
                {defaultPromptCopied ? 'Copied ✓' : 'Copy default ATS prompt'}
              </button>
              <button
                type="button"
                className="btn"
                style={{ fontSize: 12, padding: '5px 12px' }}
                onClick={appendDefaultToCustomPrompt}
              >
                Append default to field
              </button>
            </div>
            <details style={{ marginBottom: 12, fontSize: 13 }}>
              <summary style={{ cursor: 'pointer', color: 'var(--primary)', fontWeight: 500 }}>
                Show default prompt (read-only reference)
              </summary>
              <pre
                style={{
                  marginTop: 10,
                  padding: 12,
                  background: 'var(--bg-muted, #f8fafc)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  fontSize: 12,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: 220,
                  overflow: 'auto',
                }}
              >
                {DEFAULT_CV_TAILORING_PROMPT}
              </pre>
            </details>
            <textarea
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              placeholder="Optional — paste and edit the default prompt above, or write your own. Job description and base CV HTML are appended automatically after this text."
              style={{
                width: '100%',
                minHeight: 120,
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

        <button
          type="submit"
          className="btn primary"
          disabled={loading || !description.trim()}
          style={{ minWidth: 140, justifyContent: 'center' }}
        >
          {loading ? 'Generating…' : 'Generate CV'}
        </button>
      </form>

      {error && (
        <div className="alert alert-error" style={{ marginTop: 20 }}>
          {error}
        </div>
      )}

      {saveWarning && (
        <div className="alert" style={{ marginTop: 20, background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e' }}>
          {saveWarning}
        </div>
      )}

      {result && (
        <div className="card" style={{ marginTop: 24, borderColor: '#bbf7d0', background: '#f0fdf4' }}>
          <h2 style={{ color: '#166534', marginBottom: 8 }}>CV Generated Successfully</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
            Profile: <strong>{result.profile}</strong> · File: <strong>{result.file_name}</strong>
            {saved && <span style={{ marginLeft: 12, color: '#166534' }}>· Saved to job ✓</span>}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={downloadCv}>Download CV</button>
            {jobId && saved && (
              <Link href={`/jobs/${jobId}`} className="btn" style={{ color: '#1d4ed8', borderColor: '#bfdbfe' }}>
                View on Job Page ↗
              </Link>
            )}
            <button
              className="btn"
              onClick={() => { setResult(null); setDescription(''); setSaved(false) }}
              style={{ marginLeft: 'auto' }}
            >
              Create another
            </button>
          </div>
        </div>
      )}
    </>
  )
}
