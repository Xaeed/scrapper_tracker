'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SetupPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/users/setup-allowed')
      .then(r => r.json())
      .then(d => {
        setAllowed(d.allowed === true)
        setChecking(false)
      })
      .catch(() => setChecking(false))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/users/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Setup failed')
        return
      }
      router.push('/login')
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (checking) return <p className="text-muted">Checking…</p>

  if (!allowed) {
    return (
      <div style={{ maxWidth: 400, margin: '80px auto' }}>
        <div className="alert alert-error">
          Setup is only available when no users exist. Please{' '}
          <a href="/login" style={{ color: 'var(--primary)' }}>log in</a>.
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto' }}>
      <h1 style={{ marginBottom: 8 }}>First-Time Setup</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>
        Create the initial admin account.
      </p>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Admin Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
              style={{ width: '100%' }}
            />
          </div>
          <div className="field" style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Password (min 6 chars)</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              style={{ width: '100%' }}
            />
          </div>
          {error && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>
          )}
          <button type="submit" className="btn primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? 'Creating…' : 'Create Admin Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
