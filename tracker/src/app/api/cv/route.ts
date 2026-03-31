import { NextRequest, NextResponse } from 'next/server'

/** Allow long n8n workflows (Vercel: set in dashboard too). Self-hosted: match nginx proxy_read_timeout. */
export const maxDuration = 300

const N8N_FETCH_MS = 180_000

const LOG = '[cv/api]'

/** Anthropic / Claude often returns credit, billing, or quota wording — log explicitly when seen. */
function looksLikeClaudeCreditOrBilling(text: string): boolean {
  const t = text.toLowerCase()
  return (
    /(out of|no|insufficient)\s+(credit|credits|quota|balance)/.test(t) ||
    /\b(credit|billing|quota|balance)\b.*(exhausted|exceeded|required|limit|depleted)/.test(t) ||
    /payment\s+required|billing\s+issue|upgrade\s+your\s+plan/.test(t) ||
    /\b(402|429)\b.*(anthropic|claude|token)/.test(t) ||
    /anthropic.*\b(402|429|credit|billing|quota)/.test(t)
  )
}

function stringifyForLog(data: unknown, max = 6000): string {
  try {
    if (typeof data === 'string') return data.length > max ? data.slice(0, max) + '…' : data
    const s = JSON.stringify(data, null, 0)
    return s.length > max ? s.slice(0, max) + '…' : s
  } catch {
    return String(data)
  }
}

function logN8nIssue(
  context: string,
  extra: { status?: number; raw?: string; payload?: unknown }
): void {
  const raw = extra.raw ?? stringifyForLog(extra.payload)
  const billing = looksLikeClaudeCreditOrBilling(raw)
  const tag = billing ? ' [Claude/Anthropic: credit, billing, or quota — check bodyPreview]' : ''
  console.error(`${LOG} ${context}${tag}`, {
    status: extra.status,
    billingOrCreditSuspected: billing,
    bodyPreview: raw.length > 4000 ? raw.slice(0, 4000) + '…' : raw,
  })
}

function extractN8nErrorMessage(data: unknown, statusFallback: string): string {
  if (typeof data !== 'object' || data === null) return statusFallback
  const o = data as Record<string, unknown>
  if (typeof o.message === 'string' && o.message.trim()) return o.message
  if (typeof o.error === 'string' && o.error.trim()) return o.error
  if (o.error && typeof o.error === 'object' && o.error !== null && 'message' in o.error) {
    const m = (o.error as { message?: unknown }).message
    if (typeof m === 'string' && m.trim()) return m
  }
  return statusFallback
}

/** Appends a short hint when logs would flag Anthropic billing — keeps UI in sync with server logs. */
function maybeAppendBillingHint(fullContext: string): string {
  if (!looksLikeClaudeCreditOrBilling(fullContext)) return ''
  return ' If you use Claude (Anthropic), check API credits and billing (see server logs [cv/api]).'
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const webhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/job-description'

  let res: Response
  const signal =
    typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
      ? AbortSignal.timeout(N8N_FETCH_MS)
      : undefined
  try {
    res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      ...(signal ? { signal } : {}),
    })
  } catch (err) {
    console.error(`${LOG} fetch to n8n failed`, err)
    const aborted =
      err instanceof Error &&
      (err.name === 'AbortError' || err.name === 'TimeoutError' || /aborted|timeout/i.test(err.message))
    if (aborted) {
      return NextResponse.json(
        {
          error: `n8n did not respond within ${N8N_FETCH_MS / 1000}s. Shorten the workflow or raise timeouts (app + reverse proxy).`,
        },
        { status: 504 }
      )
    }
    return NextResponse.json(
      { error: `Could not reach n8n at ${webhookUrl}. Is it running?` },
      { status: 502 }
    )
  }

  const raw = await res.text()
  let data: unknown
  try {
    data = raw ? JSON.parse(raw) : null
  } catch {
    logN8nIssue('n8n response is not valid JSON', { status: res.status, raw })
    return NextResponse.json(
      {
        error: `n8n returned non-JSON (${res.status}). Check the webhook workflow and response format.`,
      },
      { status: 502 }
    )
  }

  if (!res.ok) {
    const msg = extractN8nErrorMessage(data, `n8n returned ${res.status}`)
    const forBillingCheck = `${msg} ${stringifyForLog(data)}`
    logN8nIssue(`n8n HTTP ${res.status} (workflow or upstream error)`, {
      status: res.status,
      payload: data,
    })
    return NextResponse.json(
      { error: msg + maybeAppendBillingHint(forBillingCheck) },
      { status: res.status }
    )
  }

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    logN8nIssue('n8n 2xx but body is not a JSON object', { status: res.status, raw })
    return NextResponse.json(
      {
        error:
          'n8n returned an invalid payload (expected a JSON object with cv_html). Check the “Respond to Webhook” node output.',
      },
      { status: 502 }
    )
  }

  const payload = data as Record<string, unknown>
  if (typeof payload.cv_html !== 'string' || !payload.cv_html.trim()) {
    const combined = stringifyForLog(payload)
    logN8nIssue('n8n 2xx but missing or empty cv_html', { status: res.status, raw: combined })
    return NextResponse.json(
      {
        error:
          'n8n response is missing cv_html (string). Map your workflow fields to cv_html, profile, file_name, and requested_at as needed.' +
          maybeAppendBillingHint(combined),
      },
      { status: 502 }
    )
  }

  return NextResponse.json(data)
}
