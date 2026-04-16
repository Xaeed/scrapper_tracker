import { Prisma } from '@prisma/client'

export function buildWhere(opts: {
  search: string
  status: string
  keyword: string
  dateFrom: string
  dateTo: string
  tag?: string
  importMethod?: string
  excludedCompanies?: string[]
}): Prisma.JobWhereInput {
  const { search, status, keyword, dateFrom, dateTo, tag, importMethod, excludedCompanies } = opts
  const where: Prisma.JobWhereInput = {}

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { company: { contains: search } },
      { location: { contains: search } },
      { tags: { contains: search } },
    ]
  }

  if (status) where.status = status
  if (keyword) where.searchKeyword = { contains: keyword }

  if (tag?.trim()) {
    const t = tag.trim().toLowerCase()
    where.tags = { contains: `"${t}"` }
  }

  if (importMethod === 'manual' || importMethod === 'scraped') {
    where.importMethod = importMethod
  }

  if (dateFrom || dateTo) {
    where.postedAt = {}
    if (dateFrom) where.postedAt.gte = new Date(dateFrom)
    if (dateTo) {
      const end = new Date(dateTo)
      end.setHours(23, 59, 59, 999)
      where.postedAt.lte = end
    }
  }

  if (excludedCompanies && excludedCompanies.length > 0) {
    where.AND = excludedCompanies.map(name => ({
      company: { not: { contains: name } },
    }))
  }

  return where
}
