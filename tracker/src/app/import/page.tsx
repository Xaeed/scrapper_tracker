'use client'

import { useRef, useState } from 'react'

interface ImportResult {
  inserted: number
  skipped: number
  errors: string[]
}

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) { setFile(f); setResult(null); setError('') }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { setError('Please select a JSON file.'); return }
    setLoading(true)
    setError('')
    setResult(null)

    const fd = new FormData()
    fd.append('file', file)

    try {
      const res = await fetch('/api/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h1>Import Jobs</h1>

      <div className="card" style={{ maxWidth: 560 }}>
        <form onSubmit={handleSubmit}>
          <div
            className="upload-zone"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
          >
            {file ? (
              <p><strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)</p>
            ) : (
              <>
                <p style={{ fontSize: 32, marginBottom: 8 }}>📂</p>
                <p>Drop a JSON file here, or click to browse</p>
                <p className="text-muted text-sm" style={{ marginTop: 6 }}>
                  Expects an array of LinkedIn job objects
                </p>
              </>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0] ?? null
              setFile(f)
              setResult(null)
              setError('')
            }}
          />

          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button type="submit" className="primary" disabled={loading || !file}>
              {loading ? 'Importing…' : 'Import'}
            </button>
            {file && (
              <button
                type="button"
                onClick={() => { setFile(null); setResult(null); setError(''); if (fileRef.current) fileRef.current.value = '' }}
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {error && <div className="alert alert-error" style={{ marginTop: 16, maxWidth: 560 }}>{error}</div>}

      {result && (
        <div style={{ maxWidth: 560 }}>
          <div className="alert alert-success" style={{ marginTop: 16 }}>
            Import complete.
          </div>
          <div className="summary">
            <div className="stat"><div className="num">{result.inserted}</div><div className="lbl">Inserted</div></div>
            <div className="stat"><div className="num">{result.skipped}</div><div className="lbl">Already exists</div></div>
          </div>

          {result.errors.length > 0 && (
            <div className="error-list">
              <strong>Errors ({result.errors.length}):</strong>
              <ul>
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <a href="/jobs" className="btn primary">View Jobs →</a>
          </div>
        </div>
      )}

      <div className="card" style={{ maxWidth: 560, marginTop: 24 }}>
        <h2>Expected JSON format</h2>
        <pre style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'auto', marginTop: 8 }}>{`[
  {
    "id": "3901234567",
    "title": "Senior Frontend Engineer",
    "company": "Acme Corp",
    "location": "Remote – Europe",
    "link": "https://www.linkedin.com/jobs/view/3901234567",
    "postedAt": "2024-06-01T08:00:00Z",
    "searchKeyword": "frontend engineer",
    "searchLocation": "Europe",
    "scrapedAt": "2024-06-02T10:00:00Z"
  }
]`}</pre>
      </div>
    </>
  )
}
