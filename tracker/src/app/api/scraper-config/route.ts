import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'

const DEFAULT_KEYWORDS = [
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
]

const DEFAULT_LOCATIONS = [
  'Germany',
  'Netherlands',
  'France',
  'Luxembourg',
  'Sweden',
  'Denmark',
  'Norway',
  'Austria',
  'Belgium',
  'Poland',
  'Portugal',
  'United Kingdom',
]

async function getOrCreateConfig() {
  let row = await prisma.scraperConfig.findUnique({ where: { id: 1 } })
  if (!row) {
    row = await prisma.scraperConfig.create({
      data: {
        id: 1,
        keywords: JSON.stringify(DEFAULT_KEYWORDS),
        locations: JSON.stringify(DEFAULT_LOCATIONS),
        excludedCompanies: JSON.stringify([]),
      },
    })
  }
  return {
    keywords: JSON.parse(row.keywords) as string[],
    locations: JSON.parse(row.locations) as string[],
    excludedCompanies: JSON.parse(row.excludedCompanies) as string[],
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

  let body: { keywords?: unknown; locations?: unknown; excludedCompanies?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const keywords = body.keywords
  const locations = body.locations
  const excludedCompanies = body.excludedCompanies ?? []

  if (
    !Array.isArray(keywords) || keywords.some(k => typeof k !== 'string' || !k.trim()) ||
    !Array.isArray(locations) || locations.some(l => typeof l !== 'string' || !l.trim()) ||
    !Array.isArray(excludedCompanies) || excludedCompanies.some((c: unknown) => typeof c !== 'string')
  ) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const clean = {
    keywords: (keywords as string[]).map(k => k.trim()).filter(Boolean),
    locations: (locations as string[]).map(l => l.trim()).filter(Boolean),
    excludedCompanies: (excludedCompanies as string[]).map(c => c.trim()).filter(Boolean),
  }

  if (clean.keywords.length === 0 || clean.locations.length === 0) {
    return NextResponse.json({ error: 'Must have at least one keyword and one location' }, { status: 400 })
  }

  const row = await prisma.scraperConfig.upsert({
    where: { id: 1 },
    update: {
      keywords: JSON.stringify(clean.keywords),
      locations: JSON.stringify(clean.locations),
      excludedCompanies: JSON.stringify(clean.excludedCompanies),
    },
    create: {
      id: 1,
      keywords: JSON.stringify(clean.keywords),
      locations: JSON.stringify(clean.locations),
      excludedCompanies: JSON.stringify(clean.excludedCompanies),
    },
  })

  return NextResponse.json({
    keywords: JSON.parse(row.keywords) as string[],
    locations: JSON.parse(row.locations) as string[],
    excludedCompanies: JSON.parse(row.excludedCompanies) as string[],
    updatedAt: row.updatedAt,
  })
}
