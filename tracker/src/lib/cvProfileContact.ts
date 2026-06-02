export type CvProfileContact = {
  linkedinUrl: string | null
  linkedinPassword: string | null
  linkedinEmail: string | null
  address: string | null
  phone: string | null
}

function optString(value: unknown): string | null {
  if (value == null) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

export function parseContactFromFormData(form: FormData): CvProfileContact {
  return {
    linkedinUrl: optString(form.get('linkedinUrl')),
    linkedinPassword: optString(form.get('linkedinPassword')),
    linkedinEmail: optString(form.get('linkedinEmail')),
    address: optString(form.get('address')),
    phone: optString(form.get('phone')),
  }
}

export function parseContactFromBody(body: Record<string, unknown>): Partial<CvProfileContact> {
  const out: Partial<CvProfileContact> = {}
  if ('linkedinUrl' in body) out.linkedinUrl = optString(body.linkedinUrl)
  if ('linkedinPassword' in body) out.linkedinPassword = optString(body.linkedinPassword)
  if ('linkedinEmail' in body) out.linkedinEmail = optString(body.linkedinEmail)
  if ('address' in body) out.address = optString(body.address)
  if ('phone' in body) out.phone = optString(body.phone)
  return out
}

export function validateCvProfileContact(contact: CvProfileContact): string | null {
  if (contact.linkedinUrl && !/linkedin\.com/i.test(contact.linkedinUrl)) {
    return 'LinkedIn profile must be a linkedin.com URL'
  }
  if (contact.linkedinEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.linkedinEmail)) {
    return 'Invalid email address'
  }
  return null
}

export const CV_PROFILE_CONTACT_SELECT = {
  linkedinUrl: true,
  linkedinEmail: true,
  address: true,
  phone: true,
} as const
