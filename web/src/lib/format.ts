// Date/time formatting that agrees across screens. Every caller passes the
// tenant timezone when it has one (`user.tenant.timezone`); until /auth/me
// sends that field we fall back to the browser's zone rather than forcing
// UTC, which would shift "today" for anyone west of Greenwich.

function resolveTimeZone(tz?: string | null) {
  if (tz) return tz
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return "UTC"
  }
}

function toDate(iso: string | Date) {
  return iso instanceof Date ? iso : new Date(iso)
}

export type FormatDateOptions = Pick<Intl.DateTimeFormatOptions, "month" | "day" | "year" | "weekday">

/** "Sep 15" by default; pass `{ year: "numeric" }` for "Sep 15, 2026". */
export function formatDate(iso: string | Date, tz?: string | null, options?: FormatDateOptions) {
  const date = toDate(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...options,
    timeZone: resolveTimeZone(tz),
  }).format(date)
}

/** "9:05 AM". */
export function formatTime(iso: string | Date, tz?: string | null) {
  const date = toDate(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: resolveTimeZone(tz),
  }).format(date)
}
