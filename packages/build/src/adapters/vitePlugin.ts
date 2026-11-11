import { Option } from "effect";
import type { EnvironmentModuleNode, HookHandler, Plugin, ResolvedConfig, Rollup, ViteDevServer } from "vite";
import { bundleCheck } from "#adapters/bundleCheck.ts";
import { runNode } from "#adapters/runNode.ts";
import { type GenerateRound, type WatchedGeneration, watchedGeneration } from "#generateRound.ts";

export interface BuildPluginOptions {
	readonly serverOnly?: readonly string[];
}

type HotUpdateContext = ThisParameterType<HookHandler<NonNullable<Plugin["hotUpdate"]>>>;

interface SharedRound {
	readonly round: Promise<Option.Option<GenerateRound>>;
	seenBy: number;
}

function tellTheBrowser(environment: HotUpdateContext["environment"], devServer: ViteDevServer, refusal: Option.Option<string>, file: string) {
	if (Option.isSome(refusal)) {
		devServer.config.logger.error(refusal.value, { timestamp: true });
		environment.hot.send({ err: { message: refusal.value, plugin: "shivaedev:build", stack: "" }, type: "error" });
		return;
	}
	environment.hot.send({ path: "*", triggeredBy: file, type: "full-reload" });
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
			// A run hands Vite the modules of each file it rewrites and reloads the page when it creates one, since a page may have failed
			// to resolve it, so the watcher's own event for that write would reload twice.
			if (outputs.has(file)) {
				return [];
			}
			if (generation === undefined) {
				return;
			}
			const known = outputs;
			const { changed } = await generation;
			const round = Option.map(await sharedRound(changed, file, timestamp, Object.keys(devServer.environments).length), remember);
			if (Option.isNone(round)) {
				return;
			}
			if (Option.isSome(round.value.refusal) || round.value.changed.some((output) => !known.has(output))) {
				if (this.environment.config.consumer === "client") {
					tellTheBrowser(this.environment, devServer, round.value.refusal, file);
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

export function buildPlugin(options: BuildPluginOptions = {}): Plugin[] {
	return [generateFiles(), bundleCheck(options.serverOnly ?? [])];
}
