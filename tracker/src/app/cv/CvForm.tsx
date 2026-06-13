'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_CV_TAILORING_PROMPT } from '@/lib/defaultCvTailoringPrompt'

interface Props {
  title?: string
  company?: string
  jobId?: string
}

interface SavedProfile {
  id: string
  name: string
}

interface ProfileOption {
  key: string // 'devops' | 'backend' | <CvProfile.id>
  name: string
  builtin: boolean
}

interface GenResult {
  key: string
  name: string
  status: 'pending' | 'running' | 'done' | 'error'
  cv_html?: string
  file_name?: string
  profile?: string
  saved?: boolean
  saveWarning?: string
  error?: string
}

const BUILTINS: ProfileOption[] = [
  { key: 'devops', name: 'DevOps', builtin: true },
  { key: 'backend', name: 'Backend', builtin: true },
]

export default function CvForm({ title, company, jobId }: Props) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>([])
  const [selectedKeys, setSelectedKeys] = useState<string[]>(['devops'])
  const [description, setDescription] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [loadingDescription, setLoadingDescription] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [defaultPromptCopied, setDefaultPromptCopied] = useState(false)
  const [results, setResults] = useState<GenResult[]>([])

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

  const available: ProfileOption[] = useMemo(
    () => [...BUILTINS, ...savedProfiles.map(p => ({ key: p.id, name: p.name, builtin: false }))],
    [savedProfiles]
  )

  function toggleProfile(key: string) {
    setSelectedKeys(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]))
  }

  async function generateForProfile(p: ProfileOption): Promise<GenResult> {
    const body: Record<string, string> = {
      job_description: description,
      ...(customPrompt.trim() ? { custom_prompt: customPrompt.trim() } : {}),
    }
    if (p.builtin) body.profile = p.key
    else body.cv_profile_id = p.key

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
      throw new Error(
        res.ok
          ? 'Invalid response from server (not JSON).'
          : `Request failed (${res.status}). The server did not return JSON.`
      )
    }
    if (!res.ok) {
      const msg =
        parsed && typeof parsed === 'object' && parsed !== null && 'error' in parsed
          ? String((parsed as { error: unknown }).error)
          : `Request failed (${res.status})`
      throw new Error(msg || 'Something went wrong')
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(
        'CV service returned an invalid payload (expected a JSON object with cv_html). Check the n8n workflow “Respond to Webhook” output.'
      )
    }
    const data = parsed as { cv_html?: string; file_name?: string; profile?: string }
    if (typeof data.cv_html !== 'string' || !data.cv_html.trim()) {
      throw new Error(
        'CV service did not return HTML (cv_html). Ensure the n8n workflow returns the same field names the app expects (cv_html, profile, file_name, …).'
      )
    }
    return {
      key: p.key,
      name: p.name,
      status: 'done',
      cv_html: data.cv_html,
      file_name: data.file_name,
      profile: data.profile,
    }
  }

  async function saveCvToJob(p: ProfileOption, cvHtml: string, fileName?: string): Promise<void> {
    const res = await fetch(`/api/jobs/${jobId}/cvs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileKey: p.key,
        profileName: p.name,
        cvProfileId: p.builtin ? null : p.key,
        cvHtml,
        fileName,
      }),
    })
    if (!res.ok) {
      let msg = `HTTP ${res.status}`
      try {
        const j = JSON.parse((await res.text()) || '{}')
        if (j && j.error) msg = String(j.error)
      } catch {
        /* ignore */
      }
      throw new Error(msg)
    }
  }

  function setResult(key: string, patch: Partial<GenResult>) {
    setResults(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!description.trim()) return
    if (selectedKeys.length === 0) {
      setError('Select at least one CV profile.')
      return
    }

    const selected = available.filter(p => selectedKeys.includes(p.key))
    setLoading(true)
    setResults(selected.map(p => ({ key: p.key, name: p.name, status: 'pending' as const })))

    // Sequential — n8n calls are slow and the server is small (1 vCPU / 1GB).
    for (const p of selected) {
      setResult(p.key, { status: 'running' })
      try {
        const gen = await generateForProfile(p)
        let saved: boolean | undefined
        let saveWarning: string | undefined
        if (jobId && gen.cv_html) {
          try {
            await saveCvToJob(p, gen.cv_html, gen.file_name)
            saved = true
          } catch (err) {
            saveWarning =
              (err instanceof Error ? err.message : 'Could not save') +
              ' — you can still download it below.'
          }
        }
        setResult(p.key, { ...gen, saved, saveWarning })
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err)
        const isFetchFailure =
          err instanceof TypeError &&
          /failed to fetch|load failed|fetch|network|aborted/i.test(detail)
        setResult(p.key, {
          status: 'error',
          error: isFetchFailure
            ? `Could not reach the CV service (${detail}). A reverse proxy may be closing long requests, or n8n is unreachable.`
            : detail,
        })
      }
    }

    setLoading(false)
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

  function downloadResult(r: GenResult) {
    if (!r.cv_html) return
    const blob = new Blob([r.cv_html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = r.file_name || `cv-${r.name.replace(/\s+/g, '-').toLowerCase()}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const doneCount = results.filter(r => r.status === 'done').length
  const totalCount = results.length

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
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
              CV profiles{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                (select one or more — a separate CV is generated for each)
              </span>
            </label>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '10px 12px',
                maxWidth: 420,
              }}
            >
              {available.map(p => (
                <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedKeys.includes(p.key)}
                    onChange={() => toggleProfile(p.key)}
                  />
                  <span>
                    {p.name}
                    {p.builtin && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}> · built-in</span>}
                  </span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 8 }}>
              {isAdmin && (
                <Link href="/cv/profiles" className="btn" style={{ fontSize: 12, padding: '4px 10px' }}>
                  Manage profiles…
                </Link>
              )}
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {selectedKeys.length} selected
              </span>
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
              Leave empty to use the built-in default. To tweak it, copy the default text (or append it into the box), edit, then generate — profile, job description, and base CV are still added automatically by the workflow. The same prompt is applied to every selected profile.
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
          disabled={loading || !description.trim() || selectedKeys.length === 0}
          style={{ minWidth: 160, justifyContent: 'center' }}
        >
          {loading
            ? `Generating… (${doneCount}/${totalCount})`
            : `Generate ${selectedKeys.length > 1 ? `${selectedKeys.length} CVs` : 'CV'}`}
        </button>
      </form>

      {error && (
        <div className="alert alert-error" style={{ marginTop: 20 }}>
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <h2 style={{ marginBottom: 12 }}>
            {loading ? 'Generating CVs…' : 'Results'}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {results.map(r => (
              <div
                key={r.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  background:
                    r.status === 'done' ? '#f0fdf4' : r.status === 'error' ? '#fef2f2' : 'transparent',
                }}
              >
                <span style={{ fontWeight: 600, minWidth: 160 }}>{r.name}</span>
                {r.status === 'pending' && <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Queued…</span>}
                {r.status === 'running' && <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Generating…</span>}
                {r.status === 'done' && (
                  <>
                    <span style={{ color: '#166534', fontSize: 13 }}>
                      ✓ Generated
                      {jobId && (r.saved ? ' · saved to job' : '')}
                    </span>
                    <button
                      type="button"
                      className="btn primary"
                      style={{ fontSize: 12, padding: '4px 12px' }}
                      onClick={() => downloadResult(r)}
                    >
                      Download
                    </button>
                    {r.saveWarning && (
                      <span style={{ color: '#92400e', fontSize: 12 }}>{r.saveWarning}</span>
                    )}
                  </>
                )}
                {r.status === 'error' && (
                  <span style={{ color: '#991b1b', fontSize: 13 }}>✗ {r.error}</span>
                )}
              </div>
            ))}
          </div>
          {!loading && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
              {jobId && doneCount > 0 && (
                <Link href={`/jobs/${jobId}`} className="btn" style={{ color: '#1d4ed8', borderColor: '#bfdbfe' }}>
                  View on Job Page ↗
                </Link>
              )}
              <button
                type="button"
                className="btn"
                onClick={() => { setResults([]); setError(null) }}
                style={{ marginLeft: 'auto' }}
              >
                Clear results
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
