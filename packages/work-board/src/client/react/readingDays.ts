import type { Item } from "#client/react/LibraryContext.ts";

const dayName = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long", weekday: "long" });

function startOfDay(at: number) {
	return new Date(at).setHours(0, 0, 0, 0);
}

function dayTitle(day: number, today: number) {
	if (day === Number.NEGATIVE_INFINITY) {
		return "Earlier";
	}
	if (day === today) {
		return "Today";
	}
	const yesterday = new Date(today).setDate(new Date(today).getDate() - 1);
	return day === yesterday ? "Yesterday" : dayName.format(day);
}

// Entries saved before read times were recorded have no day, so they close the list under "Earlier".
export function readingDays(items: readonly Item[], now: number) {
	const today = startOfDay(now);
	const days = Map.groupBy(items, (item) => (item.at === undefined ? Number.NEGATIVE_INFINITY : startOfDay(item.at)));
	return [...days].map(([day, entries]) => ({ entries, title: dayTitle(day, today) }));
}
