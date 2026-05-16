import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'

export interface ConfigItem { label: string; enabled: boolean }

const DEFAULT_KEYWORDS: ConfigItem[] = [
  'DevOps Engineer',
  'Platform Engineer',
  'Cloud Infrastructure Engineer',
  'Site Reliability Engineer',
  'AWS DevOps Engineer',
  'Azure DevOps Engineer',
  'GCP Engineer',
  'Kubernetes Engineer',
  'Data Engineer',
  'Cloud Data Engineer',
  'Data Platform Engineer',
  'Backend Engineer Node.js',
  'Backend Engineer .NET',
  '.NET Developer',
  'Node.js Developer',
].map(label => ({ label, enabled: true }))

const DEFAULT_LOCATIONS: ConfigItem[] = [
  'Germany', 'Netherlands', 'France', 'Luxembourg', 'Sweden',
  'Denmark', 'Norway', 'Austria', 'Belgium', 'Poland', 'Portugal', 'United Kingdom',
].map(label => ({ label, enabled: true }))

const DEFAULT_JOB_TYPES = ['F', 'C']
const DEFAULT_WORKPLACE_TYPES = ['1', '2', '3']
const DEFAULT_TIME_RANGE = 'r86400'
const VALID_TIME_RANGES = new Set(['r3600', 'r86400', 'r604800', 'r2592000'])

function toItems(raw: unknown): ConfigItem[] {
  if (!Array.isArray(raw)) return []
  if (raw.length === 0) return []
  // Old format: string[] — migrate on-the-fly
  if (typeof raw[0] === 'string') {
    return (raw as string[]).map(label => ({ label, enabled: true }))
  }
  return (raw as ConfigItem[]).filter(
    x => typeof x?.label === 'string' && typeof x?.enabled === 'boolean'
  )
}

async function getOrCreateConfig() {
  let row = await prisma.scraperConfig.findUnique({ where: { id: 1 } })
  if (!row) {
    row = await prisma.scraperConfig.create({
      data: {
        id: 1,
        keywords: JSON.stringify(DEFAULT_KEYWORDS),
        locations: JSON.stringify(DEFAULT_LOCATIONS),
        excludedCompanies: JSON.stringify([]),
        jobTypes: JSON.stringify(DEFAULT_JOB_TYPES),
        workplaceTypes: JSON.stringify(DEFAULT_WORKPLACE_TYPES),
        timeRange: DEFAULT_TIME_RANGE,
      },
    })
  }

  const keywords = toItems(JSON.parse(row.keywords))
  const locations = toItems(JSON.parse(row.locations))

  // Persist migration if old string[] format was detected
  const needsMigration =
    JSON.parse(row.keywords).length > 0 && typeof JSON.parse(row.keywords)[0] === 'string'
  if (needsMigration) {
    await prisma.scraperConfig.update({
      where: { id: 1 },
      data: {
        keywords: JSON.stringify(keywords),
        locations: JSON.stringify(locations),
      },
    })
  }

  return {
    keywords,
    locations,
    excludedCompanies: JSON.parse(row.excludedCompanies) as string[],
    jobTypes: JSON.parse(row.jobTypes) as string[],
    workplaceTypes: JSON.parse(row.workplaceTypes) as string[],
    timeRange: row.timeRange ?? DEFAULT_TIME_RANGE,
    updatedAt: row.updatedAt,
  }
}

// GET — public (scraper reads this before each run)
export async function GET() {
  const config = await getOrCreateConfig()
  return NextResponse.json(config)
}

// POST — admin only
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { keywords?: unknown; locations?: unknown; excludedCompanies?: unknown; jobTypes?: unknown; workplaceTypes?: unknown; timeRange?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const keywords = toItems(body.keywords)
  const locations = toItems(body.locations)
  const excludedCompanies = Array.isArray(body.excludedCompanies)
    ? (body.excludedCompanies as unknown[]).filter(c => typeof c === 'string')
    : []

  const VALID_JOB_TYPES = new Set(['F', 'C', 'P', 'T', 'I', 'V'])
  const VALID_WORKPLACE_TYPES = new Set(['1', '2', '3'])

  const jobTypes = Array.isArray(body.jobTypes)
    ? (body.jobTypes as unknown[]).filter(t => typeof t === 'string' && VALID_JOB_TYPES.has(t as string)) as string[]
    : DEFAULT_JOB_TYPES

  const workplaceTypes = Array.isArray(body.workplaceTypes)
    ? (body.workplaceTypes as unknown[]).filter(t => typeof t === 'string' && VALID_WORKPLACE_TYPES.has(t as string)) as string[]
    : DEFAULT_WORKPLACE_TYPES

  if (keywords.length === 0 || locations.length === 0) {
    return NextResponse.json({ error: 'Must have at least one keyword and one location' }, { status: 400 })
  }
  if (jobTypes.length === 0 || workplaceTypes.length === 0) {
    return NextResponse.json({ error: 'Must select at least one job type and one workplace type' }, { status: 400 })
  }

  const timeRange = typeof body.timeRange === 'string' && VALID_TIME_RANGES.has(body.timeRange)
    ? body.timeRange
    : DEFAULT_TIME_RANGE

  const row = await prisma.scraperConfig.upsert({
    where: { id: 1 },
    update: {
      keywords: JSON.stringify(keywords),
      locations: JSON.stringify(locations),
      excludedCompanies: JSON.stringify(excludedCompanies),
      jobTypes: JSON.stringify(jobTypes),
      workplaceTypes: JSON.stringify(workplaceTypes),
      timeRange,
    },
    create: {
      id: 1,
      keywords: JSON.stringify(keywords),
      locations: JSON.stringify(locations),
      excludedCompanies: JSON.stringify(excludedCompanies),
      jobTypes: JSON.stringify(jobTypes),
      workplaceTypes: JSON.stringify(workplaceTypes),
      timeRange,
    },
  })

  return NextResponse.json({
    keywords: JSON.parse(row.keywords) as ConfigItem[],
    locations: JSON.parse(row.locations) as ConfigItem[],
    excludedCompanies: JSON.parse(row.excludedCompanies) as string[],
    jobTypes: JSON.parse(row.jobTypes) as string[],
    workplaceTypes: JSON.parse(row.workplaceTypes) as string[],
    timeRange: row.timeRange,
    updatedAt: row.updatedAt,
  })
}
