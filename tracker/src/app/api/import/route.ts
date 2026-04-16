import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface LinkedInJob {
  id?: string | number
  title?: string
  company?: string
  location?: string
  link?: string
  postedAt?: string
  searchKeyword?: string
  searchLocation?: string
  scrapedAt?: string
}

function parseDate(val: string | undefined | null): Date | null {
  if (!val) return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

async function parseJobs(req: NextRequest): Promise<LinkedInJob[] | { error: string }> {
  const contentType = req.headers.get('content-type') ?? ''

  // Scraper (or any API client) sends raw JSON array
  if (contentType.includes('application/json')) {
    try {
      const body = await req.json()
      const arr = Array.isArray(body) ? body : body?.jobs
      if (!Array.isArray(arr)) throw new Error('Expected a JSON array or { jobs: [] }')
      return arr
    } catch (e) {
      return { error: `Invalid JSON body: ${e instanceof Error ? e.message : 'parse error'}` }
    }
  }

  // Browser upload sends multipart/form-data with a file field
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return { error: 'Could not parse request body' }
  }

  const file = formData.get('file') as File | null
  if (!file) return { error: 'No file provided' }

  try {
    const parsed = JSON.parse(await file.text())
    if (!Array.isArray(parsed)) throw new Error('Expected a JSON array')
    return parsed
  } catch (e) {
    return { error: `Invalid JSON: ${e instanceof Error ? e.message : 'parse error'}` }
  }
}

/** Deduplicate within the incoming batch by linkedinId then link (first occurrence wins). */
function deduplicateBatch(jobs: LinkedInJob[]): LinkedInJob[] {
  const seenIds = new Set<string>()
  const seenLinks = new Set<string>()
  const result: LinkedInJob[] = []

  for (const job of jobs) {
    const id = job.id != null ? String(job.id) : null
    const link = job.link?.trim()

    if (id && seenIds.has(id)) continue
    if (link && seenLinks.has(link)) continue

    if (id) seenIds.add(id)
    if (link) seenLinks.add(link)
    result.push(job)
  }

  return result
}

export async function POST(req: NextRequest) {
  const result = await parseJobs(req)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  // Deduplicate within this batch before touching the DB
  const jobs = deduplicateBatch(result)

  let inserted = 0
  let skipped = 0
  const errors: string[] = []

  // Fetch all existing linkedinIds and links in one query to avoid N+1 lookups
  const linkedinIds = jobs.map(j => j.id != null ? String(j.id) : null).filter(Boolean) as string[]
  const links = jobs.map(j => j.link?.trim()).filter(Boolean) as string[]

  const [existingByLinkedinId, existingByLink] = await Promise.all([
    linkedinIds.length
      ? prisma.job.findMany({ where: { linkedinId: { in: linkedinIds } }, select: { linkedinId: true } })
      : [],
    prisma.job.findMany({ where: { link: { in: links } }, select: { link: true } }),
  ])

  const knownLinkedinIds = new Set(existingByLinkedinId.map(j => j.linkedinId!))
  const knownLinks = new Set(existingByLink.map(j => j.link))

  for (const job of jobs) {
    const link = job.link?.trim()
    if (!link) { skipped++; continue }

    const linkedinId = job.id != null ? String(job.id) : null

    // Skip if already in DB — preserves any status/notes the user has set
    if ((linkedinId && knownLinkedinIds.has(linkedinId)) || knownLinks.has(link)) {
      skipped++
      continue
    }

    try {
      await prisma.job.create({
        data: {
          link,
          title: job.title?.trim() || 'Untitled',
          company: job.company?.trim() || 'Unknown',
          location: job.location?.trim() ?? null,
          postedAt: parseDate(job.postedAt),
          searchKeyword: job.searchKeyword?.trim() ?? null,
          searchLocation: job.searchLocation?.trim() ?? null,
          scrapedAt: parseDate(job.scrapedAt),
          importMethod: 'scraped',
          ...(linkedinId ? { linkedinId } : {}),
        },
      })
      inserted++
    } catch (e) {
      // Catch any race-condition duplicate (unique constraint violation → treat as skip)
      const msg = e instanceof Error ? e.message : 'unknown error'
      if (msg.includes('Unique constraint')) {
        skipped++
      } else {
        errors.push(`[${linkedinId ?? link}] ${msg}`)
        skipped++
      }
    }
  }

  return NextResponse.json({ inserted, skipped, errors })
}
