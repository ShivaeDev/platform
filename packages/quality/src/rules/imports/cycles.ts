import { cyclicComponents } from "#imports/components.ts";
import { type ImportEdge, importGraph } from "#imports/graph.ts";
import { shortestPath } from "#imports/paths.ts";
import { defineRule, type Finding } from "#rule.ts";

type RuntimeEdge = ImportEdge & { readonly to: { readonly kind: "file"; readonly path: string } };

function isRuntime(edge: ImportEdge): edge is RuntimeEdge {
	return !edge.type && edge.kind === "import" && edge.to.kind === "file";
}

function runtimeAdjacency(edges: readonly RuntimeEdge[]): ReadonlyMap<string, readonly string[]> {
	const adjacency = new Map<string, string[]>();
	for (const edge of edges) {
		adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to.path]);
	}
	return adjacency;
}

function findingOf(edges: readonly RuntimeEdge[], adjacency: ReadonlyMap<string, readonly string[]>, component: readonly string[]): Finding {
	const [anchor = ""] = component;
	const members = new Set(component);
	function within(node: string): readonly string[] {
		return (adjacency.get(node) ?? []).filter((next) => members.has(next));
	}
	const loop = shortestPath(anchor, within, (node) => node === anchor) ?? component;
	const first = edges.find((edge) => edge.from === anchor && edge.to.path === loop[1]);
	const message =
		component.length === 1
			? `${anchor} imports itself at runtime. Use its own code directly instead of importing it.`
			: `${component.length} modules import each other at runtime: ${component.join(", ")}. One loop: ${loop.join(" -> ")}. Move what they share into a module that imports neither, or import only types with \`import type\`.`;
	return { count: component.length, file: anchor, line: first?.line, message };
}

export const importCycles = defineRule({
	check: async (inputs) => {
		const edges = (await importGraph(inputs)).edges.filter(isRuntime);
		const adjacency = runtimeAdjacency(edges);
		return cyclicComponents(adjacency).map((component) => findingOf(edges, adjacency, component));
	},
	description: "Modules never import each other in a loop at runtime. A group of modules that reach one another counts once for each module in it.",
	id: "imports/cycles",
	registrable: false,
});
