import { NodeServices } from "@effect/platform-node";
import { Cause, Clock, Effect, Fiber, Stream } from "effect";
import { TestClock } from "effect/testing";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { begin, child, close, makeEngine, signal } from "#test/engine.ts";
import { alive, awaitReady, backoff, ready, running, started } from "#test/observations.ts";

export const processes = storyKit({
	clock: "test",
	create: () => makeEngine,
	inspect: (engine) => Object.fromEntries([...engine.children].map(([name, value]) => [name, { logs: value.logs, pids: value.pids }])),
	layer: NodeServices.layer,
	name: "Local process supervision",
	stages: [],
	verbs: (engine, story) => ({
		alive,
		awaitReady: (name: string, pid: number) => awaitReady(engine, name, pid),
		backoff: (name: string) => backoff(engine, name),
		backoffPasses: (delay: number) => {
			story.tell(`${delay} milliseconds of restart backoff pass`);
			return TestClock.adjust(delay);
		},
		begin: (name: string, options?: Parameters<typeof begin>[2]) => {
			story.tell(`start supervising ${name}`);
			return begin(engine, name, options);
		},
		close: () => {
			story.tell("close the application scope");
			return close(engine);
		},
		closeReadiness: (pid: number) => signal(pid, "SIGQUIT"),
		crash: (pid: number) =>
			Effect.gen(function* () {
				const at = yield* Clock.currentTimeMillis;
				yield* signal(pid, "SIGKILL");
				return at;
			}),
		exitBeforeReady: (pid: number) => signal(pid, "SIGINT"),
		failure: (name: string) =>
			Fiber.join(child(engine, name).fiber).pipe(
				Effect.as("started"),
				Effect.catchTags({
					ProcessExited: (error) => Effect.succeed(`exit ${error.code} before readiness`),
					ReadinessMissing: () => Effect.succeed("stdout closed before readiness"),
					ReadinessTimeout: (error) => Effect.succeed(`${error.name} readiness timed out`),
					SchemaError: () => Effect.succeed("invalid readiness"),
				}),
			),
		interrupted: (name: string) =>
			Fiber.join(child(engine, name).fiber).pipe(
				Effect.flatMap((handle) => handle.await),
				Effect.exit,
				Effect.map((exit) => exit._tag === "Failure" && Cause.hasInterruptsOnly(exit.cause)),
			),
		logs: (name: string) => Effect.sync(() => [...child(engine, name).logs]),
		malformedReadiness: (pid: number) => signal(pid, "SIGUSR2"),
		pids: () => Effect.sync(() => [...engine.children.values()].flatMap((value) => value.pids)),
		readinessDeadlinePasses: () => TestClock.adjust(200),
		ready: (name: string) => ready(engine, name),
		release: (pid: number) => {
			story.tell(`process ${pid} sends its readiness handshake`);
			return signal(pid, "SIGUSR1");
		},
		replacementFailure: (name: string) =>
			running(engine, name).pipe(
				Effect.flatMap((handle) => handle.await),
				Effect.catchTag("SchemaError", () => Effect.succeed("invalid readiness")),
			),
		running: (name: string) => running(engine, name),
		started: (name: string) => started(engine, name),
		waitForLog: (name: string, text: string) =>
			Stream.fromQueue(child(engine, name).output).pipe(
				Stream.filter((line) => line.text === text),
				Stream.runHead,
			),
	}),
});
