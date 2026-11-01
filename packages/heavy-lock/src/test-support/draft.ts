import { Cause, Deferred, Effect, Exit, Fiber, FileSystem } from "effect";
import { tryAcquire } from "#lockFile.ts";
import { type Lock, makeHolder } from "./lock.ts";

export function draft(engine: Lock, tell: (line: string) => void) {
	let writing: Fiber.Fiber<unknown, unknown> | undefined;
	let result = "not interrupted";
	return {
		interrupts: () =>
			Effect.gen(function* () {
				tell("the attempt writing its draft is interrupted");
				if (writing === undefined) {
					return yield* Effect.die(new Error("No draft write is in progress."));
				}
				yield* Fiber.interrupt(writing);
				const exit = yield* Fiber.await(writing);
				result = Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause) ? "interrupted" : "finished without interruption";
			}),
		result: () => Effect.sync(() => result),
		startsWriting: (name: string) =>
			Effect.gen(function* () {
				tell(`${name} starts taking the lock and pauses during its draft write`);
				const fs = yield* FileSystem.FileSystem;
				const started = yield* Deferred.make<void>();
				const boundary: FileSystem.FileSystem = {
					...fs,
					writeFileString: (path, contents, options) =>
						fs
							.writeFileString(path, contents.slice(0, 10), options)
							.pipe(Effect.andThen(Deferred.succeed(started, undefined)), Effect.andThen(Effect.never)),
				};
				writing = yield* tryAcquire(engine.lock, makeHolder(name)).pipe(Effect.provideService(FileSystem.FileSystem, boundary), Effect.forkScoped);
				yield* Deferred.await(started);
			}),
	};
}
