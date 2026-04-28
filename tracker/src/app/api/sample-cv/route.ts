import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isHtmlCvContent } from '@/lib/cvProfileValidation'
import { requireAdmin } from '@/lib/requireAdmin'
import { requireAuth } from '@/lib/requireAuth'

const MAX_SIZE = 5 * 1024 * 1024

/** GET — any logged-in user can fetch meta; pass ?html=1 to include the raw HTML */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const row = await prisma.sampleCv.findUnique({ where: { id: 1 } })
  if (!row) return NextResponse.json({ sample: null })

  const includeHtml = new URL(req.url).searchParams.get('html') === '1'
  const html = includeHtml ? Buffer.from(row.fileData, 'base64').toString('utf8') : undefined

  return NextResponse.json({
    sample: {
      fileName: row.fileName,
      mimeType: row.mimeType,
      updatedAt: row.updatedAt,
      ...(includeHtml ? { html } : {}),
    },
  })
}

/** POST — admin only — upload or replace the sample CV template (HTML file) */
export async function POST(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'An HTML CV file is required' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 413 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const text = buffer.toString('utf8')
  if (!isHtmlCvContent(text)) {
    return NextResponse.json(
      { error: 'Sample CV must be an HTML file (.html/.htm).' },
      { status: 400 }
    )
  }

  const row = await prisma.sampleCv.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      fileName: file.name || 'sample-cv.html',
      fileData: buffer.toString('base64'),
      mimeType: file.type || 'text/html',
    },
    update: {
      fileName: file.name || 'sample-cv.html',
      fileData: buffer.toString('base64'),
      mimeType: file.type || 'text/html',
    },
    select: { fileName: true, mimeType: true, updatedAt: true },
  })

  return NextResponse.json({ ok: true, sample: row })
}

/** DELETE — admin only — clear the sample CV template */
export async function DELETE(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    await prisma.sampleCv.delete({ where: { id: 1 } })
  } catch {
    // already gone — that's fine
  }
  return NextResponse.json({ ok: true })
}
