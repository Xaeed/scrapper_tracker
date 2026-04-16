import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeTagList, stringifyTags } from '@/lib/tags'

type Ctx = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const job = await prisma.job.findUnique({ where: { id: params.id } })
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(job)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    await prisma.job.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const body = await req.json()
  const allowed: Record<string, unknown> = {}

  if ('status' in body) {
    const valid = ['NEW', 'VIEWED', 'READY', 'APPLIED', 'REJECTED', 'NOT_INTERESTED']
    if (!valid.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    allowed.status = body.status
  }

  if ('notes' in body) {
    allowed.notes = typeof body.notes === 'string' ? body.notes : null
  }

  if ('description' in body) {
    allowed.description = typeof body.description === 'string' ? body.description : null
  }

  if ('cvHtml' in body) {
    allowed.cvHtml = typeof body.cvHtml === 'string' ? body.cvHtml : null
  }

  if ('tags' in body) {
    if (!Array.isArray(body.tags)) {
      return NextResponse.json({ error: 'tags must be an array of strings' }, { status: 400 })
    }
    allowed.tags = stringifyTags(normalizeTagList(body.tags.map((x: unknown) => String(x))))
  }

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  try {
    const job = await prisma.job.update({ where: { id: params.id }, data: allowed })
    return NextResponse.json(job)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
