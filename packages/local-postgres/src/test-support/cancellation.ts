import process from "node:process";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Deferred, Effect, Fiber, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { LocalPostgresError } from "#LocalPostgresError.ts";
import { LOCAL_SERVER, localPostgres } from "#localPostgres.ts";
import type { PostgresCommandError } from "#PostgresCommandError.ts";

export const cancellation = storyKit({
	clock: "live",
	*create() {
		const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
		const started = yield* Deferred.make<void>();
		const child = yield* Deferred.make<ChildProcessSpawner.ChildProcessHandle>();
		const fiber = yield* Deferred.make<Fiber.Fiber<string, LocalPostgresError | PostgresCommandError>>();
		// A real process stands in for a psql command that has started but has not exited.
		const paused = ChildProcessSpawner.make(
			Effect.fn("Cancellation.spawn")(function* () {
				const handle = yield* spawner.spawn(
					ChildProcess.make(process.execPath, ["-e", "process.stdout.write('ready'); setInterval(() => {}, 1000)"]),
				);
				yield* Deferred.succeed(child, handle);
				return { ...handle, stdout: handle.stdout.pipe(Stream.tap(() => Deferred.succeed(started, undefined))) };
			}),
		);
		return { child, fiber, paused, started };
	},
	layer: NodeServices.layer,
	name: "interruptible database setup",
	stages: [],
	verbs: (engine, story) => ({
		cancel: Effect.fn("Cancellation.cancel")(function* () {
			story.tell("the caller interrupts setup");
			yield* Fiber.interrupt(yield* Deferred.await(engine.fiber));
		}),
		commandRunning: () => Effect.flatMap(Deferred.await(engine.child), (child) => child.isRunning),
		start: Effect.fn("Cancellation.start")(function* () {
			story.tell("setup runs a client command that waits");
			const fiber = yield* localPostgres({})
				.sql(`${LOCAL_SERVER}/postgres`, "SELECT 1")
				.pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, engine.paused), Effect.forkScoped);
			yield* Deferred.succeed(engine.fiber, fiber);
			yield* Deferred.await(engine.started);
		}),
	}),
});
