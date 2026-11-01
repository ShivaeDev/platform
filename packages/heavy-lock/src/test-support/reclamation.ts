import { Deferred, Effect, Fiber, FileSystem, Option } from "effect";
import { reclaim } from "#lockFile.ts";
import type { Lock } from "./lock.ts";

export function reclamation(engine: Lock, tell: (line: string) => void) {
	let pending: { readonly resume: Deferred.Deferred<void>; readonly fiber: Fiber.Fiber<void, unknown> } | undefined;
	return {
		continues: () =>
			Effect.gen(function* () {
				tell("the first reclaimer continues and finishes");
				if (pending === undefined) {
					return yield* Effect.die(new Error("No reclaimer is paused."));
				}
				yield* Deferred.succeed(pending.resume, undefined);
				yield* Fiber.join(pending.fiber);
			}),
		starts: (deadName: string, before: "reading" | "removing" = "reading") =>
			Effect.gen(function* () {
				tell(`the first reclaimer starts reclaiming ${deadName}'s old lock and pauses before ${before} it`);
				const dead = engine.holders[deadName];
				if (dead === undefined) {
					return yield* Effect.die(new Error(`${deadName} never held the lock.`));
				}
				const fs = yield* FileSystem.FileSystem;
				const paused = yield* Deferred.make<void>();
				const resume = yield* Deferred.make<void>();
				function pause<A, E>(effect: Effect.Effect<A, E>) {
					return Deferred.succeed(paused, undefined).pipe(Effect.andThen(Deferred.await(resume)), Effect.andThen(effect));
				}
				const boundary: FileSystem.FileSystem = {
					...fs,
					readFileString: (path, encoding) => (before === "reading" ? pause(fs.readFileString(path, encoding)) : fs.readFileString(path, encoding)),
					remove: (path, options) =>
						before === "removing" && (path === engine.lock || path.endsWith(".stale")) ? pause(fs.remove(path, options)) : fs.remove(path, options),
				};
				const fiber = yield* reclaim(engine.lock, Option.some(dead)).pipe(Effect.provideService(FileSystem.FileSystem, boundary), Effect.forkScoped);
				yield* Effect.addFinalizer(() => Deferred.succeed(resume, undefined));
				pending = { fiber, resume };
				yield* Deferred.await(paused);
			}),
	};
}
