type ApiErr = { response?: { data?: { detail?: unknown } } }

export function apiError(err: unknown, fallback = 'Er is een fout opgetreden'): string {
  const detail = (err as ApiErr)?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((d) => (d as { msg?: string }).msg ?? String(d)).join('; ')
  return fallback
}
