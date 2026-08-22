/**
 * Period-boundary math (ticket #8). Given an explicit instant (`now`) and an
 * IANA time zone (user.timeZone, defaulting Africa/Cairo), returns the
 * [start, end) window of the week or month containing that instant, computed
 * on the user's lived calendar — story #29: boundaries in the user's
 * timezone, not UTC. Uses only Intl APIs; no date libraries. Exported for
 * reuse by reports, dashboard, and recurring materialization.
 *
 * Week-start choice: MONDAY (ISO 8601). Picked over Sunday-start because the
 * product targets an Egyptian user base where the work/school week runs
 * Sunday–Thursday, making Monday the natural "new budget week" boundary and
 * matching the ISO standard most tooling assumes.
 *
 * All windows are half-open: `start` inclusive, `end` exclusive — queries use
 * `occurredAt >= start AND occurredAt < end`, which never double-counts.
 */

export const DEFAULT_TIME_ZONE = 'Africa/Cairo'

export type PeriodType = 'week' | 'month'

export interface Period {
  /** Inclusive lower bound, UTC instant. */
  start: Date
  /** Exclusive upper bound, UTC instant. */
  end: Date
}

/** Offset of `timeZone` from UTC in milliseconds at the given instant. */
function tzOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value)
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
  return asUtc - instant.getTime()
}

/**
 * Wall-clock midnight of a Y/M/D calendar date in `timeZone`, as a UTC
 * instant. Two correction passes converge even when DST shifts move the
 * offset between the naive guess and the answer (Egypt observes DST).
 */
function midnight(year: number, month: number, day: number, timeZone: string): Date {
  let guess = Date.UTC(year, month - 1, day)
  for (let i = 0; i < 2; i++) {
    guess = Date.UTC(year, month - 1, day) - tzOffsetMs(new Date(guess), timeZone)
  }
  return new Date(guess)
}

/** Y/M/D of the instant as rendered on the `timeZone` calendar. */
function dateInZone(
  instant: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value)
  return { year: get('year'), month: get('month'), day: get('day') }
}

/**
 * The week or month containing `now`, bounded on the `timeZone` calendar.
 * Weeks start Monday; both bounds are local midnights converted to instants.
 */
export function periodContaining(
  periodType: PeriodType,
  now: Date,
  timeZone: string = DEFAULT_TIME_ZONE,
): Period {
  const { year, month, day } = dateInZone(now, timeZone)

  if (periodType === 'month') {
    return {
      start: midnight(year, month, 1, timeZone),
      end: month === 12 ? midnight(year + 1, 1, 1, timeZone) : midnight(year, month + 1, 1, timeZone),
    }
  }

  // Day-of-week (0=Sun..6=Sat) of the local calendar date, projected onto UTC
  // purely for arithmetic — stepping back to Monday happens in plain calendar
  // space, before any zone conversion.
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const daysSinceMonday = (weekday + 6) % 7
  const monday = new Date(Date.UTC(year, month - 1, day - daysSinceMonday))
  const nextMonday = new Date(Date.UTC(year, month - 1, day - daysSinceMonday + 7))
  return {
    start: midnight(
      monday.getUTCFullYear(),
      monday.getUTCMonth() + 1,
      monday.getUTCDate(),
      timeZone,
    ),
    end: midnight(
      nextMonday.getUTCFullYear(),
      nextMonday.getUTCMonth() + 1,
      nextMonday.getUTCDate(),
      timeZone,
    ),
  }
}
