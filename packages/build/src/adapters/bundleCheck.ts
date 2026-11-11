import { isBuiltin } from "node:module";
import { dirname, join } from "node:path";
import { Option } from "effect";
import type { Plugin, Rollup } from "vite";
import { runNode } from "#adapters/runNode.ts";
import { type BundleGraph, type BundleModule, type ServerMarkers, serverCodeIn } from "#serverCode.ts";

const BROWSER_EXTERNAL = "__vite-browser-external:";

function graphOf(context: Rollup.PluginContext): BundleGraph {
	const modules = new Map<string, BundleModule>();
	const entries: string[] = [];
	for (const id of context.getModuleIds()) {
		const info = context.getModuleInfo(id);
		if (info !== null) {
			if (info.isEntry) {
				entries.push(id);
			}
			const bare = id.startsWith(BROWSER_EXTERNAL) ? id.slice(BROWSER_EXTERNAL.length) : id;
			modules.set(id, { builtin: isBuiltin(bare), imports: [...info.importedIds, ...info.dynamicallyImportedIds] });
		}
	}
	return { entries, modules };
}

async function markersFrom(context: Rollup.PluginContext, root: string): Promise<ServerMarkers> {
	const importer = join(root, "index.html");
	async function resolved(specifier: string) {
		return Option.fromNullishOr((await context.resolve(specifier, importer))?.id);
	}
	return {
		defineModule: await resolved("@shivaedev/contract/defineModule.ts"),
		operation: await resolved("@shivaedev/contract/operation.ts"),
		sql: Option.map(await resolved("effect/sql"), dirname),
	};
}

export function bundleCheck(serverOnly: readonly string[]): Plugin {
	let root = ".";
	return {
		apply: "build",
		applyToEnvironment: (environment) => environment.config.consumer === "client",
		async buildEnd(this: Rollup.PluginContext, error) {
			if (error !== undefined) {
				return;
			}
			const found = await runNode(serverCodeIn(graphOf(this), await markersFrom(this, root), { root, serverOnly }));
			if (Option.isSome(found)) {
				this.error(found.value);
			}
		},
		configResolved(resolved) {
			root = resolved.root;
		},
		name: "shivaedev:build-bundle-check",
	};
}
