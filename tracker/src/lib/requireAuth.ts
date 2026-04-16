import { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'

/** Any logged-in user (admin or user). */
export async function requireAuth(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return null
  return session
}
