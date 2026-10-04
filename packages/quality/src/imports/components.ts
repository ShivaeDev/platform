interface Frame {
	next: number;
	readonly node: string;
}

interface Search {
	readonly adjacency: ReadonlyMap<string, readonly string[]>;
	readonly found: string[][];
	readonly index: Map<string, number>;
	readonly low: Map<string, number>;
	readonly open: Set<string>;
	readonly stack: string[];
}

function byPath(left: string, right: string): number {
	return left.localeCompare(right);
}

function enter(search: Search, frames: Frame[], node: string): void {
	const index = search.index.size;
	search.index.set(node, index);
	search.low.set(node, index);
	search.stack.push(node);
	search.open.add(node);
	frames.push({ next: 0, node });
}

function lowOf(search: Search, node: string): number {
	return search.low.get(node) ?? 0;
}

function close(search: Search, node: string): void {
	if (lowOf(search, node) !== search.index.get(node)) {
		return;
	}
	const component: string[] = [];
	for (let member = search.stack.pop(); member !== undefined; member = member === node ? undefined : search.stack.pop()) {
		search.open.delete(member);
		component.push(member);
	}
	const loops = (search.adjacency.get(node) ?? []).includes(node);
	if (component.length > 1 || loops) {
		search.found.push(component.sort(byPath));
	}
}

function step(search: Search, frames: Frame[], frame: Frame): void {
	const neighbour = (search.adjacency.get(frame.node) ?? [])[frame.next];
	if (neighbour === undefined) {
		frames.pop();
		const parent = frames.at(-1);
		if (parent !== undefined) {
			search.low.set(parent.node, Math.min(lowOf(search, parent.node), lowOf(search, frame.node)));
		}
		close(search, frame.node);
		return;
	}
	frame.next += 1;
	if (!search.index.has(neighbour)) {
		enter(search, frames, neighbour);
	} else if (search.open.has(neighbour)) {
		search.low.set(frame.node, Math.min(lowOf(search, frame.node), search.index.get(neighbour) ?? 0));
	}
}

// Tarjan's algorithm with an explicit stack, so a long import chain cannot overflow the call stack.
export function cyclicComponents(adjacency: ReadonlyMap<string, readonly string[]>): readonly (readonly string[])[] {
	const search: Search = { adjacency, found: [], index: new Map(), low: new Map(), open: new Set(), stack: [] };
	for (const node of [...adjacency.keys()].sort(byPath)) {
		if (search.index.has(node)) {
			continue;
		}
		const frames: Frame[] = [];
		enter(search, frames, node);
		for (let frame = frames.at(-1); frame !== undefined; frame = frames.at(-1)) {
			step(search, frames, frame);
		}
	}
	return search.found.sort((left, right) => byPath(left[0] ?? "", right[0] ?? ""));
}
