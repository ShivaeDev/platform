import type { ImportEdge } from "../graph.ts";
import type { Endpoint } from "../resolve.ts";
import type { Matcher } from "./match.ts";

export interface Reached {
	readonly line: number;
	readonly path: readonly string[];
	readonly target: Endpoint;
}

interface Trail {
	readonly line: number;
	readonly path: readonly string[];
}

export function labelOf(endpoint: Endpoint): string {
	if (endpoint.kind === "file") {
		return endpoint.path;
	}
	const named = endpoint.specifier === endpoint.package || endpoint.specifier.startsWith(`${endpoint.package}/`);
	return named ? endpoint.specifier : `${endpoint.specifier} (${endpoint.package})`;
}

export function outgoing(edges: readonly ImportEdge[]): ReadonlyMap<string, readonly ImportEdge[]> {
	const from = new Map<string, ImportEdge[]>();
	for (const edge of edges) {
		const known = from.get(edge.from) ?? [];
		known.push(edge);
		from.set(edge.from, known);
	}
	return from;
}

interface Walk {
	readonly forbidden: Matcher;
	readonly queue: string[];
	readonly reached: Map<string, Reached>;
	readonly trails: Map<string, Trail>;
}

function follow(walk: Walk, before: Trail, edge: ImportEdge): void {
	const label = labelOf(edge.to);
	const trail = { line: before.path.length === 1 ? edge.line : before.line, path: [...before.path, label] };
	if (walk.forbidden(edge.to)) {
		walk.reached.set(label, walk.reached.get(label) ?? { ...trail, target: edge.to });
	} else if (edge.to.kind === "file" && !walk.trails.has(edge.to.path)) {
		walk.trails.set(edge.to.path, trail);
		walk.queue.push(edge.to.path);
	}
}

// A breadth-first walk that stops at each forbidden endpoint, so a finding names the shortest path to the first forbidden step.
export function reachedFrom(start: string, edgesFrom: ReadonlyMap<string, readonly ImportEdge[]>, forbidden: Matcher): readonly Reached[] {
	const walk: Walk = { forbidden, queue: [start], reached: new Map(), trails: new Map([[start, { line: 0, path: [start] }]]) };
	for (const node of walk.queue) {
		const before = walk.trails.get(node) ?? { line: 0, path: [node] };
		for (const edge of edgesFrom.get(node) ?? []) {
			follow(walk, before, edge);
		}
	}
	return [...walk.reached.values()];
}
