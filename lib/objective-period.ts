// Utility helpers for objective periods (duration)
// Supports Firestore Timestamp (toDate), ISO strings, epoch numbers, or Date objects.

export function parseToDate(input: any): Date | null {
  if (input == null) return null
  if (input instanceof Date) return Number.isFinite(input.getTime()) ? input : null

  // Firestore Timestamp-like
  if (typeof input === "object" && typeof (input as any).toDate === "function") {
    try {
      const d = (input as any).toDate()
      return d instanceof Date && Number.isFinite(d.getTime()) ? d : null
    } catch {
      return null
    }
  }

  if (typeof input === "number") {
    const d = new Date(input)
    return Number.isFinite(d.getTime()) ? d : null
  }

  if (typeof input === "string") {
    const s = input.trim()
    if (!s) return null
    const d = new Date(s)
    return Number.isFinite(d.getTime()) ? d : null
  }

  return null
}

export function addMonthsSafe(date: Date, months: number): Date {
  const d = new Date(date)
  const m = Number(months)
  if (!Number.isFinite(m) || m === 0) return d
  const targetMonth = d.getMonth() + m
  // JS Date handles overflow.
  d.setMonth(targetMonth)
  return d
}

export type ObjectivePeriod = {
  start: Date | null
  end: Date | null
  months: number | null
  isIndefinite: boolean
  isExpired: boolean
  daysLeft: number | null
  totalDays: number | null
  elapsedPct: number | null
  label: string
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime()
  // calendar-ish day count
  return Math.round(ms / (24 * 60 * 60 * 1000))
}

export function computeObjectivePeriod(obj: any, now: Date = new Date()): ObjectivePeriod {
  const monthsRaw = obj?.periodMonths ?? obj?.durationMonths ?? null
  const months = typeof monthsRaw === "number" && Number.isFinite(monthsRaw) ? monthsRaw : null

  const start =
    parseToDate(obj?.periodStart) ||
    parseToDate(obj?.startDate) ||
    parseToDate(obj?.createdAt) ||
    null

  const end =
    parseToDate(obj?.periodEnd) ||
    parseToDate(obj?.endDate) ||
    parseToDate(obj?.deadline) ||
    null

  const isIndefinite = !end
  const isExpired = Boolean(end && end.getTime() < now.getTime())

  const daysLeft = end ? daysBetween(now, end) : null
  const totalDays = start && end ? Math.max(1, daysBetween(start, end)) : null
  const elapsedPct = start && end ? clamp01(((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) || 0) * 100 : null

  const label = isIndefinite
    ? "∞"
    : months
      ? `${months} mois`
      : totalDays != null
        ? `${totalDays} j`
        : "Période"

  return { start, end, months, isIndefinite, isExpired, daysLeft, totalDays, elapsedPct, label }
}

function clamp01(x: number) {
  if (!Number.isFinite(x)) return 0
  return Math.max(0, Math.min(1, x))
}

export function filterHistoryByPeriod(history: any[] | undefined, start: Date | null, end: Date | null) {
  const arr = Array.isArray(history) ? history : []
  if (!start && !end) return arr
  return arr.filter((h: any) => {
    const t = parseToDate(h?.timestamp) || parseToDate(h?.date) || null
    if (!t) return true
    if (start && t.getTime() < start.getTime()) return false
    if (end && t.getTime() > end.getTime()) return false
    return true
  })
}
