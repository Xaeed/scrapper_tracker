import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isHtmlCvContent } from '@/lib/cvProfileValidation'
import { requireAdmin } from '@/lib/requireAdmin'
import { requireAuth } from '@/lib/requireAuth'

const MAX_SIZE = 5 * 1024 * 1024

export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await prisma.cvProfile.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, fileName: true, mimeType: true, createdAt: true, updatedAt: true },
  })
  return NextResponse.json({ profiles: rows })
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const nameRaw = formData.get('name')
  const name = typeof nameRaw === 'string' ? nameRaw.trim() : ''
  if (!name) {
    return NextResponse.json({ error: 'Profile name is required' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'A CV file is required' }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 413 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const text = buffer.toString('utf8')
  if (!isHtmlCvContent(text)) {
    return NextResponse.json(
      {
        error:
          'Please upload an HTML CV (.html or .htm). PDF/Word are not supported for tailoring in this pipeline.',
      },
      { status: 400 }
    )
  }

  const base64 = buffer.toString('base64')
  const mime = file.type || 'text/html'

  try {
    const created = await prisma.cvProfile.create({
      data: {
        name,
        fileName: file.name || 'cv.html',
        fileData: base64,
        mimeType: mime,
      },
      select: { id: true, name: true, fileName: true, mimeType: true, createdAt: true },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    if (msg.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'A profile with this name already exists. Rename or delete the existing profile first.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
