import { posix } from "node:path";
import { outgoing } from "#imports/fences/reach.ts";
import type { ImportGraph } from "#imports/graph.ts";
import { packageOf, type WorkspacePackage } from "#imports/workspace.ts";

function blocked(exports: unknown, subpath: string): boolean {
	if (typeof exports !== "object" || exports === null || Array.isArray(exports)) {
		return false;
	}
	const entries = Object.entries(exports);
	const exact = entries.find(([key]) => key === subpath);
	if (exact !== undefined) {
		return exact[1] === null;
	}
	const matching = entries.filter(([key]) => {
		const [prefix = "", suffix, ...rest] = key.split("*");
		return (
			suffix !== undefined
			&& rest.length === 0
			&& subpath.length > prefix.length + suffix.length
			&& subpath.startsWith(prefix)
			&& subpath.endsWith(suffix)
		);
	});
	const best = matching.toSorted(([left], [right]) => right.indexOf("*") - left.indexOf("*") || right.length - left.length)[0];
	return best?.[1] === null;
}

function targets(value: unknown): string[] {
	if (typeof value === "string") {
		return [value];
	}
	return typeof value === "object" && value !== null ? Object.values(value).flatMap(targets) : [];
}

function exported(exports: unknown, local: string): boolean {
	if (typeof exports !== "object" || exports === null) {
		return false;
	}
	const paths = [
		`./${local}`,
		`./${local.replace(/^src\//u, "dist/").replace(/\.(?<mode>[cm]?)tsx?$/u, ".$<mode>js")}`,
		`./${local.replace(/^src\//u, "dist/").replace(/\.(?<mode>[cm]?)tsx?$/u, ".d.$<mode>ts")}`,
	];
	return Object.entries(exports).some(([key, value]) =>
		targets(value).some((target) =>
			paths.some((path) => {
				const [prefix = "", suffix] = target.split("*");
				if (suffix === undefined) {
					return path === target && !blocked(exports, key);
				}
				if (!(path.startsWith(prefix) && path.endsWith(suffix)) || path.length <= prefix.length + suffix.length) {
					return false;
				}
				const star = path.slice(prefix.length, path.length - suffix.length);
				return !blocked(exports, key.replace("*", star));
			}),
		),
	);
}

function executable(manifest: object, local: string): boolean {
	const binTargets = targets(Reflect.get(manifest, "bin"));
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
				&& blocked(Reflect.get(manifest, "exports"), `./${local.slice(4)}`)
				&& !exported(Reflect.get(manifest, "exports"), local)
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
