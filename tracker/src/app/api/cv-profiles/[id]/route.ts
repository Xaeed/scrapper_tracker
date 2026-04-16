import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ctx = { params: { id: string } }

/** Serve uploaded CV (inline) for preview */
export async function GET(_req: NextRequest, { params }: Ctx) {
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

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    await prisma.cvProfile.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
