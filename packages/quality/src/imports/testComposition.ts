import type { ImportGraph } from "#imports/graph.ts";
import { packageOf, type WorkspacePackage } from "#imports/workspace.ts";

export function testComposition(graph: ImportGraph, privatePackages: readonly WorkspacePackage[], testFile: (path: string) => boolean) {
	const candidates = new Set(privatePackages);
	const imports = graph.edges.flatMap((edge) => {
		const from = packageOf(graph.packages, edge.from);
		const to = edge.to.kind === "file" ? packageOf(graph.packages, edge.to.path) : undefined;
		return to === undefined || from === to ? [] : [{ from, path: edge.from, to }];
	});
	return compositions(imports, candidates, testFile);
}

interface Consumer {
	readonly from: WorkspacePackage | undefined;
	readonly path: string;
	readonly to: WorkspacePackage;
}

function compositions(imports: readonly Consumer[], candidates: ReadonlySet<WorkspacePackage>, testFile: (path: string) => boolean) {
	const reached = new Set<WorkspacePackage>();
	let changed = true;
	while (changed) {
		changed = false;
		for (const edge of imports) {
			if (candidates.has(edge.to) && !reached.has(edge.to) && (testFile(edge.path) || (edge.from !== undefined && reached.has(edge.from)))) {
				reached.add(edge.to);
				changed = true;
			}
		}
	}
	return withoutProductionConsumers(imports, reached, testFile);
}

function withoutProductionConsumers(imports: readonly Consumer[], reached: Set<WorkspacePackage>, testFile: (path: string) => boolean) {
	let changed = true;
	while (changed) {
		changed = false;
		for (const edge of imports) {
			if (reached.has(edge.to) && !testFile(edge.path) && (edge.from === undefined || !reached.has(edge.from))) {
				reached.delete(edge.to);
				changed = true;
			}
		}
	}
	return reached;
}
