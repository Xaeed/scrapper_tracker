import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, hashPassword } from '@/lib/auth'

type Ctx = { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { password, role } = body as { password?: string; role?: string }

  const user = await prisma.user.findUnique({ where: { id: params.id } })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const data: { password?: string; role?: string } = {}

  if (password !== undefined) {
    if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    data.password = await hashPassword(password)
  }

  if (role !== undefined) {
    if (role !== 'admin' && role !== 'user') return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    // Prevent demoting the last admin
    if (user.role === 'admin' && role === 'user') {
      const adminCount = await prisma.user.count({ where: { role: 'admin' } })
      if (adminCount <= 1) return NextResponse.json({ error: 'Cannot demote the last admin' }, { status: 400 })
    }
    data.role = role
  }

  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const updated = await prisma.user.update({ where: { id: params.id }, data })
  return NextResponse.json({ ok: true, role: updated.role })
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (params.id === session.userId) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  // Prevent deleting last admin
  const targetUser = await prisma.user.findUnique({ where: { id: params.id } })
  if (!targetUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (targetUser.role === 'admin') {
    const adminCount = await prisma.user.count({ where: { role: 'admin' } })
    if (adminCount <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last admin account' }, { status: 400 })
    }
  }

  await prisma.user.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
