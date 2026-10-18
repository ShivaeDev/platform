export function destinationName(label: string, count: number | null | undefined, unit: string) {
	return count === null || count === undefined ? label : `${label}, ${count} ${unit}`;
}
