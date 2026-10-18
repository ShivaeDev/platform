export function plural(count: number, singular: string, many = `${singular}s`): string {
	return `${count} ${count === 1 ? singular : many}`;
}
