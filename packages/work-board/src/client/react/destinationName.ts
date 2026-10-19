export function destinationName(label: string, count: number | null | undefined, unit: string, singular = unit) {
	return count === null || count === undefined ? label : `${label}, ${count} ${count === 1 ? singular : unit}`;
}
