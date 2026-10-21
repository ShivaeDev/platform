import { posix } from "node:path";
import type { RuleInputs } from "#rule.ts";
import type { ImportGraph } from "./graph.ts";
import { exportedModule } from "./packageExports.ts";
import { packageOf } from "./workspace.ts";

export async function publicModules(inputs: RuleInputs, graph: ImportGraph): Promise<ReadonlySet<string>> {
	const exports = new Map(
		await Promise.all(
			graph.packages.map(async (owner) => {
				const manifest: { readonly exports?: unknown } = JSON.parse((await inputs.readText(posix.join(owner.directory, "package.json"))) ?? "");
				return [owner, manifest.exports] as const;
			}),
		),
	);
	const modules = new Set<string>();
	for (const edge of graph.edges) {
		if (edge.to.kind !== "file") {
			continue;
		}
		const owner = packageOf(graph.packages, edge.to.path);
		if (owner !== undefined && exportedModule(exports.get(owner), posix.relative(owner.directory, edge.to.path))) {
			modules.add(edge.to.path);
		}
	}
	return modules;
}
