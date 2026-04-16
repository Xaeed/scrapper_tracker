import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/requireAdmin'
import { getManualRunStatus, startManualScraperRun } from '@/lib/scraperManualRun'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const status = await getManualRunStatus()
  return NextResponse.json(status)
}

export async function POST(_req: NextRequest) {
  const session = await requireAdmin(_req)
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const result = await startManualScraperRun()
  if (!result.ok) {
    const status = result.code === 'BUSY' ? 409 : result.code === 'NOT_CONFIGURED' ? 503 : 400
    return NextResponse.json({ error: result.error, code: result.code }, { status })
  }
  return NextResponse.json({ ok: true, message: 'Scraper run started' })
}
