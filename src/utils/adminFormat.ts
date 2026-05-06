// Shared formatters for the admin dashboard surfaces (AdminDashboard,
// AdminUserDrawer). Kept tiny on purpose — locale-aware date/number
// helpers that should look identical wherever they're rendered.

export function fmtCount(n: number | undefined | null): string {
  if (n == null) return '—'
  return n.toLocaleString()
}

export function formatNum(n: number | undefined | null): string {
  if (n == null) return '—'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: n % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  })
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString()
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffMin < 60 * 24) return `${Math.round(diffMin / 60)}h ago`
  const days = Math.round(diffMin / (60 * 24))
  if (days < 30) return `${days}d ago`
  return d.toLocaleDateString()
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}
