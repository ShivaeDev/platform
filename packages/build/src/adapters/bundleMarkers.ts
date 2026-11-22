import { dirname, isAbsolute, join } from "node:path";
import type { Rollup } from "vite";
import type { ServerMarkers } from "#serverCode.ts";

// A marker is resolved from the root and from every folder of the graph, as that folder's own imports resolve it, so a package
// that brings its own copy of contract or Effect, or one the root cannot resolve at all, is judged by the copy it imports.
function importersOf(context: Rollup.PluginContext, root: string): readonly string[] {
	const byFolder = new Map([[root, join(root, "index.html")]]);
	for (const id of context.getModuleIds()) {
		if (isAbsolute(id) && !byFolder.has(dirname(id))) {
			byFolder.set(dirname(id), id);
		}
	}
	return [...byFolder.values()];
}

async function resolvedFrom(context: Rollup.PluginContext, importers: readonly string[], specifier: string): Promise<ReadonlySet<string>> {
	const resolved = await Promise.all(importers.map(async (importer) => (await context.resolve(specifier, importer))?.id));
	return new Set(resolved.filter((id) => id !== undefined));
}

export async function bundleMarkers(context: Rollup.PluginContext, root: string) {
	const importers = importersOf(context, root);
	const markers: ServerMarkers = {
		defineModule: await resolvedFrom(context, importers, "@shivaedev/contract/defineModule.ts"),
		sql: new Set([...(await resolvedFrom(context, importers, "effect/sql"))].map(dirname)),
	};
	return { markers, operation: await resolvedFrom(context, importers, "@shivaedev/contract/operation.ts") };
}
