import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { loadConfig, type ResolvedConfig } from "#config/load.ts";
import type { SetupFailure } from "#failure.ts";
import { linkPackage } from "./tree.ts";

interface ConfigEngine {
	loaded: ResolvedConfig | undefined;
	problem: SetupFailure | undefined;
	readonly root: string;
}

function loadedConfig(engine: ConfigEngine): ResolvedConfig {
	if (engine.loaded === undefined) {
		throw new Error("Load a config that quality accepts before reading its settings");
	}
	return engine.loaded;
}

function problemOf(engine: ConfigEngine): SetupFailure {
	if (engine.problem === undefined) {
		throw new Error("Load a config that quality refuses before reading its problem");
	}
	return engine.problem;
}

export const configLoading = storyKit({
	create: () =>
		Effect.acquireRelease(
			Effect.sync((): ConfigEngine => {
				const root = realpathSync(mkdtempSync(join(tmpdir(), "quality-config-")));
				linkPackage(root);
				return { loaded: undefined, problem: undefined, root };
			}),
			(engine) => Effect.sync(() => rmSync(engine.root, { force: true, recursive: true })),
		),
	inspect: ({ problem }) => ({ problem: problem?.message }),
	layer: NodeFileSystem.layer,
	name: "Quality config",
	stages: ["repository"],
	verbs: (engine, story) => ({
		activeRules: () => Effect.sync(() => loadedConfig(engine).active.map((rule) => rule.id)),
		issues: () =>
			Effect.sync(() =>
				problemOf(engine)
					.message.split("\n")
					.filter((line) => line.startsWith("  - "))
					.map((line) => line.slice("  - ".length)),
			),
		loads: (path?: string) =>
			Effect.gen(function* () {
				story.tell(path === undefined ? "quality loads the repository's config" : `quality loads the config at ${path}`);
				return yield* loadConfig(engine.root, path).pipe(
					Effect.match({
						onFailure: (failure) => {
							engine.problem = failure;
							return "refused" as const;
						},
						onSuccess: (loaded) => {
							engine.loaded = loaded;
							return "loaded" as const;
						},
					}),
				);
			}),
		outcome: () =>
			Effect.sync(() => {
				if (engine.loaded !== undefined) {
					return "loaded";
				}
				return engine.problem === undefined ? "not loaded yet" : "refused";
			}),
		problem: () => Effect.sync(() => problemOf(engine).message.replaceAll(`${engine.root}/`, "")),
		problemCause: () =>
			Effect.sync(() => {
				const cause = problemOf(engine).cause;
				return cause instanceof Error ? cause.message : cause;
			}),
		serializedProblem: () => Effect.sync(() => JSON.stringify(problemOf(engine))),
		settings: () =>
			Effect.sync(() => {
				const loaded = loadedConfig(engine);
				return {
					baseline: loaded.baseline,
					file: relative(engine.root, loaded.file),
					registry: loaded.registry,
					root: relative(engine.root, loaded.root),
					sources: loaded.sources,
				};
			}),
	}),
});

export function configFile(content: string, path = "quality.config.ts") {
	return configLoading.trait("repository", `${path} reads: ${content}`, (engine) => {
		mkdirSync(dirname(join(engine.root, path)), { recursive: true });
		writeFileSync(join(engine.root, path), content);
	});
}

export function configLinksToMissingFile() {
	return configLoading.trait("repository", "quality.config.ts is a symlink to a file that does not exist", (engine) => {
		symlinkSync(join(engine.root, "missing-target"), join(engine.root, "quality.config.ts"));
	});
}
