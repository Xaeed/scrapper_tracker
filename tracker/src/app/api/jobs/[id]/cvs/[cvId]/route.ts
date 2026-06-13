import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ctx = { params: { id: string; cvId: string } }

// Return the raw HTML for one per-profile CV (View / Download / Preview).
export async function GET(_req: NextRequest, { params }: Ctx) {
  const cv = await prisma.jobCv.findFirst({
    where: { id: params.cvId, jobId: params.id },
    select: { cvHtml: true },
  })
  if (!cv) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(cv.cvHtml, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { count } = await prisma.jobCv.deleteMany({
      where: { id: params.cvId, jobId: params.id },
    })
    if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
