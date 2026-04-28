import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/requireAuth'

type Ctx = { params: { id: string } }

/** Serve the original uploaded PDF source file for a CV profile */
export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await requireAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const prof = await prisma.cvProfile.findUnique({
    where: { id: params.id },
    select: { pdfName: true, pdfData: true },
  })

  if (!prof?.pdfData) {
    return NextResponse.json({ error: 'No source PDF stored for this profile' }, { status: 404 })
  }

  const buffer = Buffer.from(prof.pdfData, 'base64')
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${prof.pdfName || 'cv-source.pdf'}"`,
    },
  })
}
