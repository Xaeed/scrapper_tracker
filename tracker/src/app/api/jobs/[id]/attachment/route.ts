import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ctx = { params: { id: string } }

// GET — serve the attachment file
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = params
  const job = await prisma.job.findUnique({
    where: { id },
    select: { attachmentName: true, attachmentData: true, attachmentType: true },
  })

  if (!job || !job.attachmentData) {
    return NextResponse.json({ error: 'No attachment found' }, { status: 404 })
  }

  const buffer = Buffer.from(job.attachmentData, 'base64')
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': job.attachmentType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${job.attachmentName || 'attachment'}"`,
    },
  })
}

// POST — upload and attach a file
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = params

  const job = await prisma.job.findUnique({ where: { id }, select: { id: true } })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 413 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')

  await prisma.job.update({
    where: { id },
    data: {
      attachmentName: file.name,
      attachmentData: base64,
      attachmentType: file.type || 'application/octet-stream',
    },
  })

  return NextResponse.json({ ok: true, name: file.name, type: file.type, size: file.size })
}

// DELETE — remove attachment
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = params
  await prisma.job.update({
    where: { id },
    data: { attachmentName: null, attachmentData: null, attachmentType: null },
  })
  return NextResponse.json({ ok: true })
}
