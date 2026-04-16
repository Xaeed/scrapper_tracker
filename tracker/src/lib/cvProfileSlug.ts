/** Slug for n8n filenames — matches workflow "Validate + Select CV" for base_cv_html path */
export function slugifyCvProfileName(name: string): string {
  const raw = name.trim().toLowerCase()
  return raw.replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '') || 'custom'
}
