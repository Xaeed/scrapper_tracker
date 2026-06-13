import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ctx = { params: { id: string } }

// List per-profile CVs for a job — metadata only (never ship the full HTML here).
export async function GET(_req: NextRequest, { params }: Ctx) {
  const cvs = await prisma.jobCv.findMany({
    where: { jobId: params.id },
    select: {
      id: true,
      profileKey: true,
      profileName: true,
      cvProfileId: true,
      fileName: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ cvs })
}

// Upsert one per-profile CV. Re-generating a profile replaces its row.
export async function POST(req: NextRequest, { params }: Ctx) {
  const jobId = params.id

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Expected a JSON object' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  const profileKey = typeof b.profileKey === 'string' ? b.profileKey.trim() : ''
  const profileName = typeof b.profileName === 'string' ? b.profileName.trim() : ''
  const cvHtml = typeof b.cvHtml === 'string' ? b.cvHtml : ''
  const cvProfileId =
    typeof b.cvProfileId === 'string' && b.cvProfileId.trim() ? b.cvProfileId.trim() : null
  const fileName =
    typeof b.fileName === 'string' && b.fileName.trim() ? b.fileName.trim() : null

  if (!profileKey) return NextResponse.json({ error: 'profileKey is required' }, { status: 400 })
  if (!profileName) return NextResponse.json({ error: 'profileName is required' }, { status: 400 })
  if (!cvHtml.trim()) return NextResponse.json({ error: 'cvHtml is required' }, { status: 400 })

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true } })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const cv = await prisma.jobCv.upsert({
    where: { jobId_profileKey: { jobId, profileKey } },
    update: { profileName, cvProfileId, cvHtml, fileName },
    create: { jobId, profileKey, profileName, cvProfileId, cvHtml, fileName },
    select: {
      id: true,
      profileKey: true,
      profileName: true,
      cvProfileId: true,
      fileName: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  return NextResponse.json(cv)
}
