import { isBuiltin } from "node:module";
import { dirname, join } from "node:path";
import { Option } from "effect";
import type { EnvironmentModuleNode, HookHandler, Plugin, ResolvedConfig, Rollup, ViteDevServer } from "vite";
import { runNode } from "#adapters/runNode.ts";
import { type GenerateRound, type WatchedGeneration, watchedGeneration } from "#generateRound.ts";
import { type BundleGraph, type BundleModule, type ServerMarkers, serverCodeIn } from "#serverCode.ts";

export interface BuildPluginOptions {
	readonly serverOnly?: readonly string[];
}

type HotUpdateContext = ThisParameterType<HookHandler<NonNullable<Plugin["hotUpdate"]>>>;

const BROWSER_EXTERNAL = "__vite-browser-external:";

interface SharedRound {
	readonly round: Promise<Option.Option<GenerateRound>>;
	seenBy: number;
}

function generateFiles(): Plugin {
	let config: ResolvedConfig | undefined;
	let server: ViteDevServer | undefined;
	let generation: Promise<WatchedGeneration> | undefined;
	let started: Promise<GenerateRound> | undefined;
	let outputs = new Set<string>();
	// One change reaches hotUpdate once per environment; they share one run.
	const shared = new Map<string, SharedRound>();
	function remember(round: GenerateRound) {
		outputs = new Set([...outputs, ...round.outputs]);
		if (server !== undefined) {
			const root = server.config.root;
			server.watcher.add(round.inputs.filter((file) => !file.startsWith(root)));
		}
		return round;
	}
	function sharedRound(changed: WatchedGeneration["changed"], file: string, timestamp: number, environments: number) {
		const key = `${timestamp}\u0000${file}`;
		const entry = shared.get(key) ?? { round: runNode(changed(file)), seenBy: 0 };
		entry.seenBy += 1;
		shared.set(key, entry);
		if (entry.seenBy === environments) {
			shared.delete(key);
		}
		return entry.round;
	}
	return {
		async buildStart(this: Rollup.PluginContext) {
			generation ??= runNode(watchedGeneration(config?.root ?? "."));
			const { run } = await generation;
			started ??= runNode(run);
			const round = remember(await started);
			if (Option.isSome(round.refusal)) {
				this.error(round.refusal.value);
			}
		},
		configResolved(resolved) {
			config = resolved;
		},
		configureServer(devServer) {
			server = devServer;
		},
		enforce: "pre",
		async hotUpdate(this: HotUpdateContext, { file, modules, server: devServer, timestamp }) {
			// A run hands Vite the modules of each file it rewrites, so the watcher's own event for that write would reload twice.
			if (outputs.has(file)) {
				return [];
			}
			if (generation === undefined) {
				return;
			}
			const { changed } = await generation;
			const round = Option.map(await sharedRound(changed, file, timestamp, Object.keys(devServer.environments).length), remember);
			if (Option.isNone(round)) {
				return;
			}
			if (Option.isSome(round.value.refusal)) {
				if (this.environment.config.consumer === "client") {
					devServer.config.logger.error(round.value.refusal.value, { timestamp: true });
					this.environment.hot.send({ err: { message: round.value.refusal.value, plugin: "shivaedev:build", stack: "" }, type: "error" });
				}
				return [];
			}
			const regenerated = round.value.changed.flatMap((output): EnvironmentModuleNode[] => [
				...(this.environment.moduleGraph.getModulesByFile(output) ?? []),
			]);
			return [...modules, ...regenerated];
		},
		name: "shivaedev:build-generate",
	};
}

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

function bundleCheck(serverOnly: readonly string[]): Plugin {
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

export function buildPlugin(options: BuildPluginOptions = {}): Plugin[] {
	return [generateFiles(), bundleCheck(options.serverOnly ?? [])];
}
