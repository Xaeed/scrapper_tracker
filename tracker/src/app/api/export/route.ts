import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildWhere } from '@/lib/jobFilters'

function csv(val: unknown): string {
  if (val === null || val === undefined) return ''
  const s = val instanceof Date ? val.toISOString() : String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams

  const where = buildWhere({
    search: sp.get('search')?.trim() || '',
    status: sp.get('status')?.trim() || '',
    keyword: sp.get('searchKeyword')?.trim() || '',
    dateFrom: sp.get('dateFrom') || '',
    dateTo: sp.get('dateTo') || '',
  })

  const jobs = await prisma.job.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  const HEADERS = [
    'id', 'linkedinId', 'title', 'company', 'location',
    'link', 'postedAt', 'searchKeyword', 'searchLocation',
    'scrapedAt', 'status', 'notes', 'createdAt', 'updatedAt',
  ] as const

  type JobKey = typeof HEADERS[number]

  const rows = [
    HEADERS.join(','),
    ...jobs.map(j =>
      HEADERS.map(h => csv(j[h as JobKey])).join(',')
    ),
  ].join('\n')

  return new NextResponse(rows, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="jobs-${Date.now()}.csv"`,
    },
  })
}
