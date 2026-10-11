export function resetLabel(at: number, now: number): string {
	const minutes = Math.ceil(Math.abs(at - now) / 60_000);
	let duration = `${minutes} min`;
	if (minutes >= 1440) {
		duration = `${Math.ceil(minutes / 1440)} d`;
	} else if (minutes >= 60) {
		duration = `${Math.ceil(minutes / 60)} h`;
	}
	let relative = "now";
	if (at > now) {
		relative = `in ${duration}`;
	} else if (at < now) {
		relative = `${duration} ago`;
	}
	const local = new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", hour12: false, minute: "2-digit" });
	return `${relative}, ${local}`;
}
