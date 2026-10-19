import type { ImportEdge } from "#imports/graph.ts";
import type { Endpoint } from "#imports/resolve.ts";
import type { Matcher } from "./match.ts";

export interface Reached<TMatch = unknown> {
	readonly line: number;
	readonly match: TMatch;
	readonly path: readonly string[];
	readonly target: Endpoint;
}

export interface Trail {
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

interface Walk<TMatch> {
	readonly forbidden: (endpoint: Endpoint) => TMatch | undefined;
	readonly queue: string[];
	readonly reached: Map<string, Reached<TMatch>>;
	readonly trails: Map<string, Trail>;
}

function follow<TMatch>(walk: Walk<TMatch>, before: Trail, edge: ImportEdge): void {
	const label = labelOf(edge.to);
	const trail = { line: before.path.length === 1 ? edge.line : before.line, path: [...before.path, label] };
	const match = walk.forbidden(edge.to);
	if (match) {
		walk.reached.set(label, walk.reached.get(label) ?? { ...trail, match, target: edge.to });
	} else if (edge.to.kind === "file" && !walk.trails.has(edge.to.path)) {
		walk.trails.set(edge.to.path, trail);
		walk.queue.push(edge.to.path);
	}
}

export interface Walked<TMatch = unknown> {
	readonly reached: readonly Reached<TMatch>[];
	readonly visited: ReadonlyMap<string, Trail>;
}

// A breadth-first walk that stops at each forbidden endpoint, so a finding names the shortest path to the first forbidden step.
export function walkFrom<TMatch>(
	start: string,
	edgesFrom: ReadonlyMap<string, readonly ImportEdge[]>,
	forbidden: (endpoint: Endpoint) => TMatch | undefined,
): Walked<TMatch> {
	const walk: Walk<TMatch> = { forbidden, queue: [start], reached: new Map(), trails: new Map([[start, { line: 0, path: [start] }]]) };
	for (const node of walk.queue) {
		const before = walk.trails.get(node) ?? { line: 0, path: [node] };
		for (const edge of edgesFrom.get(node) ?? []) {
			follow(walk, before, edge);
		}
	}
	return { reached: [...walk.reached.values()], visited: walk.trails };
}

export function reachedFrom(start: string, edgesFrom: ReadonlyMap<string, readonly ImportEdge[]>, forbidden: Matcher): readonly Reached[] {
	return walkFrom(start, edgesFrom, forbidden).reached;
}
