import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/requireAdmin'
import { requireAuth } from '@/lib/requireAuth'

type Ctx = { params: { id: string } }

/** Serve uploaded CV (inline) for preview — any logged-in user */
export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await requireAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const prof = await prisma.cvProfile.findUnique({
    where: { id: params.id },
    select: { fileName: true, fileData: true, mimeType: true },
  })
  if (!prof?.fileData) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const buffer = Buffer.from(prof.fileData, 'base64')
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': prof.mimeType || 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="${prof.fileName || 'cv.html'}"`,
    },
  })
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    await prisma.cvProfile.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
