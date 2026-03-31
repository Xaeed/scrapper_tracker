import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildWhere } from '@/lib/jobFilters'

const VALID_SORT_FIELDS = ['createdAt', 'updatedAt', 'title', 'company', 'postedAt', 'scrapedAt', 'status']

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams

  const search = sp.get('search')?.trim() || ''
  const status = sp.get('status')?.trim() || ''
  const keyword = sp.get('searchKeyword')?.trim() || ''
  const dateFrom = sp.get('dateFrom') || ''
  const dateTo = sp.get('dateTo') || ''
  const sortBy = VALID_SORT_FIELDS.includes(sp.get('sortBy') || '') ? sp.get('sortBy')! : 'createdAt'
  const sortDir = sp.get('sortDir') === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, parseInt(sp.get('page') || '1'))
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '20')))

  const where = buildWhere({ search, status, keyword, dateFrom, dateTo })

  const [total, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return NextResponse.json({ jobs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { link, title, company, location, description } = body

  if (!link?.trim()) return NextResponse.json({ error: 'link is required' }, { status: 400 })
  if (!title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  try {
    const job = await prisma.job.create({
      data: {
        link: link.trim(),
        title: title.trim(),
        company: company?.trim() || 'Unknown',
        location: location?.trim() || null,
        description: description?.trim() || null,
      },
    })
    return NextResponse.json(job, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'A job with this link already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const sp = req.nextUrl.searchParams

  const where = buildWhere({
    search: sp.get('search')?.trim() || '',
    status: sp.get('status')?.trim() || '',
    keyword: sp.get('searchKeyword')?.trim() || '',
    dateFrom: sp.get('dateFrom') || '',
    dateTo: sp.get('dateTo') || '',
  })

  const { count } = await prisma.job.deleteMany({ where })
  return NextResponse.json({ deleted: count })
}
