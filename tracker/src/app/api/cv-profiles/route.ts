import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isHtmlCvContent } from '@/lib/cvProfileValidation'
import { requireAdmin } from '@/lib/requireAdmin'
import { requireAuth } from '@/lib/requireAuth'

export const maxDuration = 300

const MAX_SIZE = 10 * 1024 * 1024
const N8N_FETCH_MS = 180_000

export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await prisma.cvProfile.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, fileName: true, mimeType: true, createdAt: true, updatedAt: true, pdfName: true },
  })
  const profiles = rows.map(r => ({ ...r, hasPdf: !!r.pdfName }))
  return NextResponse.json({ profiles })
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const nameRaw = formData.get('name')
  const name = typeof nameRaw === 'string' ? nameRaw.trim() : ''
  if (!name) return NextResponse.json({ error: 'Profile name is required' }, { status: 400 })

  const file = formData.get('file') as File | null
  if (!file || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'A CV file is required' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

  // ── PDF upload path: convert via n8n → Claude ──────────────────────────
  if (isPdf) {
    const webhookUrl =
      process.env.N8N_PDF_IMPORT_WEBHOOK_URL ||
      'http://localhost:5678/webhook/cv-pdf-import'

    const pdfBase64 = buffer.toString('base64')

    // Fetch sample CV template if one exists — passed to Claude as style reference
    let sampleCvHtml: string | undefined
    try {
      const sample = await prisma.sampleCv.findUnique({ where: { id: 1 } })
      if (sample?.fileData) {
        sampleCvHtml = Buffer.from(sample.fileData, 'base64').toString('utf8')
      }
    } catch { /* non-fatal — proceed without sample */ }
    const signal =
      typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
        ? AbortSignal.timeout(N8N_FETCH_MS)
        : undefined

    let res: Response
    try {
      res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          pdf_base64: pdfBase64,
          pdf_name: file.name,
          ...(sampleCvHtml ? { sample_cv_html: sampleCvHtml } : {}),
        }),
        ...(signal ? { signal } : {}),
      })
    } catch (err) {
      const aborted =
        err instanceof Error &&
        (err.name === 'AbortError' || err.name === 'TimeoutError' || /aborted|timeout/i.test(err.message))
      if (aborted) {
        return NextResponse.json(
          { error: `PDF conversion timed out after ${N8N_FETCH_MS / 1000}s. The workflow may still be running — check n8n.` },
          { status: 504 }
        )
      }
      return NextResponse.json(
        { error: `Could not reach n8n at ${webhookUrl}. Is it running?` },
        { status: 502 }
      )
    }

    const raw = await res.text()
    let data: Record<string, unknown>
    try {
      const parsed = raw ? JSON.parse(raw) : null
      data = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return NextResponse.json(
        { error: `n8n returned non-JSON during PDF conversion (HTTP ${res.status}).` },
        { status: 502 }
      )
    }

    if (!res.ok) {
      const msg =
        typeof data.error === 'string' && data.error.trim()
          ? data.error
          : `PDF conversion failed (n8n HTTP ${res.status})`
      return NextResponse.json({ error: msg }, { status: res.status >= 500 ? 502 : res.status })
    }

    const html = typeof data.html === 'string' ? data.html.trim() : ''
    if (!html || !isHtmlCvContent(html)) {
      return NextResponse.json(
        { error: 'n8n returned an empty or invalid HTML CV from PDF conversion. Check the cv-pdf-import workflow.' },
        { status: 502 }
      )
    }

    const htmlBuffer = Buffer.from(html, 'utf8')
    const htmlBase64 = htmlBuffer.toString('base64')
    const htmlFileName = file.name.replace(/\.pdf$/i, '.html')

    try {
      const created = await prisma.cvProfile.create({
        data: {
          name,
          fileName: htmlFileName,
          fileData: htmlBase64,
          mimeType: 'text/html',
          pdfName: file.name,
          pdfData: pdfBase64,
        },
        select: { id: true, name: true, fileName: true, mimeType: true, createdAt: true },
      })
      return NextResponse.json({ ...created, source: 'pdf-converted' }, { status: 201 })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown'
      if (msg.includes('Unique constraint')) {
        return NextResponse.json(
          { error: 'A profile with this name already exists.' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  // ── HTML upload path (existing behaviour) ──────────────────────────────
  const text = buffer.toString('utf8')
  if (!isHtmlCvContent(text)) {
    return NextResponse.json(
      {
        error:
          'Unsupported file type. Upload an HTML CV (.html/.htm) or a PDF (.pdf) which will be automatically converted.',
      },
      { status: 400 }
    )
  }

  const base64 = buffer.toString('base64')
  const mime = file.type || 'text/html'

  try {
    const created = await prisma.cvProfile.create({
      data: { name, fileName: file.name || 'cv.html', fileData: base64, mimeType: mime },
      select: { id: true, name: true, fileName: true, mimeType: true, createdAt: true },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    if (msg.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'A profile with this name already exists. Rename or delete the existing profile first.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
