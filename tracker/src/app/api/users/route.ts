import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, hashPassword } from '@/lib/auth'

async function requireAdmin(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'admin') return null
  return session
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { username, password, role } = body as { username?: string; password?: string; role?: string }
  if (!username?.trim() || !password || password.length < 6) {
    return NextResponse.json({ error: 'Username required and password must be at least 6 characters' }, { status: 400 })
  }

  const validRole = role === 'admin' ? 'admin' : 'user'

  const existing = await prisma.user.findUnique({ where: { username: username.trim() } })
  if (existing) return NextResponse.json({ error: 'Username already exists' }, { status: 409 })

  const hashed = await hashPassword(password)
  const user = await prisma.user.create({
    data: { username: username.trim(), password: hashed, role: validRole },
    select: { id: true, username: true, role: true, createdAt: true },
  })
  return NextResponse.json(user, { status: 201 })
}
