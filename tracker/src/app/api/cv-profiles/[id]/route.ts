import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  CV_PROFILE_CONTACT_SELECT,
  parseContactFromBody,
  validateCvProfileContact,
  type CvProfileContact,
} from '@/lib/cvProfileContact'
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

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const record = body as Record<string, unknown>
  const data: Record<string, unknown> = { ...parseContactFromBody(record) }

  if ('name' in record) {
    const name = typeof record.name === 'string' ? record.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'Profile name cannot be empty' }, { status: 400 })
    data.name = name
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const existing = await prisma.cvProfile.findUnique({
    where: { id: params.id },
    select: { ...CV_PROFILE_CONTACT_SELECT, linkedinPassword: true, name: true },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const merged: CvProfileContact = {
    linkedinUrl:
      'linkedinUrl' in data ? (data.linkedinUrl as string | null) : existing.linkedinUrl,
    linkedinPassword:
      'linkedinPassword' in data
        ? (data.linkedinPassword as string | null)
        : existing.linkedinPassword,
    linkedinEmail:
      'linkedinEmail' in data ? (data.linkedinEmail as string | null) : existing.linkedinEmail,
    address: 'address' in data ? (data.address as string | null) : existing.address,
    phone: 'phone' in data ? (data.phone as string | null) : existing.phone,
  }
  const contactError = validateCvProfileContact(merged)
  if (contactError) return NextResponse.json({ error: contactError }, { status: 400 })

  try {
    const updated = await prisma.cvProfile.update({
      where: { id: params.id },
      data,
      select: {
        id: true,
        name: true,
        fileName: true,
        mimeType: true,
        createdAt: true,
        updatedAt: true,
        pdfName: true,
        ...CV_PROFILE_CONTACT_SELECT,
        linkedinPassword: true,
      },
    })
    return NextResponse.json({ ...updated, hasPdf: !!updated.pdfName, hasLinkedinPassword: !!updated.linkedinPassword })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    if (msg.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'A profile with this name already exists.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
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
