// Dates and small labels, in the visitor's own time zone.

const day = new Intl.DateTimeFormat(undefined, {
	weekday: 'short',
	month: 'short',
	day: 'numeric'
});
const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

/** "Sun, Oct 25" */
export const gameDay = (iso: string) => day.format(new Date(iso));

/** "8:20 PM" */
export const kickoff = (iso: string) => time.format(new Date(iso));

/** 4 → "W4", -2 → "L2" */
export const streak = (value: number | null) =>
	value ? `${value > 0 ? 'W' : 'L'}${Math.abs(value)}` : '—';

/** "+41", "-7", "0" */
export const signed = (value: number) => (value > 0 ? `+${value}` : String(value));
