import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

export async function POST(req: NextRequest) {
  // Only allowed when no users exist
  const count = await prisma.user.count()
  if (count > 0) {
    return NextResponse.json({ error: 'Setup already completed' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { username, password } = body as { username?: string; password?: string }
  if (!username?.trim() || !password || password.length < 6) {
    return NextResponse.json({ error: 'Username required and password must be at least 6 characters' }, { status: 400 })
  }

  const hashed = await hashPassword(password)
  const user = await prisma.user.create({
    data: { username: username.trim(), password: hashed, role: 'admin' },
    select: { id: true, username: true, role: true },
  })
  return NextResponse.json(user, { status: 201 })
}
