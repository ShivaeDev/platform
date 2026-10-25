function trail(previous: ReadonlyMap<string, string | undefined>, node: string): readonly string[] {
	const path: string[] = [];
	for (let step: string | undefined = node; step !== undefined; step = previous.get(step)) {
		path.unshift(step);
	}
	return path;
}

export function shortestPath(
	start: string,
	neighbours: (node: string) => readonly string[],
	goal: (node: string) => boolean,
): readonly string[] | undefined {
	const previous = new Map<string, string | undefined>([[start, undefined]]);
	const queue = [start];
	for (const node of queue) {
		for (const next of neighbours(node)) {
			if (goal(next)) {
				return [...trail(previous, node), next];
			}
			if (!previous.has(next)) {
				previous.set(next, node);
				queue.push(next);
			}
		}
	}
	return undefined;
}
