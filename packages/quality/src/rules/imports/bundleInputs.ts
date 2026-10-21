import { posix } from "node:path";
import { outgoing } from "#imports/fences/reach.ts";
import type { ImportGraph } from "#imports/graph.ts";
import { blockedExport, exportedModule, exportTargets } from "#imports/packageExports.ts";
import { packageOf, type WorkspacePackage } from "#imports/workspace.ts";

function executable(manifest: object, local: string): boolean {
	const binTargets = exportTargets(Reflect.get(manifest, "bin"));
	const built = local.replace(/^src\//u, "dist/").replace(/\.(?<mode>[cm]?)tsx?$/u, ".$<mode>js");
	return binTargets.some((target) => typeof target === "string" && [local, built].includes(posix.normalize(target)));
}

export function bundleInputs(graph: ImportGraph, owner: WorkspacePackage, manifest: object, developmentFile: (path: string) => boolean) {
	const modules = graph.modules.filter((path) => (packageOf(graph.packages, path) ?? (owner.directory === "." ? owner : undefined)) === owner);
	const privateFiles = new Set(
		modules.filter((path) => {
			const local = posix.relative(owner.directory, path);
			return (
				local.startsWith("src/")
				&& blockedExport(Reflect.get(manifest, "exports"), `./${local.slice(4)}`)
				&& !exportedModule(Reflect.get(manifest, "exports"), local)
			);
		}),
	);
	const queue = modules.filter(
		(path) => executable(manifest, posix.relative(owner.directory, path)) || !(developmentFile(path) || privateFiles.has(path)),
	);
	const runtime = new Set(queue);
	const edges = outgoing(graph.edges);
	for (const path of queue) {
		for (const edge of edges.get(path) ?? []) {
			if (edge.to.kind === "file" && !runtime.has(edge.to.path)) {
				runtime.add(edge.to.path);
				queue.push(edge.to.path);
			}
		}
	}
	return { privateFiles, runtime };
}
