import type { ImportGraph } from "#imports/graph.ts";
import type { PackageLayout } from "#naming/packageLayout.ts";
import type { RuleInputs } from "#rule.ts";
import { bundlerEntries } from "./bundlerEntries.ts";
import { spawnedEntries } from "./spawnedEntries.ts";

function scriptsByPackage(layout: PackageLayout): ReadonlyMap<string, readonly string[]> {
	const scripts = new Map<string, string[]>();
	for (const script of layout.scripts) {
		const roots = [...layout.names.keys()].filter((folder) => folder === "" || script.startsWith(`${folder}/`));
		const directory = roots.toSorted((left, right) => right.length - left.length)[0] ?? "";
		scripts.set(directory, [...(scripts.get(directory) ?? []), script]);
	}
	return scripts;
}

function reachable(roots: readonly string[], imports: ReadonlyMap<string, readonly string[]>): ReadonlySet<string> {
	const visited = new Set<string>();
	const pending = [...roots];
	while (pending.length > 0) {
		const path = pending.pop();
		if (path === undefined || visited.has(path)) {
			continue;
		}
		visited.add(path);
		pending.push(...(imports.get(path) ?? []));
	}
	return visited;
}

function importsOf(graph: ImportGraph): ReadonlyMap<string, readonly string[]> {
	const imports = new Map<string, string[]>();
	for (const edge of graph.edges) {
		if (!edge.type && edge.to.kind === "file") {
			imports.set(edge.from, [...(imports.get(edge.from) ?? []), edge.to.path]);
		}
	}
	return imports;
}

export function reachableBuildEntries(inputs: RuleInputs, graph: ImportGraph, layout: PackageLayout): ReadonlySet<string> {
	const imports = importsOf(graph);
	const sources = new Map(inputs.sources.map((source) => [source.path, source]));
	const entries = new Set<string>();
	for (const [directory, scripts] of scriptsByPackage(layout)) {
		for (const path of reachable(scripts, imports)) {
			const source = sources.get(path);
			if (source === undefined) {
				continue;
			}
			for (const entry of [...bundlerEntries(source, inputs.root, directory), ...spawnedEntries(source, inputs.root, directory)]) {
				if (sources.has(entry)) {
					entries.add(entry);
				}
			}
		}
	}
	return entries;
}
