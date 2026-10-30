import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Cause, Console, Deferred, Effect, Exit, Fiber } from "effect";
import { ChildProcessSpawner } from "effect/process";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { program } from "#cli/program.ts";
import { exitCode, explained, services } from "#cli/runMain.ts";
import { SetupFailure } from "#failure.ts";
import { capturing, type Output } from "#test/cli.ts";
import { config, defaultTree, removeSeededTrees } from "#test/tree.ts";

interface RunningTool {
	readonly child: ChildProcessSpawner.ChildProcessHandle;
	readonly path: string;
}

interface Lifecycle {
	failure: unknown;
	fiber: Fiber.Fiber<unknown, unknown> | undefined;
	readonly originalEntries: string[];
	output: Output;
	readonly promiseReady: Deferred.Deferred<void>;
	promiseSignal: AbortSignal | undefined;
	readonly root: string;
	readonly started: Deferred.Deferred<RunningTool>;
	status: number | undefined;
}

export const qualityLifecycle = storyKit({
	clock: "live",
	*create() {
		yield* Effect.addFinalizer(() => Effect.sync(removeSeededTrees));
		const root = defaultTree(config('{ sources: ["src"] }'));
		const engine: Lifecycle = {
			failure: undefined,
			fiber: undefined,
			originalEntries: readdirSync(root).toSorted(),
			output: { stderr: "", stdout: "" },
			promiseReady: yield* Deferred.make<void>(),
			promiseSignal: undefined,
			root,
			started: yield* Deferred.make<RunningTool>(),
			status: undefined,
		};
		return engine;
	},
	layer: services,
	name: "Quality rule lifecycle",
	stages: ["repository", "running"],
	verbs: (engine, story) => ({
		check: Effect.fn("QualityLifecycle.check")(function* () {
			story.tell("the author runs quality lint");
			const result = yield* Effect.exit(
				program(["lint"], { cwd: engine.root, launch: { options: [], script: "quality" } }).pipe(
					explained,
					Effect.provideService(Console.Console, capturing(engine.output)),
				),
			);
			engine.status = exitCode(result);
			engine.failure = Exit.isFailure(result) ? Cause.squash(result.cause) : undefined;
		}),
		childRunning: () => Deferred.await(engine.started).pipe(Effect.flatMap(({ child }) => child.isRunning)),
		interrupt: Effect.fn("QualityLifecycle.interrupt")(function* () {
			story.tell("the author interrupts quality");
			if (engine.fiber === undefined) {
				return yield* Effect.die(new Error("Quality has not started"));
			}
			yield* Fiber.interrupt(engine.fiber);
			const exit = yield* Fiber.await(engine.fiber);
			engine.status = exitCode(exit);
		}),
		originalEntries: () => engine.originalEntries,
		promiseAborted: () => Effect.sync(() => engine.promiseSignal?.aborted),
		rootEntries: () => Effect.sync(() => readdirSync(engine.root).toSorted()),
		setupFailure: () => {
			if (!(engine.failure instanceof SetupFailure)) {
				throw new Error("Quality did not report a setup failure");
			}
			return {
				cause: engine.failure.cause instanceof Error ? engine.failure.cause.message : undefined,
				enumerableCause: Object.keys(engine.failure).includes("cause"),
				serialized: JSON.stringify(engine.failure),
			};
		},
		status: () => engine.status,
		stderr: () => engine.output.stderr,
		temporaryConfigExists: () => Deferred.await(engine.started).pipe(Effect.map(({ path }) => existsSync(path))),
	}),
});

export const biomeRunning = qualityLifecycle.trait("running", "Biome has started and its process handle is awaiting delivery", function* (engine) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const tracked = ChildProcessSpawner.ChildProcessSpawner.of({
		...spawner,
		spawn: (command) =>
			Effect.gen(function* () {
				const child = yield* spawner.spawn(command);
				if (command._tag === "StandardCommand" && command.args.includes("check") && command.args.some((arg) => arg.endsWith("/biome/bin/biome"))) {
					const configArgument = command.args.find((arg) => arg.startsWith("--config-path="));
					if (configArgument === undefined) {
						return yield* Effect.die(new Error("Biome started without its exception config"));
					}
					yield* Deferred.succeed(engine.started, { child, path: configArgument.slice("--config-path=".length) });
					yield* Effect.never;
				}
				return child;
			}),
	});
	engine.fiber = yield* program(["lint"], { cwd: engine.root, launch: { options: [], script: "quality" } }).pipe(
		explained,
		Effect.provideService(Console.Console, capturing(engine.output)),
		Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, tracked),
		Effect.forkScoped,
	);
	yield* Deferred.await(engine.started);
});

export const crashingRule = qualityLifecycle.trait("repository", "a local rule crashes at its named check", (engine) => {
	writeFileSync(
		join(engine.root, "quality.config.ts"),
		`import { defineRule } from "@shivaedev/quality/rule.ts";
export default { local: [defineRule({ id: "local/crash", description: "Checks a local policy.", check: function crashRule() { throw new Error("policy crashed"); } })] };
`,
	);
});

export const brokenConfig = qualityLifecycle.trait("repository", "loading the config throws an error", (engine) => {
	writeFileSync(join(engine.root, "quality.config.ts"), 'throw new Error("config crashed");\n');
});
