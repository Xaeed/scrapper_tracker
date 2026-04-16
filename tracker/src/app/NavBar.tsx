'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ScraperStatusBadge from './ScraperStatusBadge'

interface Props {
  session: { username: string; role: string } | null
}

export default function NavBar({ session }: Props) {
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <nav>
      <Link href="/" className="brand">Job Tracker</Link>
      {session && (
        <>
          <Link href="/jobs">Jobs</Link>
          <Link href="/jobs/add">Add Job</Link>
          {/* <Link href="/import">Import</Link> */}
          <Link href="/cv">Create CV</Link>
          {session.role === 'admin' && <Link href="/cv/profiles">CV profiles</Link>}
          {session.role === 'admin' && <Link href="/admin">Users</Link>}
          {session.role === 'admin' && <Link href="/admin/scraper-config">Scraper Config</Link>}
          {session.role === 'admin' && <ScraperStatusBadge />}
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{session.username}</span>
            <button onClick={logout} style={{ fontSize: 13, padding: '3px 10px' }}>Logout</button>
          </span>
        </>
      )}
    </nav>
  )
}
