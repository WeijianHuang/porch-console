import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

/** Transport is ISO 8601 UTC; display is always Asia/Shanghai (ADR-0004). */
export function formatUTC8(iso: string | null | undefined): string {
  if (!iso) return '—'
  return dayjs.utc(iso).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm')
}
