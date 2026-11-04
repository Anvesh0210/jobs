/**
 * Date utilities bound to an injectable "today" so the demo is deterministic and
 * domain logic stays testable.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export function isIsoDate(value) {
  return typeof value === 'string' && ISO_DATE.test(value) && !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime());
}

const toDate = (iso) => new Date(`${iso}T12:00:00Z`);

export function createClock({ today, now = () => new Date(), locale = 'en-GB' }) {
  if (!isIsoDate(today)) throw new RangeError(`Invalid demo date: ${today}`);

  const format = (iso, options = { day: 'numeric', month: 'short', year: 'numeric' }) =>
    (isIsoDate(iso) ? toDate(iso).toLocaleDateString(locale, { timeZone: 'UTC', ...options }) : '');

  const daysBetween = (fromIso, toIso) => Math.round((toDate(toIso) - toDate(fromIso)) / DAY_MS);

  const short = (iso) => format(iso, { day: 'numeric', month: 'short' });

  return Object.freeze({
    today,
    format,
    daysBetween,
    daysUntil: (iso) => daysBetween(today, iso),
    longToday: () => format(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    /** Human-readable due text. Neutral wording: "past due date" rather than alarming language. */
    dueText(iso) {
      if (!isIsoDate(iso)) return 'No due date';
      const n = daysBetween(today, iso);
      if (n < 0) return `${-n} day${n === -1 ? '' : 's'} past due date (${short(iso)})`;
      if (n === 0) return 'Due today';
      return `Due in ${n} day${n === 1 ? '' : 's'} (${short(iso)})`;
    },
    /** Timestamp for history/audit entries: demo date plus the real time of day. */
    stamp() {
      const d = now();
      return `${short(today)}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  });
}
