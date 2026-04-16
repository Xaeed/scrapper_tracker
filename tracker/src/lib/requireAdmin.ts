import { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'

/** Returns session only when the user is authenticated as admin. */
export async function requireAdmin(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'admin') return null
  return session
}
