function position(text: string, offset: number): string {
	const lines = text.slice(0, offset).split("\n");
	return `${lines.length}:${[...(lines.at(-1) ?? "")].length + 1}`;
}

function range(before: string, after: string): string {
	let start = 0;
	while (start < before.length && start < after.length && before[start] === after[start]) {
		start += 1;
	}
	let end = before.length;
	let otherEnd = after.length;
	while (end > start && otherEnd > start && before[end - 1] === after[otherEnd - 1]) {
		end -= 1;
		otherEnd -= 1;
	}
	return `${position(before, start)}-${position(before, end)}`;
}

export function changedRanges(before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>, pass: string): readonly string[] {
	return [...new Set([...before.keys(), ...after.keys()])]
		.filter((path) => before.get(path) !== after.get(path))
		.map((path) => `${path}:${range(before.get(path) ?? "", after.get(path) ?? "")} (${pass})`);
}
