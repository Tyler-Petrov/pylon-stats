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

/** "10-7", or "9-7-1" once there's a tie. */
export const record = ({ wins, losses, ties }: { wins: number; losses: number; ties: number }) =>
	`${wins}-${losses}${ties ? `-${ties}` : ''}`;

/** 1 → "1", 5 → "OT", 6 → "2OT". In full: "1st quarter", "Overtime", "Overtime 2". */
export function period(n: number, long = false) {
	if (n <= 4) return long ? `${['1st', '2nd', '3rd', '4th'][n - 1]} quarter` : String(n);
	const ot = n > 5 ? n - 4 : '';
	return long ? `Overtime${ot ? ` ${ot}` : ''}` : `${ot}OT`;
}
