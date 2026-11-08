import process from "node:process";
import { Deferred, Effect, Fiber, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { services } from "#cli/runMain.ts";
import { qualityArgs } from "#testing/adapters/cli.ts";
import { isolatedEnvironment } from "#testing/adapters/git.ts";
import { defaultTree, linkEffect, removeSeededTrees } from "#testing/adapters/tree.ts";

export const qualitySignal = storyKit({
	*create() {
		yield* Effect.addFinalizer(() => Effect.sync(removeSeededTrees));
		const root = defaultTree({
			content: `import { MessageChannel } from "node:worker_threads";
import { Effect } from "effect";
import { defineRule } from "@shivaedev/quality/rule.ts";
export default {
local: [defineRule({
	id: "local/wait",
	description: "Waits for interruption.",
	check: () => Effect.callback(() => {
		const { port1, port2 } = new MessageChannel();
		port1.on("message", () => {});
		console.log("local rule ready");
		return Effect.sync(() => {
			port1.close();
			port2.close();
			console.log("local rule aborted");
		});
	})
})], sources: ["src"]
}`,
			path: "quality.config.ts",
		});
		linkEffect(root);
		const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
		const child = yield* spawner.spawn(
			ChildProcess.make(process.execPath, qualityArgs(["lint"]), {
				cwd: root,
				env: isolatedEnvironment(root),
				extendEnv: false,
				stdin: "ignore",
			}),
		);
		const ready = yield* Deferred.make<void>();
		const output = { stderr: "", stdout: "" };
		const stdout = yield* child.stdout.pipe(
			Stream.decodeText,
			Stream.runForEach((chunk) => {
				output.stdout += chunk;
				return output.stdout.includes("local rule ready") ? Deferred.succeed(ready, undefined) : Effect.void;
			}),
			Effect.forkScoped,
		);
		const stderr = yield* child.stderr.pipe(
			Stream.decodeText,
			Stream.runForEach((chunk) =>
				Effect.sync(() => {
					output.stderr += chunk;
				}),
			),
			Effect.forkScoped,
		);
		yield* Effect.raceFirst(
			Deferred.await(ready),
			Effect.flatMap(child.exitCode, (code) => Effect.die(new Error(`quality exited ${code} before its rule was ready: ${output.stderr}`))),
		);
		const state: { status: number | undefined } = { status: undefined };
		return { child, output, readers: [stdout, stderr], state };
	},
	inspect: (engine) => ({ output: engine.output, status: engine.state.status }),
	layer: services,
	name: "Quality executable signals",
	stages: [],
	verbs: (engine, story) => ({
		isRunning: () => engine.child.isRunning,
		outcome: () => Effect.sync(() => (engine.state.status === 130 ? "interrupted" : `exited ${engine.state.status}`)),
		receives: Effect.fn("QualitySignal.receives")(function* (signal: "SIGINT" | "SIGTERM") {
			story.tell(`the quality executable receives ${signal}`);
			yield* Effect.sync(() => process.kill(Number(engine.child.pid), signal));
			engine.state.status = Number(yield* engine.child.exitCode);
			yield* Effect.forEach(engine.readers, Fiber.join);
		}),
		ruleAborted: () => Effect.sync(() => engine.output.stdout.includes("local rule aborted")),
		stderr: () => Effect.sync(() => engine.output.stderr),
	}),
});
