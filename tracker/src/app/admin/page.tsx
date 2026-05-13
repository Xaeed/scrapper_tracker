'use client'

import { useEffect, useState } from 'react'

interface User {
  id: string
  username: string
  role: string
  createdAt: string
}

interface Me {
  username: string
  role: string
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([])
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'user' | 'admin'>('user')
  const [formError, setFormError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const [changePwUser, setChangePwUser] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changePwError, setChangePwError] = useState<string | null>(null)
  const [changePwSuccess, setChangePwSuccess] = useState(false)
  const [changingPw, setChangingPw] = useState(false)

  async function loadUsers() {
    const [meRes, usersRes] = await Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ])
    setMe(meRes.user)
    if (Array.isArray(usersRes)) setUsers(usersRes)
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setCreating(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error || 'Failed'); return }
      setUsername(''); setPassword(''); setRole('user')
      setShowForm(false)
      await loadUsers()
    } catch {
      setFormError('Network error')
    } finally {
      setCreating(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setChangePwError(null)
    setChangePwSuccess(false)
    if (newPassword !== confirmPassword) {
      setChangePwError('Passwords do not match')
      return
    }
    setChangingPw(true)
    try {
      const res = await fetch(`/api/users/${changePwUser!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) { setChangePwError(data.error || 'Failed'); return }
      setChangePwSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      setChangePwError('Network error')
    } finally {
      setChangingPw(false)
    }
  }

  async function handleDelete(id: string, uname: string) {
    if (!confirm(`Delete user "${uname}"?`)) return
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { alert(data.error || 'Delete failed'); return }
    setUsers(u => u.filter(x => x.id !== id))
  }

  if (loading) return <p className="text-muted">Loading…</p>

  return (
    <>
      <div className="top-bar">
        <h1 style={{ margin: 0 }}>Admin — User Management</h1>
        <button className="btn primary" onClick={() => setShowForm(s => !s)} style={{ marginLeft: 'auto' }}>
          {showForm ? 'Cancel' : '+ New User'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 24, maxWidth: 480 }}>
          <h2>Create User</h2>
          <form onSubmit={handleCreate}>
            <div className="field" style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} required style={{ width: '100%' }} />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Password (min 6 chars)</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} style={{ width: '100%' }} />
            </div>
            <div className="field" style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Role</label>
              <select value={role} onChange={e => setRole(e.target.value as 'user' | 'admin')} style={{ maxWidth: 160 }}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {formError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{formError}</div>}
            <button type="submit" className="btn primary" disabled={creating}>
              {creating ? 'Creating…' : 'Create User'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Username</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Role</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Created</th>
              <th style={{ padding: '8px 12px' }}></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 12px', fontWeight: 500 }}>
                  {u.username}
                  {me?.username === u.username && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>(you)</span>
                  )}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 12,
                    background: u.role === 'admin' ? '#eff6ff' : '#f3f4f6',
                    color: u.role === 'admin' ? '#1d4ed8' : 'var(--text-muted)',
                    border: `1px solid ${u.role === 'admin' ? '#bfdbfe' : 'var(--border)'}`,
                  }}>
                    {u.role}
                  </span>
                </td>
                <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                  {new Date(u.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => { setChangePwUser(u); setNewPassword(''); setConfirmPassword(''); setChangePwError(null); setChangePwSuccess(false) }}
                    style={{ fontSize: 12, padding: '3px 10px' }}
                  >
                    Change Password
                  </button>
                  <button
                    onClick={() => handleDelete(u.id, u.username)}
                    disabled={me?.username === u.username}
                    style={{ fontSize: 12, padding: '3px 10px', color: '#991b1b', borderColor: '#fecaca' }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={4} style={{ padding: 16, color: 'var(--text-muted)', textAlign: 'center' }}>No users</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {changePwUser && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 420, margin: 16 }}>
            <h2 style={{ marginTop: 0 }}>Change Password — {changePwUser.username}</h2>
            <form onSubmit={handleChangePassword}>
              <div className="field" style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>New Password (min 6 chars)</label>
                <input
                  type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  required minLength={6} style={{ width: '100%' }} autoFocus
                />
              </div>
              <div className="field" style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Confirm Password</label>
                <input
                  type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  required minLength={6} style={{ width: '100%' }}
                />
              </div>
              {changePwError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{changePwError}</div>}
              {changePwSuccess && <div className="alert alert-success" style={{ marginBottom: 12 }}>Password updated successfully.</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn primary" disabled={changingPw}>
                  {changingPw ? 'Saving…' : 'Update Password'}
                </button>
                <button type="button" onClick={() => setChangePwUser(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
