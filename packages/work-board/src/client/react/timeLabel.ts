const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const relative = new Intl.RelativeTimeFormat(undefined, { style: "narrow" });
const sameYear = new Intl.DateTimeFormat(undefined, { day: "numeric", hour: "2-digit", minute: "2-digit", month: "short" });
const otherYear = new Intl.DateTimeFormat(undefined, { day: "numeric", hour: "2-digit", minute: "2-digit", month: "short", year: "numeric" });
const exact = new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "long" });

function relativeUnit(distance: number): readonly [number, Intl.RelativeTimeFormatUnit] {
	if (distance < HOUR) {
		return [MINUTE, "minute"];
	}
	if (distance < DAY) {
		return [HOUR, "hour"];
	}
	return [DAY, "day"];
}

export function timeLabel(at: number, now: number): string {
	const distance = Math.abs(now - at);
	if (distance < MINUTE) {
		return "just now";
	}
	if (distance < WEEK) {
		const [size, unit] = relativeUnit(distance);
		return relative.format((at < now ? -1 : 1) * Math.floor(distance / size), unit);
	}
	return (new Date(at).getFullYear() === new Date(now).getFullYear() ? sameYear : otherYear).format(at);
}

export function exactTime(at: number): string {
	return exact.format(at);
}
