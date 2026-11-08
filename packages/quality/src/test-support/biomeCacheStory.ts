import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Deferred, Effect } from "effect";
import { ChildProcessSpawner } from "effect/process";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type BiomeRun, runBiome } from "#adapters/biome/run.ts";
import { services } from "#adapters/runMain.ts";
import { crashBiome } from "#test/crashBiome.ts";
import { isolatedEnvironment } from "#testing/adapters/git.ts";
import { defaultTree, removeSeededTrees } from "#testing/adapters/tree.ts";

interface CacheEngine {
	crash: string | undefined;
	results: readonly BiomeRun[];
	readonly root: string;
}

function cachedFiles(root: string): readonly string[] {
	return readdirSync(join(root, "node_modules", ".cache", "quality", "biome")).toSorted();
}

const parallelChecks = Effect.fn("BiomeCache.parallelChecks")(function* (root: string) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const ready = yield* Deferred.make<void>();
	let arrivals = 0;
	const together = ChildProcessSpawner.ChildProcessSpawner.of({
		...spawner,
		spawn: (command) =>
			Effect.gen(function* () {
				if (command._tag === "StandardCommand" && command.args.some((arg) => typeof arg === "string" && arg.endsWith("/biome/bin/biome"))) {
					arrivals += 1;
					if (arrivals === 2) {
						yield* Deferred.succeed(ready, undefined);
					}
					yield* Deferred.await(ready);
				}
				return yield* spawner.spawn(command);
			}),
	});
	return yield* Effect.all(
		["first", "second"].map((name) =>
			runBiome(
				root,
				["check", `src/${name}.ts`],
				[{ files: [`src/${name}.ts`], reason: "The external format is untyped.", rules: ["biome/lint/suspicious/noExplicitAny"] }],
			),
		),
		{ concurrency: "unbounded" },
	).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, together));
});

export const biomeCacheStory = storyKit({
	*create() {
		yield* Effect.addFinalizer(() => Effect.sync(removeSeededTrees));
		const root = defaultTree();
		execFileSync("git", ["init", "--quiet"], { cwd: root, env: isolatedEnvironment(root) });
		const engine: CacheEngine = { crash: undefined, results: [], root };
		return engine;
	},
	layer: services,
	name: "Biome config cache",
	stages: ["repository"],
	verbs: (engine, story) => ({
		cache: () =>
			Effect.sync(() =>
				cachedFiles(engine.root).map((file) => [
					file,
					statSync(join(engine.root, "node_modules/.cache/quality/biome", file)).ino,
					readFileSync(join(engine.root, "node_modules/.cache/quality/biome", file), "utf8"),
				]),
			),
		crashes: Effect.fn("BiomeCache.crashes")(function* () {
			story.tell("the Quality process is killed with SIGKILL after starting Biome");
			engine.crash = yield* crashBiome(engine.root);
		}),
		crashSignal: () => Effect.sync(() => engine.crash),
		repositoryFiles: () =>
			Effect.sync(() =>
				execFileSync("git", ["ls-files", "--others", "--exclude-standard"], {
					cwd: engine.root,
					encoding: "utf8",
					env: isolatedEnvironment(engine.root),
				})
					.trim()
					.split("\n")
					.toSorted(),
			),
		results: () => Effect.sync(() => engine.results),
		runs: Effect.fn("BiomeCache.runs")(function* () {
			story.tell("Quality checks src/value.ts with Biome");
			engine.results = [yield* runBiome(engine.root, ["check", "src/value.ts"])];
		}),
		runsInParallel: Effect.fn("BiomeCache.runsInParallel")(function* () {
			story.tell("two Quality runs check different files with different exceptions at the same time");
			engine.results = yield* parallelChecks(engine.root);
		}),
	}),
});

export const untypedFiles = biomeCacheStory.trait("repository", "two exported values use any in separate files", (engine) => {
	for (const name of ["first", "second"]) {
		writeFileSync(join(engine.root, `src/${name}.ts`), "export const value: any = 1;\n");
	}
});
