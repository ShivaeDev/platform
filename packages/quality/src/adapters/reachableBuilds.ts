import { bundlerModules, bundlerSources } from "#adapters/bundlerSources.ts";
import { bundlerTargets } from "#adapters/bundlerTargets.ts";
import { spawnedEntries } from "#adapters/spawnedEntries.ts";
import type { ImportGraph } from "#imports/graph.ts";
import type { PackageLayout } from "#naming/packageLayout.ts";
import type { RuleInputs } from "#rule.ts";

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

export interface ReachableBuilds {
	readonly entries: ReadonlySet<string>;
	readonly externals: ReadonlyMap<string, ReadonlySet<string>>;
}

export function reachableBuilds(inputs: RuleInputs, graph: ImportGraph, layout: PackageLayout): ReachableBuilds {
	const imports = importsOf(graph);
	const sources = new Map(inputs.sources.map((source) => [source.path, source]));
	const syntax = bundlerSources(inputs.sources, graph);
	const modules = bundlerModules(syntax, inputs.sources, graph);
	const entries = new Set<string>();
	const externals = new Map<string, ReadonlySet<string>>();
	for (const [directory, scripts] of scriptsByPackage(layout)) {
		const targets = [...reachable(scripts, imports)].flatMap((path) => {
			const source = sources.get(path);
			if (source === undefined) {
				return [];
			}
			const bundled = syntax.has(path) ? bundlerTargets(source, inputs.root, directory, syntax, modules) : { entries: [], externals: [] };
			return [{ entries: [...bundled.entries, ...spawnedEntries(source, inputs.root, directory)], externals: bundled.externals }];
		});
		for (const entry of targets.flatMap((target) => target.entries).filter((target) => sources.has(target))) {
			entries.add(entry);
		}
		externals.set(directory, new Set(targets.flatMap((target) => target.externals)));
	}
	return { entries, externals };
}
