const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateString(value: unknown): value is string {
  return typeof value === "string" && DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Today's calendar date (YYYY-MM-DD) in the given IANA time zone. */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

/** The exact instant a calendar day begins in the given time zone. */
export function startOfDayIn(date: string, timeZone: string): Date {
  const utcMidnight = new Date(`${date}T00:00:00Z`);
  const first = new Date(utcMidnight.getTime() - offsetMinutes(utcMidnight, timeZone) * 60000);
  // Re-check the offset at the result so a daylight-saving change can't leave us an hour off.
  const second = new Date(utcMidnight.getTime() - offsetMinutes(first, timeZone) * 60000);
  return second;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}
