import process from "node:process";
import { fileURLToPath } from "node:url";
import { Cause, Deferred, Effect, Exit, Fiber, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { checkRepository } from "#check.ts";
import { readHistory } from "#readHistory.ts";

const pendingGit = fileURLToPath(new URL("./pendingGit.ts", import.meta.url));

export function effectApi(root: string, tell: (line: string) => void) {
	let reading: Fiber.Fiber<unknown, unknown> | undefined;
	let git: ChildProcessSpawner.ChildProcessHandle | undefined;

	function historyRead() {
		if (reading === undefined) {
			throw new Error("Start a history read first.");
		}
		return reading;
	}

	return {
		checkThroughEffect: () => {
			tell("the Effect caller checks the repository and handles only GitError");
			return checkRepository(root).pipe(
				Effect.as("valid"),
				Effect.catchTag("GitError", (error) =>
					Effect.succeed({
						cause: error.cause,
						causeEnumerable: Object.prototype.propertyIsEnumerable.call(error, "cause"),
						tag: error._tag,
					}),
				),
			);
		},
		gitHistoryRunning: () => {
			if (git === undefined) {
				throw new Error("Start a history read first.");
			}
			return git.isRunning;
		},
		historyReadStatus: () =>
			Effect.sync(() => {
				const result = historyRead().pollUnsafe();
				if (result === undefined) {
					return "reading";
				}
				if (Exit.isSuccess(result)) {
					return "completed";
				}
				return Cause.hasInterruptsOnly(result.cause) ? "interrupted" : Cause.pretty(result.cause);
			}),
		interruptHistoryRead: () => {
			tell("the Effect caller interrupts the pending history read");
			return Fiber.interrupt(historyRead()).pipe(Effect.timeout("5 seconds"));
		},
		startHistoryRead: () =>
			Effect.gen(function* () {
				tell("the Effect caller reads history while the external Git listing stays pending");
				const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
				const started = yield* Deferred.make<void>();
				const pending = ChildProcessSpawner.make((command) =>
					Effect.gen(function* () {
						if (command._tag !== "StandardCommand" || command.command !== "git" || command.args[0] !== "ls-tree") {
							return yield* spawner.spawn(command);
						}
						git = yield* spawner.spawn(ChildProcess.make(process.execPath, [pendingGit], { stdin: "pipe" }));
						return ChildProcessSpawner.makeHandle({
							...git,
							stdout: git.stdout.pipe(Stream.tap(() => Deferred.succeed(started, undefined))),
						});
					}),
				);
				reading = yield* readHistory(root, {}).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, pending), Effect.forkScoped);
				yield* Effect.raceFirst(
					Deferred.await(started),
					Fiber.join(reading).pipe(Effect.andThen(Effect.die(new Error("History read ended before Git signalled it was reading.")))),
				).pipe(Effect.timeout("5 seconds"));
			}),
	};
}
