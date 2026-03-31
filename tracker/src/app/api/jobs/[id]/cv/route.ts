import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ctx = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = params
  const job = await prisma.job.findUnique({ where: { id }, select: { cvHtml: true } })

  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!job.cvHtml) return NextResponse.json({ error: 'No CV generated for this job' }, { status: 404 })

  return new NextResponse(job.cvHtml, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
