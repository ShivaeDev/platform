import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ConfigProvider, Console, type Context, Deferred, Effect, Fiber } from "effect";
import { ChildProcessSpawner } from "effect/process";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { program } from "#cli/program.ts";
import { exitCode, explained, services } from "#cli/runMain.ts";
import { capturing, type Output, qualityArgs } from "#testing/adapters/cli.ts";
import { ISOLATED_ENV } from "#testing/adapters/git.ts";
import { config, defaultTree, removeSeededTrees } from "#testing/adapters/tree.ts";
import { answerOf, type CliAnswer, cliVerbs } from "./cliAnswers.ts";

export interface RunningTool {
	readonly child: ChildProcessSpawner.ChildProcessHandle;
	readonly path: string;
	readonly sourceConfig?: string;
}

export interface Lifecycle {
	answer: CliAnswer | undefined;
	fiber: Fiber.Fiber<unknown, unknown> | undefined;
	readonly output: Output;
	readonly promiseReady: Deferred.Deferred<void>;
	promiseSignal: AbortSignal | undefined;
	readonly root: string;
	readonly started: Deferred.Deferred<RunningTool>;
}

function closedReaderRun(engine: Lifecycle, args: readonly string[]): Promise<CliAnswer> {
	return new Promise((resolve) => {
		const child = spawn("node", qualityArgs(args), { cwd: engine.root, env: ISOLATED_ENV, stdio: ["ignore", "pipe", "pipe"] });
		child.stdout.destroy();
		let stderr = "";
		child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
			stderr += chunk;
		});
		child.on("close", (status) => {
			engine.answer = answerOf({ status, stderr, stdout: "" });
			resolve(engine.answer);
		});
	});
}

function runningTool(engine: Lifecycle): Effect.Effect<RunningTool> {
	return Deferred.await(engine.started);
}

export function startQuality(engine: Lifecycle, spawner: Context.Service.Shape<typeof ChildProcessSpawner.ChildProcessSpawner>) {
	return program(["lint"], { cwd: engine.root, launch: { options: [], script: "quality" } }).pipe(
		explained,
		Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: { "HEAVY_PROCESS_LOCK": join(engine.root, "heavy.lock") } })),
		Effect.provideService(Console.Console, capturing(engine.output)),
		Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
		Effect.forkScoped,
	);
}

export const qualityLifecycle = storyKit({
	clock: "live",
	*create() {
		yield* Effect.addFinalizer(() => Effect.sync(removeSeededTrees));
		const engine: Lifecycle = {
			answer: undefined,
			fiber: undefined,
			output: { stderr: "", stdout: "" },
			promiseReady: yield* Deferred.make<void>(),
			promiseSignal: undefined,
			root: defaultTree(config('{ sources: ["src"] }')),
			started: yield* Deferred.make<RunningTool>(),
		};
		return engine;
	},
	layer: services,
	name: "Quality lifecycle",
	stages: ["repository", "running"],
	verbs: (engine, story) => {
		const cli = cliVerbs(engine, story.tell);
		return {
			...cli,
			interrupts: Effect.fn("QualityLifecycle.interrupts")(function* () {
				story.tell("the author interrupts quality");
				if (engine.fiber === undefined) {
					return yield* Effect.die(new Error("Start quality with a running trait before interrupting it"));
				}
				yield* Fiber.interrupt(engine.fiber);
				const status = exitCode(yield* Fiber.await(engine.fiber));
				engine.answer = answerOf({ status, ...engine.output });
			}),
			outcome: () => Effect.map(cli.outcome(), (outcome) => (outcome === "exited 130" ? "interrupted" : outcome)),
			pipesToClosedReader: (...args: readonly string[]) =>
				Effect.promise(() => {
					story.tell(`the author pipes quality ${args.join(" ")} into a reader that has already exited`);
					return closedReaderRun(engine, args);
				}),
			promiseSignalAborted: () => Effect.sync(() => engine.promiseSignal?.aborted),
			temporaryKnipSourceConfigExists: () =>
				Effect.map(runningTool(engine), ({ sourceConfig }) => sourceConfig !== undefined && existsSync(sourceConfig)),
			temporaryToolConfigExists: () => Effect.map(runningTool(engine), ({ path }) => existsSync(path)),
			toolIsRunning: () => Effect.flatMap(runningTool(engine), ({ child }) => child.isRunning),
		};
	},
});

export const crashingRule = qualityLifecycle.trait("repository", "a local rule's named check function throws", (engine) => {
	writeFileSync(
		join(engine.root, "quality.config.ts"),
		`import { defineRule } from "@shivaedev/quality/rule.ts";
export default { local: [defineRule({ id: "local/crash", description: "Checks a local policy.", check: function crashRule() { throw new Error("policy crashed"); } })] };
`,
	);
});

export function malformedBiomeVcs(value: unknown) {
	return qualityLifecycle.trait("repository", `biome.json extends the quality preset and sets vcs to ${JSON.stringify(value)}`, (engine) => {
		writeFileSync(join(engine.root, "biome.json"), JSON.stringify({ extends: ["@shivaedev/quality/biome/preset.json"], vcs: value }));
	});
}
