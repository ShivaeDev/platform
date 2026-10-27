function distance(left: string, right: string): number {
	let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
	for (const [index, letter] of [...left].entries()) {
		const next = [index + 1];
		for (const [column, other] of [...right].entries()) {
			next.push(Math.min((next[column] ?? 0) + 1, (previous[column + 1] ?? 0) + 1, (previous[column] ?? 0) + (letter === other ? 0 : 1)));
		}
		previous = next;
	}
	return previous[right.length] ?? left.length;
}

export function nearestArea(name: string, candidates: readonly string[]): string | undefined {
	function score(candidate: string) {
		return name.endsWith(`-${candidate}`) ? 0.5 : distance(name, candidate);
	}
	return [...candidates].sort((left, right) => score(left) - score(right) || left.localeCompare(right))[0];
}
